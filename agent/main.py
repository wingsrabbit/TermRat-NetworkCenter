"""TermRat-NC 监控 Agent 主循环。

职责：
  1. 周期性从中心拉取分配给本节点的探测任务；
  2. 按各任务自己的 interval 调度执行探测，结果进缓冲区；
  3. 按 report_interval 采集主机资源 + 打包结果上报，上报成功后清空已发缓冲。

全程容错：任何网络/探测错误只打日志到 stdout，绝不崩溃。

调度模型（均匀采样 + 非阻塞探测）：
  - 主循环每秒 tick 一次，只负责"调度 + 上报"，绝不内联跑探测；
  - 每个任务对齐到墙钟网格：interval=N 的任务在 t 为 N 整数倍的时刻触发，
    结果 ts 记成网格时刻（而非探测完成时刻），即使探测跑慢点也保持等间隔；
  - 探测提交到 ThreadPoolExecutor 后台执行，完成回调里把结果写入缓冲；
  - 同一任务上一次还没跑完时跳过本次调度，避免并发重复执行；
  - 缓冲被多个 worker 线程写入，故用锁保护。
"""

import math
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import httpx

import probes
import resources
import testserver

# —— 配置（来自环境变量）——
NC_SERVER = os.environ.get("NC_SERVER")
NC_TOKEN = os.environ.get("NC_TOKEN")


def _read_version():
    """读镜像内 VERSION（与中心同版本号），缺失则回退常量。"""
    here = os.path.dirname(os.path.abspath(__file__))
    for p in ("/app/VERSION", os.path.join(here, "VERSION"), "VERSION"):
        try:
            with open(p, "r", encoding="utf-8") as f:
                v = f.read().strip()
                if v:
                    return v
        except OSError:
            continue
    return "0.71"


# 优先环境变量 AGENT_VERSION，否则读 VERSION 文件（不再写死陈旧常量）
AGENT_VERSION = os.environ.get("AGENT_VERSION") or _read_version()

# 拉取任务的固定周期（秒）
TASK_FETCH_INTERVAL = 60
# 上报间隔的兜底默认值（秒），实际以服务端返回的 report_interval 为准
DEFAULT_REPORT_INTERVAL = 60
# HTTP 请求超时（秒）
HTTP_TIMEOUT = 15
# 探测线程池大小：并发执行探测，避免慢探测阻塞调度
PROBE_WORKERS = 8


def _check_config():
    """校验必需配置，缺失则给出明确提示并退出。"""
    missing = []
    if not NC_SERVER:
        missing.append("NC_SERVER")
    if not NC_TOKEN:
        missing.append("NC_TOKEN")
    if missing:
        print(
            "ERROR: 缺少必需环境变量: "
            + ", ".join(missing)
            + "\n请设置 NC_SERVER (如 http://1.2.3.4:8080) 与 NC_TOKEN 后重试。"
        )
        sys.exit(1)


def fetch_tasks(client: httpx.Client) -> Optional[dict]:
    """GET /api/agent/tasks，返回解析后的 dict；失败返回 None。"""
    try:
        url = f"{NC_SERVER}/api/agent/tasks"
        resp = client.get(url, headers={"Authorization": f"Bearer {NC_TOKEN}"})
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[fetch_tasks] error: {e}")
        return None


def report(client: httpx.Client, results: list) -> bool:
    """POST /api/agent/report，附带当前资源快照与结果缓冲。

    成功（返回 {ok:true,stored}）返回 True，否则 False（结果留待下次重发）。
    """
    try:
        res = resources.collect()
        body = {
            "agent_version": AGENT_VERSION,
            "resources": res,
            "results": results,
        }
        url = f"{NC_SERVER}/api/agent/report"
        resp = client.post(
            url,
            headers={"Authorization": f"Bearer {NC_TOKEN}"},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()
        ok = bool(data.get("ok"))
        if ok:
            print(f"[report] ok, stored={data.get('stored')}, sent={len(results)}")
        else:
            print(f"[report] server returned ok=false: {data}")
        return ok
    except Exception as e:
        print(f"[report] error: {e}")
        return False


def run_task(task: dict, grid_ts_ms: int) -> dict:
    """执行单个任务，组装成上报用的 result 结构。

    grid_ts_ms 为该次调度对应的墙钟网格时刻（epoch 毫秒）。结果的 ts 用网格时刻而
    非探测完成时刻，从而保证采样点等间隔（即便探测本身耗时较长）。
    """
    probe_fields = probes.run_probe(task)
    result = {
        "task_id": str(task.get("id")),
        "ts": grid_ts_ms,  # 网格时刻，epoch 毫秒
    }
    result.update(probe_fields)
    return result


def _next_grid(now_epoch: float, interval: int) -> int:
    """返回 >= now 的下一个 interval 网格时刻（epoch 秒，整数）。

    网格点为 interval 的整数倍：next = ceil(now / interval) * interval。
    若 now 恰好落在网格点上，返回 now 本身。
    """
    return int(math.ceil(now_epoch / interval) * interval)


def main():
    _check_config()
    print(f"TermRat-NC agent starting; server={NC_SERVER}, version={AGENT_VERSION}")

    # —— 启动内置测试服务（HTTP/HTTPS/UDP），供节点间互探；容错、不阻塞 ——
    try:
        testserver.start_test_servers()
    except Exception as e:
        print(f"[main] start_test_servers error (ignored): {e}")

    # 调度状态
    tasks: list = []                     # 当前任务列表
    report_interval = DEFAULT_REPORT_INTERVAL

    # 缓冲被多个 worker 线程写入，用锁保护
    buffer: list = []                    # 待上报结果缓冲
    buffer_lock = threading.Lock()

    # 每个任务下一次应触发的墙钟网格时刻（epoch 秒）
    next_due: dict = {}                  # task_id -> 下一个网格时刻
    # 正在执行中的任务集合，防止同一任务并发重复调度
    in_flight: set = set()
    in_flight_lock = threading.Lock()

    pool = ThreadPoolExecutor(max_workers=PROBE_WORKERS)

    def submit_probe(task: dict, tid: str, grid_ts_ms: int):
        """把一次探测提交到线程池；完成回调里写缓冲并解除 in_flight。"""

        def _job():
            try:
                result = run_task(task, grid_ts_ms)
                with buffer_lock:
                    buffer.append(result)
            except Exception as e:
                # run_probe 本身不抛，这里是额外兜底
                print(f"[run_task] task={tid} error: {e}")
            finally:
                with in_flight_lock:
                    in_flight.discard(tid)

        pool.submit(_job)

    # 上报节奏用 perf_counter（单调钟，不受系统时间跳变影响）
    last_fetch_mono = -1e9               # 立刻触发一次拉取
    last_report_mono = time.perf_counter()  # 启动后等一个 report_interval 再上报

    try:
        with httpx.Client(timeout=HTTP_TIMEOUT) as client:
            while True:
                mono = time.perf_counter()
                wall = time.time()        # 墙钟（epoch 秒），用于网格对齐

                # —— 1. 按 TASK_FETCH_INTERVAL 拉取任务 ——
                if mono - last_fetch_mono >= TASK_FETCH_INTERVAL:
                    last_fetch_mono = mono
                    data = fetch_tasks(client)
                    if data is not None:
                        tasks = data.get("tasks", []) or []
                        ri = data.get("report_interval")
                        if isinstance(ri, (int, float)) and ri > 0:
                            report_interval = ri
                        node = data.get("node", {}) or {}
                        print(
                            f"[fetch_tasks] node={node.get('name')} "
                            f"tasks={len(tasks)} report_interval={report_interval}"
                        )

                # —— 2. 按各任务 interval 对齐墙钟网格调度（非阻塞）——
                for task in tasks:
                    if not task.get("enabled", False):
                        continue
                    tid = str(task.get("id"))
                    interval = int(task.get("interval") or 60)
                    if interval <= 0:
                        interval = 60

                    # 首次见到该任务：对齐到下一个网格点，不立即抢跑
                    if tid not in next_due:
                        next_due[tid] = _next_grid(wall, interval)
                        continue

                    if wall >= next_due[tid]:
                        grid_ts = next_due[tid]          # 本次调度的网格时刻（秒）
                        # 推进到下一个 > 当前墙钟的网格点（落后多个周期也只跑一次，直接追上）
                        next_due[tid] = _next_grid(wall + 1e-6, interval)

                        # 上一次还在跑就跳过本次，避免并发重复
                        with in_flight_lock:
                            if tid in in_flight:
                                print(f"[schedule] task={tid} still in flight, skip")
                                continue
                            in_flight.add(tid)

                        submit_probe(task, tid, int(grid_ts * 1000))

                # —— 3. 按 report_interval 上报 ——
                if mono - last_report_mono >= report_interval:
                    last_report_mono = mono
                    with buffer_lock:
                        sending = buffer[:]              # 快照本批
                    if sending:
                        if report(client, sending):
                            # 仅清掉已发送部分，期间 worker 新进的结果保留
                            with buffer_lock:
                                del buffer[: len(sending)]
                    else:
                        # 即使没有探测结果，也上报一次资源心跳
                        report(client, [])

                time.sleep(1)
    finally:
        pool.shutdown(wait=False)


if __name__ == "__main__":
    main()
