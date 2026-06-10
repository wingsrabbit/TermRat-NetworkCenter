"""主机资源采集（psutil）。绝不抛异常，出错的字段填 None。"""

import os
import time

import psutil


def collect() -> dict:
    """采集一次主机资源快照。

    返回 dict:
      cpu          CPU 使用率 %（约 0.5s 采样窗口）
      mem          内存使用率 %
      disk         根分区 "/" 使用率 %
      load         1 分钟平均负载
      net_in       入向速率 MB/s（采样约 1s）
      net_out      出向速率 MB/s
      uptime_days  开机天数（自 psutil.boot_time()）
    """
    result = {
        "cpu": None,
        "mem": None,
        "disk": None,
        "load": None,
        "net_in": None,
        "net_out": None,
        "uptime_days": None,
    }

    # CPU：阻塞约 0.5s 取这段时间内的平均使用率
    try:
        result["cpu"] = psutil.cpu_percent(interval=0.5)
    except Exception as e:
        print(f"[resources] cpu error: {e}")

    # 内存使用率
    try:
        result["mem"] = psutil.virtual_memory().percent
    except Exception as e:
        print(f"[resources] mem error: {e}")

    # 根分区磁盘使用率
    try:
        result["disk"] = psutil.disk_usage("/").percent
    except Exception as e:
        print(f"[resources] disk error: {e}")

    # 1 分钟平均负载
    try:
        result["load"] = os.getloadavg()[0]
    except Exception as e:
        print(f"[resources] load error: {e}")

    # 网络速率：对 net_io_counters 的字节数采样约 1s 求差
    try:
        c1 = psutil.net_io_counters()
        t1 = time.perf_counter()
        time.sleep(1)
        c2 = psutil.net_io_counters()
        t2 = time.perf_counter()
        dt = t2 - t1
        if dt > 0:
            mb = 1024 * 1024
            result["net_in"] = (c2.bytes_recv - c1.bytes_recv) / dt / mb
            result["net_out"] = (c2.bytes_sent - c1.bytes_sent) / dt / mb
    except Exception as e:
        print(f"[resources] net error: {e}")

    # 开机天数
    try:
        uptime_seconds = time.time() - psutil.boot_time()
        result["uptime_days"] = uptime_seconds / 86400
    except Exception as e:
        print(f"[resources] uptime error: {e}")

    return result


if __name__ == "__main__":
    print(collect())
