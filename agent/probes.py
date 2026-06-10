"""探测函数集合。

每个 probe 函数都返回统一结构的 dict（无关字段填 None），
并且**绝不抛异常**——任何失败都捕获后返回 success=False。
所有计时统一用 time.perf_counter()，单位毫秒(ms)。
"""

import socket
import time

import httpx
import dns.resolver
from icmplib import ping


def _blank_result() -> dict:
    """返回一份所有字段为 None 的统一结果模板。"""
    return {
        "latency": None,
        "packet_loss": None,
        "jitter": None,
        "success": False,
        "dns_time": None,
        "tcp_time": None,
        "tls_time": None,
        "ttfb": None,
        "total_time": None,
        "status_code": None,
        "resolved_ip": None,
    }


def probe_icmp(target: str, timeout: float, count: int = 5) -> dict:
    """ICMP ping 探测。需要 root / CAP_NET_RAW（privileged=True）。"""
    r = _blank_result()
    try:
        host = ping(
            target,
            count=count,
            interval=0.2,
            timeout=timeout,
            privileged=True,
        )
        r["resolved_ip"] = host.address
        r["packet_loss"] = host.packet_loss * 100  # icmplib 给的是 0..1，转成百分比
        # 收到回包才算成功
        r["success"] = host.packets_received > 0
        if r["success"]:
            r["latency"] = host.avg_rtt
            # 少于 2 个回包时 jitter 无意义，置 0.0
            r["jitter"] = host.jitter if host.packets_received >= 2 else 0.0
    except Exception as e:  # 权限不足 / 解析失败等
        print(f"[probe_icmp] {target} error: {e}")
    return r


def probe_tcp(target: str, port: int, timeout: float) -> dict:
    """TCP 连接探测：DNS 解析 + 测量 connect 耗时。"""
    r = _blank_result()
    sock = None
    try:
        # 先做 DNS 解析，记录解析到的 IP
        infos = socket.getaddrinfo(target, port, proto=socket.IPPROTO_TCP)
        family, socktype, proto, _canon, sockaddr = infos[0]
        r["resolved_ip"] = sockaddr[0]

        sock = socket.socket(family, socktype, proto)
        sock.settimeout(timeout)
        start = time.perf_counter()
        sock.connect(sockaddr)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        r["tcp_time"] = elapsed
        r["latency"] = elapsed
        r["success"] = True
    except Exception as e:
        print(f"[probe_tcp] {target}:{port} error: {e}")
    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass
    return r


def probe_udp(target: str, port: int, timeout: float) -> dict:
    """UDP 探测：connect + 发一个字节 + 等回包。

    收到回包          → 主机可达，success=True 并记录 latency；
    ConnectionRefused → 收到 ICMP port-unreachable，说明主机可达，同样 success=True；
    超时              → 不可达，success=False。
    """
    r = _blank_result()
    sock = None
    try:
        infos = socket.getaddrinfo(target, port, type=socket.SOCK_DGRAM)
        family, socktype, proto, _canon, sockaddr = infos[0]
        r["resolved_ip"] = sockaddr[0]

        sock = socket.socket(family, socket.SOCK_DGRAM, proto)
        sock.settimeout(timeout)
        sock.connect(sockaddr)

        start = time.perf_counter()
        sock.send(b"\x00")
        try:
            sock.recv(1024)
            # 有回包：主机可达
            r["latency"] = (time.perf_counter() - start) * 1000
            r["success"] = True
        except ConnectionRefusedError:
            # 收到 ICMP 端口不可达：主机可达，端口关闭
            r["latency"] = (time.perf_counter() - start) * 1000
            r["success"] = True
        except socket.timeout:
            # 超时：无法判定可达性，视为失败
            r["success"] = False
    except ConnectionRefusedError as e:
        # 某些平台 connect/send 阶段就抛 refused
        r["success"] = True
        print(f"[probe_udp] {target}:{port} refused (host reachable): {e}")
    except Exception as e:
        print(f"[probe_udp] {target}:{port} error: {e}")
    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass
    return r


def probe_http(target: str, timeout: float) -> dict:
    """HTTP(S) 探测。target 为完整 URL。

    用 httpx 的 trace 扩展抓取各阶段耗时；DNS 单独用 getaddrinfo 计时，
    因为 httpx 把 DNS 解析折叠进了 connect_tcp 阶段。
    """
    r = _blank_result()
    # trace 回调收集到的各阶段时间戳（perf_counter 秒）
    marks: dict = {}

    def trace(name: str, info: dict):
        marks[name] = time.perf_counter()

    try:
        # —— 单独测 DNS（解析 host 部分）——
        parsed = httpx.URL(target)
        host = parsed.host
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        try:
            dns_start = time.perf_counter()
            infos = socket.getaddrinfo(host, port)
            r["dns_time"] = (time.perf_counter() - dns_start) * 1000
            r["resolved_ip"] = infos[0][4][0]
        except Exception as e:
            print(f"[probe_http] dns for {host} error: {e}")

        # —— 发请求并通过 trace 抓阶段耗时 ——
        with httpx.Client(
            timeout=timeout,
            follow_redirects=True,
        ) as client:
            req_start = time.perf_counter()
            resp = client.get(target, extensions={"trace": trace})
            total = (time.perf_counter() - req_start) * 1000  # ms

        def span(a: str, b: str):
            """两个 trace 事件之间的毫秒差，缺任一则返回 None。"""
            if a in marks and b in marks:
                return (marks[b] - marks[a]) * 1000
            return None

        r["tcp_time"] = span(
            "connection.connect_tcp.started", "connection.connect_tcp.complete"
        )
        r["tls_time"] = span(
            "connection.start_tls.started", "connection.start_tls.complete"
        )
        # TTFB：从请求开始到收到响应头
        if "http11.receive_response_headers.started" in marks:
            r["ttfb"] = (marks["http11.receive_response_headers.started"] - req_start) * 1000

        r["total_time"] = total
        r["latency"] = total
        r["status_code"] = resp.status_code
        r["success"] = 200 <= resp.status_code < 400
    except Exception as e:
        print(f"[probe_http] {target} error: {e}")
    return r


def probe_dns(target: str, timeout: float, record_type: str = "A") -> dict:
    """DNS 查询探测。默认查 A 记录。"""
    r = _blank_result()
    try:
        resolver = dns.resolver.Resolver(configure=True)
        resolver.lifetime = timeout
        start = time.perf_counter()
        answer = resolver.resolve(target, record_type)
        elapsed = (time.perf_counter() - start) * 1000  # ms
        r["dns_time"] = elapsed
        r["latency"] = elapsed
        # 取第一条应答作为 resolved_ip
        first = next(iter(answer), None)
        if first is not None:
            r["resolved_ip"] = str(first)
        r["success"] = True
    except Exception as e:
        print(f"[probe_dns] {target} error: {e}")
    return r


def run_probe(task: dict) -> dict:
    """调度器：按 task['protocol'] 调用对应探测函数。

    task 形如 {protocol, target, port, timeout}。未知协议返回失败模板。
    """
    protocol = (task.get("protocol") or "").lower()
    target = task.get("target")
    port = task.get("port")
    timeout = task.get("timeout") or 5

    if protocol == "icmp":
        return probe_icmp(target, timeout)
    if protocol == "tcp":
        return probe_tcp(target, port, timeout)
    if protocol == "udp":
        return probe_udp(target, port, timeout)
    if protocol == "http":
        return probe_http(target, timeout)
    if protocol == "dns":
        return probe_dns(target, timeout)

    r = _blank_result()
    print(f"[run_probe] unknown protocol: {protocol!r}")
    return r
