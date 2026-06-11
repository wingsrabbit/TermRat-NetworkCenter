"""内置测试服务，供各节点之间互相探测使用。

启动三类极简服务（全部跑在守护线程里，绝不拖垮 agent）：
  - HTTP  (TCP) :8799  任意 GET/HEAD 都回 200 "ok"
  - HTTPS (TCP) :8443  同样回 200 "ok"，启动时现场生成自签证书
  - UDP echo    :8799  recvfrom 收到什么就 sendto 原样回去（测 UDP 延迟）

设计原则：每个服务各自 try/except，单个挂掉只打日志、不影响其它服务，
更不影响主 agent。start_test_servers() 立即返回（线程已 daemon 化）。

端口可用环境变量覆盖：
  NC_TEST_HTTP_PORT  (默认 8799)
  NC_TEST_HTTPS_PORT (默认 8443)
  NC_TEST_UDP_PORT   (默认 8799)
"""

import os
import socket
import ssl
import tempfile
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# —— 端口配置（环境变量可覆盖）——
HTTP_PORT = int(os.environ.get("NC_TEST_HTTP_PORT", "8799"))
HTTPS_PORT = int(os.environ.get("NC_TEST_HTTPS_PORT", "8443"))
UDP_PORT = int(os.environ.get("NC_TEST_UDP_PORT", "8799"))

# UDP 单次最多接收字节数
_UDP_BUFSIZE = 65535


class _OkHandler(BaseHTTPRequestHandler):
    """极简处理器：GET/HEAD 都回 200 + body 'ok'。"""

    # 关掉 BaseHTTPRequestHandler 默认往 stderr 打的每请求访问日志
    def log_message(self, fmt, *args):  # noqa: A002 - 签名需与父类一致
        return

    def _respond(self, with_body: bool):
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if with_body:
            try:
                self.wfile.write(body)
            except Exception:
                pass

    def do_GET(self):
        self._respond(with_body=True)

    def do_HEAD(self):
        self._respond(with_body=False)


def _make_self_signed_pem():
    """现场生成 RSA 私钥 + 自签 x509 证书，返回 (key_pem, cert_pem) 两段 bytes。

    用 cryptography 库；CN=termrat-agent，有效期约 10 年。失败时抛异常由调用方处理。
    """
    # 延迟导入：即使没装 cryptography，也只影响 HTTPS，不影响 HTTP/UDP
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "termrat-agent")])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))  # ~10 年
        .sign(key, hashes.SHA256())
    )

    key_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    return key_pem, cert_pem


def _build_tls_context():
    """生成自签证书并构造 SSLContext。

    把 key+cert 写入临时文件后用 load_cert_chain 加载（加载完即删临时文件）。
    任何环节失败都抛出，由 _serve_https 捕获并跳过 HTTPS。
    """
    key_pem, cert_pem = _make_self_signed_pem()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)

    key_path = cert_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".key", delete=False
        ) as kf:
            kf.write(key_pem)
            key_path = kf.name
        with tempfile.NamedTemporaryFile(
            suffix=".crt", delete=False
        ) as cf:
            cf.write(cert_pem)
            cert_path = cf.name
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
    finally:
        for p in (key_path, cert_path):
            if p:
                try:
                    os.remove(p)
                except OSError:
                    pass
    return ctx


def _serve_http():
    """HTTP 服务线程体。"""
    try:
        httpd = ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), _OkHandler)
        print(f"[testserver] HTTP listening on 0.0.0.0:{HTTP_PORT}")
        httpd.serve_forever()
    except Exception as e:
        print(f"[testserver] HTTP server error (skipped): {e}")


def _serve_https():
    """HTTPS 服务线程体；证书生成失败则跳过，不崩溃。"""
    try:
        ctx = _build_tls_context()
    except Exception as e:
        print(f"[testserver] HTTPS cert/setup failed (skipped): {e}")
        return
    try:
        httpd = ThreadingHTTPServer(("0.0.0.0", HTTPS_PORT), _OkHandler)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        print(f"[testserver] HTTPS listening on 0.0.0.0:{HTTPS_PORT}")
        httpd.serve_forever()
    except Exception as e:
        print(f"[testserver] HTTPS server error (skipped): {e}")


def _serve_udp_echo():
    """UDP echo 服务线程体：收到什么原样回什么。"""
    sock = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("0.0.0.0", UDP_PORT))
        print(f"[testserver] UDP echo listening on 0.0.0.0:{UDP_PORT}")
        while True:
            try:
                data, addr = sock.recvfrom(_UDP_BUFSIZE)
                sock.sendto(data, addr)
            except Exception as e:
                # 单次收发出错不退出循环，继续服务
                print(f"[testserver] UDP echo recv/send error: {e}")
    except Exception as e:
        print(f"[testserver] UDP echo server error (skipped): {e}")
    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass


def start_test_servers():
    """启动 HTTP/HTTPS/UDP 三个测试服务（守护线程），立即返回。

    全程容错：任一服务起不来只打日志，绝不影响 agent 主流程。
    """
    try:
        targets = (
            ("testserver-http", _serve_http),
            ("testserver-https", _serve_https),
            ("testserver-udp", _serve_udp_echo),
        )
        for tname, fn in targets:
            t = threading.Thread(target=fn, name=tname, daemon=True)
            t.start()
        print(
            "[testserver] started "
            f"(http:{HTTP_PORT} https:{HTTPS_PORT} udp:{UDP_PORT})"
        )
    except Exception as e:
        print(f"[testserver] failed to start test servers: {e}")


if __name__ == "__main__":
    # 直接运行用于本地冒烟：起服务后阻塞，方便手动 curl / UDP 测试
    start_test_servers()
    threading.Event().wait()
