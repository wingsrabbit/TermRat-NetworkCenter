"""TermRat-NC 监控 Agent 主循环。

职责：
  1. 周期性从中心拉取分配给本节点的探测任务；
  2. 按各任务自己的 interval 调度执行探测，结果进缓冲区；
  3. 按 report_interval 采集主机资源 + 打包结果上报，上报成功后清空已发缓冲。

全程容错：任何网络/探测错误只打日志到 stdout，绝不崩溃。
单线程调度：每秒 tick 一次，检查任务与上报时机即可。
"""

import os
import sys
import time
from typing import Optional

import httpx

import probes
import resources

# —— 配置（来自环境变量）——
NC_SERVER = os.environ.get("NC_SERVER")
NC_TOKEN = os.environ.get("NC_TOKEN")
AGENT_VERSION = os.environ.get("AGENT_VERSION", "0.3")

# 拉取任务的固定周期（秒）
TASK_FETCH_INTERVAL = 60
# 上报间隔的兜底默认值（秒），实际以服务端返回的 report_interval 为准
DEFAULT_REPORT_INTERVAL = 60
# HTTP 请求超时（秒）
HTTP_TIMEOUT = 15


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


def run_task(task: dict) -> dict:
    """执行单个任务，组装成上报用的 result 结构。"""
    probe_fields = probes.run_probe(task)
    result = {
        "task_id": str(task.get("id")),
        "ts": int(time.time() * 1000),  # epoch 毫秒
    }
    result.update(probe_fields)
    return result


def main():
    _check_config()
    print(f"TermRat-NC agent starting; server={NC_SERVER}, version={AGENT_VERSION}")

    # 调度状态
    tasks: list = []                     # 当前任务列表
    report_interval = DEFAULT_REPORT_INTERVAL
    last_run: dict = {}                  # task_id -> 上次执行的 perf_counter
    buffer: list = []                    # 待上报结果缓冲

    now = time.perf_counter()
    last_fetch = -1e9                    # 立刻触发一次拉取
    last_report = now                    # 启动后等一个 report_interval 再上报

    with httpx.Client(timeout=HTTP_TIMEOUT) as client:
        while True:
            now = time.perf_counter()

            # —— 1. 按 TASK_FETCH_INTERVAL 拉取任务 ——
            if now - last_fetch >= TASK_FETCH_INTERVAL:
                last_fetch = now
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

            # —— 2. 按各任务 interval 调度执行 ——
            for task in tasks:
                if not task.get("enabled", False):
                    continue
                tid = str(task.get("id"))
                interval = task.get("interval") or 60
                last = last_run.get(tid, -1e9)
                if now - last >= interval:
                    last_run[tid] = now
                    try:
                        result = run_task(task)
                        buffer.append(result)
                    except Exception as e:
                        # run_probe 本身不抛，这里是额外兜底
                        print(f"[run_task] task={tid} error: {e}")

            # —— 3. 按 report_interval 上报 ——
            if now - last_report >= report_interval:
                last_report = now
                if buffer:
                    sending = buffer[:]          # 快照本批
                    if report(client, sending):
                        # 仅清掉已发送部分，期间新进的结果保留
                        del buffer[: len(sending)]
                else:
                    # 即使没有探测结果，也上报一次资源心跳
                    report(client, [])

            time.sleep(1)


if __name__ == "__main__":
    main()
