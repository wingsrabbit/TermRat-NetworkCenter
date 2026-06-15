"""ONC — Web 前置（内嵌 Caddy）TLS / HTTPS 管理。

架构：单容器内 gunicorn 监听 :8080（agent 直连上报、也是兜底访问口），
Caddy 作为前置反代占 web 端口（默认 HTTP:80 / 开启 HTTPS 则 443），把浏览器流量
反代到 localhost:8080。HTTPS 模式由管理后台「系统设置」切换：

  - http            纯 HTTP（默认），Caddy 监听 :WEB_HTTP_PORT
  - https-le        Let's Encrypt 自动签发（需域名解析到本机 + 80/443 可达）
  - https-custom    使用上传的自有证书（/app/data/certs/web.crt + web.key）
  - https-selfsigned 内部 CA 自签（适合纯 IP 测试，浏览器会有不受信任告警）

切换时后端重写 Caddyfile 并 `caddy reload`（原子校验：新配置非法则保持旧配置不变，
不会中断访问）。无论何种模式，gunicorn :8080 始终可直连，作为管理兜底 + agent 上报口。
"""
import os
import subprocess

DATA_DIR = os.environ.get("DATA_DIR", "/app/data")
CADDYFILE_PATH = os.environ.get("CADDYFILE_PATH", "/etc/caddy/Caddyfile")
CERT_DIR = os.path.join(DATA_DIR, "certs")
CADDY_ADMIN = os.environ.get("CADDY_ADMIN", "localhost:2019")
UPSTREAM = os.environ.get("WEB_UPSTREAM", "localhost:8080")

CERT_PATH = os.path.join(CERT_DIR, "web.crt")     # 上传的自有证书（https-custom）
KEY_PATH = os.path.join(CERT_DIR, "web.key")
SELF_CERT = os.path.join(CERT_DIR, "self.crt")    # 自生成的自签证书（https-selfsigned）
SELF_KEY = os.path.join(CERT_DIR, "self.key")

VALID_MODES = ("http", "https-le", "https-custom", "https-selfsigned")


def ensure_selfsigned_cert(host=None):
    """生成自签证书（若不存在）。用显式 cert/key 而非 Caddy `tls internal`，
    可对任意 SNI（含纯 IP 访问）出示同一张证书，浏览器告警后仍可访问。返回 (cert, key)。"""
    if os.path.isfile(SELF_CERT) and os.path.isfile(SELF_KEY):
        return SELF_CERT, SELF_KEY
    os.makedirs(CERT_DIR, exist_ok=True)
    import ipaddress
    from datetime import datetime, timedelta, timezone
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    pkey = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cn = host or "ONC"
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    sans = [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
    if host:
        try:
            sans.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            sans.append(x509.DNSName(host))
    cert = (x509.CertificateBuilder()
            .subject_name(name).issuer_name(name)
            .public_key(pkey.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
            .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
            .add_extension(x509.SubjectAlternativeName(sans), critical=False)
            .sign(pkey, hashes.SHA256()))
    with open(SELF_CERT, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    with open(SELF_KEY, "wb") as f:
        f.write(pkey.private_bytes(serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption()))
    try:
        os.chmod(SELF_KEY, 0o600)
    except OSError:
        pass
    return SELF_CERT, SELF_KEY


def _http_port(s):
    return str(s.get("web_http_port") or os.environ.get("WEB_HTTP_PORT", "80"))


def _https_port(s):
    return str(s.get("web_https_port") or os.environ.get("WEB_HTTPS_PORT", "443"))


def has_custom_cert():
    return os.path.isfile(CERT_PATH) and os.path.isfile(KEY_PATH)


def generate_caddyfile(s):
    """依据设置生成 Caddyfile 文本。"""
    mode = (s.get("web_mode") or "http").strip()
    domain = (s.get("web_domain") or "").strip()
    email = (s.get("web_email") or "").strip()
    hp = _http_port(s)
    sp = _https_port(s)

    if mode == "https-le" and domain:
        glb = "{\n\tadmin %s\n" % CADDY_ADMIN
        if email:
            glb += "\temail %s\n" % email
        glb += "}\n\n"
        # Caddy 自动签发 + 自动 80→443 跳转
        return glb + "%s {\n\treverse_proxy %s\n}\n" % (domain, UPSTREAM)

    if mode == "https-custom" and has_custom_cert():
        site = domain if domain else (":" + sp)
        glb = "{\n\tadmin %s\n}\n\n" % CADDY_ADMIN
        body = "%s {\n\ttls %s %s\n\treverse_proxy %s\n}\n" % (site, CERT_PATH, KEY_PATH, UPSTREAM)
        if domain:  # 有域名时补一个 80→443 跳转
            body += "\nhttp://%s {\n\tredir https://{host}{uri}\n}\n" % domain
        return glb + body

    if mode == "https-selfsigned":
        site = domain if domain else (":" + sp)
        glb = "{\n\tadmin %s\n}\n\n" % CADDY_ADMIN
        body = "%s {\n\ttls %s %s\n\treverse_proxy %s\n}\n" % (site, SELF_CERT, SELF_KEY, UPSTREAM)
        body += "\n:%s {\n\tredir https://{host}{uri}\n}\n" % hp
        return glb + body

    # 默认 http（含：选了 https 模式但前置条件未满足时的安全回落）
    glb = "{\n\tauto_https off\n\tadmin %s\n}\n\n" % CADDY_ADMIN
    return glb + ":%s {\n\treverse_proxy %s\n}\n" % (hp, UPSTREAM)


def write_caddyfile(s):
    os.makedirs(os.path.dirname(CADDYFILE_PATH), exist_ok=True)
    if (s.get("web_mode") or "").strip() == "https-selfsigned":
        ensure_selfsigned_cert((s.get("web_domain") or "").strip() or None)
    txt = generate_caddyfile(s)
    with open(CADDYFILE_PATH, "w", encoding="utf-8") as f:
        f.write(txt)
    return txt


def reload_caddy():
    """对运行中的 Caddy 热重载（原子校验：配置非法则保持旧配置，不中断）。
    返回 (ok, message)。Caddy 未运行（如本地无 caddy 命令）时返回 (False, 原因)。"""
    try:
        p = subprocess.run(
            ["caddy", "reload", "--config", CADDYFILE_PATH, "--adapter", "caddyfile"],
            capture_output=True, text=True, timeout=30,
        )
    except FileNotFoundError:
        return False, "未找到 caddy 命令（非容器环境？）"
    except subprocess.TimeoutExpired:
        return False, "caddy reload 超时"
    out = (p.stderr or "") + (p.stdout or "")
    return p.returncode == 0, out.strip()


def apply_settings(s):
    """重写 Caddyfile 并热重载。返回 (ok, message)。"""
    write_caddyfile(s)
    return reload_caddy()


def access_urls(s, host=None):
    """据当前设置给出建议访问地址（用于前端展示）。"""
    mode = (s.get("web_mode") or "http").strip()
    domain = (s.get("web_domain") or "").strip()
    hp = _http_port(s)
    sp = _https_port(s)
    h = domain or host or "<服务器IP>"
    urls = []
    if mode in ("https-le", "https-custom", "https-selfsigned"):
        urls.append("https://%s%s" % (h, "" if sp == "443" else ":" + sp))
    else:
        urls.append("http://%s%s" % (h, "" if hp == "80" else ":" + hp))
    return urls
