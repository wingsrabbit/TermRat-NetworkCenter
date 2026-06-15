"""ONC — 数据层（SQLite，标准库 sqlite3，无 ORM，刻意做简）

实体：
- nodes      节点（agent 主机）：含 token 哈希 + 最新资源快照
- tasks      探测任务：源节点 + 协议 + 目标 + 间隔
- results    探测结果时序（每次探测一行）
- resources  节点资源时序（每次心跳一行）
- meta       元信息（schema_version、last_prune）
时间戳：时序与 last_seen 用 epoch 毫秒（INTEGER）；created_at 用本地可读字符串。
在线/离线在“读时计算”（按 last_seen），不在公开读路径写库。
"""
import hashlib
import hmac
import json
import os
import secrets
import threading
import urllib.request
import sqlite3
import time
import uuid
from contextlib import contextmanager

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
DB_PATH = os.path.join(DATA_DIR, "nc.sqlite")

OFFLINE_AFTER_SEC = int(os.environ.get("OFFLINE_AFTER_SEC", "60"))  # 超过此秒数无心跳判离线
RETAIN_DAYS = int(os.environ.get("RETAIN_DAYS", "3"))               # 时序保留天数


def now_ms() -> int:
    return int(time.time() * 1000)


def now_str() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")     # 锁等待最多 5s，避免 SQLITE_BUSY 直接 500
    conn.execute("PRAGMA synchronous=NORMAL")    # WAL 下安全，降低 fsync 开销
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


SCHEMA = """
CREATE TABLE IF NOT EXISTS nodes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    token_hash    TEXT NOT NULL UNIQUE,
    label_1       TEXT DEFAULT '',
    label_2       TEXT DEFAULT '',
    label_3       TEXT DEFAULT '',
    enabled       INTEGER DEFAULT 1,
    public_hidden INTEGER DEFAULT 0,
    status        TEXT DEFAULT 'offline',
    last_seen     INTEGER,
    agent_version TEXT,
    public_ip     TEXT,
    private_ip    TEXT,
    cpu           REAL, mem REAL, disk REAL, load REAL,
    net_in        REAL, net_out REAL, uptime_days REAL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    source_node_id TEXT NOT NULL,
    protocol       TEXT NOT NULL,                 -- icmp/tcp/udp/http/dns
    target_type    TEXT DEFAULT 'external',       -- external/internal
    target_address TEXT,
    target_node_id TEXT,
    target_port    INTEGER,
    interval       INTEGER DEFAULT 5,
    timeout        INTEGER DEFAULT 5,
    enabled        INTEGER DEFAULT 1,
    alert_latency_threshold REAL,
    alert_loss_threshold    REAL,
    alert_fail_count        INTEGER,
    alert_trigger_count     INTEGER DEFAULT 3,
    alert_recovery_count    INTEGER DEFAULT 3,
    alert_cooldown          INTEGER DEFAULT 300,
    alert_status            TEXT DEFAULT 'normal',
    alert_last_ts           INTEGER,
    created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_node_id);

CREATE TABLE IF NOT EXISTS results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT NOT NULL,
    ts          INTEGER NOT NULL,
    latency     REAL, packet_loss REAL, jitter REAL, success INTEGER,
    dns_time    REAL, tcp_time REAL, tls_time REAL, ttfb REAL, total_time REAL,
    status_code INTEGER, resolved_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_results_task_ts ON results(task_id, ts);

CREATE TABLE IF NOT EXISTS resources (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    ts      INTEGER NOT NULL,
    cpu     REAL, mem REAL, disk REAL, load REAL,
    net_in  REAL, net_out REAL, uptime_days REAL
);
CREATE INDEX IF NOT EXISTS idx_resources_node_ts ON resources(node_id, ts);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'admin',          -- admin/readonly
    created_at    TEXT NOT NULL,
    created_by    TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_channels (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    type       TEXT DEFAULT 'webhook',
    url        TEXT,
    enabled    INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      TEXT,
    task_name    TEXT,
    event_type   TEXT,                            -- alert/recovery
    metric       TEXT,                            -- latency/loss/fail
    actual_value REAL,
    threshold    REAL,
    notified     INTEGER DEFAULT 0,
    ts           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_alert_history_ts ON alert_history(ts);
"""


# 老库迁移：tasks 新增的告警列
_TASK_MIGRATE_COLS = [
    ("alert_latency_threshold", "REAL"), ("alert_loss_threshold", "REAL"),
    ("alert_fail_count", "INTEGER"), ("alert_trigger_count", "INTEGER DEFAULT 3"),
    ("alert_recovery_count", "INTEGER DEFAULT 3"), ("alert_cooldown", "INTEGER DEFAULT 300"),
    ("alert_status", "TEXT DEFAULT 'normal'"), ("alert_last_ts", "INTEGER"),
]

# 老库迁移：nodes 新增列
_NODE_MIGRATE_COLS = [
    ("public_hidden", "INTEGER DEFAULT 0"),
]


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with get_conn() as c:
        c.execute("PRAGMA journal_mode=WAL")     # 仅在初始化时设一次（持久化于 db 文件）
        c.executescript(SCHEMA)
        c.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '2')")
        for col, typ in _TASK_MIGRATE_COLS:      # 老库补列
            try:
                c.execute(f"ALTER TABLE tasks ADD COLUMN {col} {typ}")
            except sqlite3.OperationalError:
                pass
        for col, typ in _NODE_MIGRATE_COLS:
            try:
                c.execute(f"ALTER TABLE nodes ADD COLUMN {col} {typ}")
            except sqlite3.OperationalError:
                pass
    _ensure_default_admin()


def _ensure_default_admin():
    """仅当显式提供 INITIAL_ADMIN_USER + INITIAL_ADMIN_PASSWORD（无人值守部署）时播种管理员；
    否则保持 0 用户 → 首次打开管理端进入「初次安装向导」自行设置。"""
    u = (os.environ.get("INITIAL_ADMIN_USER") or "").strip()
    p = os.environ.get("INITIAL_ADMIN_PASSWORD") or ""
    if not u or not p:
        return
    with get_conn() as c:
        n = c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    if n == 0:
        create_user(u, p, role="admin", created_by="system")


def _effective_status(row):
    """按 last_seen 实时判定在线/离线（读时计算，不写库）。"""
    ls = row.get("last_seen")
    if ls and ls >= now_ms() - OFFLINE_AFTER_SEC * 1000:
        return "online"
    return "offline"


# ----------------------------- 节点 -----------------------------
def create_node(name, label_1="", label_2="", label_3=""):
    """创建节点，返回 {id, token}（token 仅此一次明文返回）。"""
    nid = gen_id("n")
    token = secrets.token_urlsafe(24)
    with get_conn() as c:
        c.execute(
            "INSERT INTO nodes (id, name, token_hash, label_1, label_2, label_3, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (nid, name, hash_token(token), label_1, label_2, label_3, now_str()),
        )
    return {"id": nid, "name": name, "token": token}


def list_nodes():
    with get_conn() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM nodes ORDER BY created_at").fetchall()]
    for n in rows:
        n["status"] = _effective_status(n)   # 读时计算
    return rows


def get_node(nid):
    with get_conn() as c:
        r = c.execute("SELECT * FROM nodes WHERE id=?", (nid,)).fetchone()
    return dict(r) if r else None


def get_node_by_token(token):
    if not token:
        return None
    with get_conn() as c:
        r = c.execute("SELECT * FROM nodes WHERE token_hash=?", (hash_token(token),)).fetchone()
    return dict(r) if r else None


def update_node(nid, **fields):
    allowed = {"name", "label_1", "label_2", "label_3", "enabled", "public_hidden"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if not sets:
        return
    cols = ", ".join(f"{k}=?" for k in sets)
    with get_conn() as c:
        c.execute(f"UPDATE nodes SET {cols} WHERE id=?", (*sets.values(), nid))


def delete_node(nid):
    with get_conn() as c:
        tids = [r["id"] for r in c.execute("SELECT id FROM tasks WHERE source_node_id=?", (nid,)).fetchall()]
        for tid in tids:
            c.execute("DELETE FROM results WHERE task_id=?", (tid,))
        c.execute("DELETE FROM tasks WHERE source_node_id=?", (nid,))
        c.execute("DELETE FROM resources WHERE node_id=?", (nid,))
        c.execute("DELETE FROM nodes WHERE id=?", (nid,))


def regenerate_node_token(nid):
    """重置节点 token，返回新的明文 token（部署 agent 用）。"""
    token = secrets.token_urlsafe(24)
    with get_conn() as c:
        c.execute("UPDATE nodes SET token_hash=? WHERE id=?", (hash_token(token), nid))
    return token


# ----------------------------- 任务 -----------------------------
def create_task(name, source_node_id, protocol, target_address=None, target_type="external",
                target_node_id=None, target_port=None, interval=5, timeout=5,
                alert_latency_threshold=None, alert_loss_threshold=None, alert_fail_count=None,
                alert_trigger_count=3, alert_recovery_count=3, alert_cooldown=300):
    tid = gen_id("t")
    with get_conn() as c:
        c.execute(
            "INSERT INTO tasks (id, name, source_node_id, protocol, target_type, target_address, "
            "target_node_id, target_port, interval, timeout, alert_latency_threshold, alert_loss_threshold, "
            "alert_fail_count, alert_trigger_count, alert_recovery_count, alert_cooldown, created_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (tid, name, source_node_id, protocol, target_type, target_address,
             target_node_id, target_port, interval, timeout, alert_latency_threshold, alert_loss_threshold,
             alert_fail_count, alert_trigger_count, alert_recovery_count, alert_cooldown, now_str()),
        )
    return tid


def update_task(tid, **f):
    allowed = {"name", "interval", "timeout", "enabled", "alert_latency_threshold",
               "alert_loss_threshold", "alert_fail_count", "alert_trigger_count",
               "alert_recovery_count", "alert_cooldown"}
    sets = {k: v for k, v in f.items() if k in allowed}
    if not sets:
        return
    cols = ", ".join(f"{k}=?" for k in sets)
    with get_conn() as c:
        c.execute(f"UPDATE tasks SET {cols} WHERE id=?", (*sets.values(), tid))


def list_tasks(source_node_id=None):
    q = "SELECT * FROM tasks"
    args = ()
    if source_node_id:
        q += " WHERE source_node_id=?"
        args = (source_node_id,)
    q += " ORDER BY created_at"
    with get_conn() as c:
        return [dict(r) for r in c.execute(q, args).fetchall()]


def get_task(tid):
    with get_conn() as c:
        r = c.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
    return dict(r) if r else None


def delete_task(tid):
    with get_conn() as c:
        c.execute("DELETE FROM results WHERE task_id=?", (tid,))
        c.execute("DELETE FROM tasks WHERE id=?", (tid,))


# --------------------------- 上报 / 心跳 ---------------------------
_RES_FIELDS = ("cpu", "mem", "disk", "load", "net_in", "net_out", "uptime_days")
_RESULT_FIELDS = ("latency", "packet_loss", "jitter", "success", "dns_time", "tcp_time",
                  "tls_time", "ttfb", "total_time", "status_code", "resolved_ip")


def record_heartbeat(nid, resources=None, agent_version=None, public_ip=None, private_ip=None):
    """更新节点最新快照 + status='online' + last_seen，并写一行资源时序。"""
    ts = now_ms()
    res = {k: (resources or {}).get(k) for k in _RES_FIELDS}
    with get_conn() as c:
        c.execute(
            "UPDATE nodes SET status='online', last_seen=?, agent_version=COALESCE(?,agent_version), "
            "public_ip=COALESCE(?,public_ip), private_ip=COALESCE(?,private_ip), "
            "cpu=?, mem=?, disk=?, load=?, net_in=?, net_out=?, uptime_days=? WHERE id=?",
            (ts, agent_version, public_ip, private_ip,
             res["cpu"], res["mem"], res["disk"], res["load"],
             res["net_in"], res["net_out"], res["uptime_days"], nid),
        )
        if resources:
            c.execute(
                "INSERT INTO resources (node_id, ts, cpu, mem, disk, load, net_in, net_out, uptime_days) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (nid, ts, res["cpu"], res["mem"], res["disk"], res["load"],
                 res["net_in"], res["net_out"], res["uptime_days"]),
            )
    maybe_prune()  # 节流清理挂在已鉴权的上报路径，不影响公开读


def insert_results(node_id, results):
    """批量写入探测结果。仅接受属于该节点的任务，防止越权写他人任务。"""
    if not results:
        return 0
    with get_conn() as c:
        own = {r["id"] for r in c.execute(
            "SELECT id FROM tasks WHERE source_node_id=?", (node_id,)).fetchall()}
        rows = []
        for item in results:
            tid = item.get("task_id")
            if tid not in own:
                continue
            ts = int(item.get("ts") or now_ms())
            vals = []
            for f in _RESULT_FIELDS:
                v = item.get(f)
                if f == "success" and v is not None:
                    v = 1 if v else 0
                vals.append(v)
            rows.append((tid, ts, *vals))
        if rows:
            c.executemany(
                "INSERT INTO results (task_id, ts, latency, packet_loss, jitter, success, dns_time, "
                "tcp_time, tls_time, ttfb, total_time, status_code, resolved_ip) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                rows,
            )
    return len(rows)


# ----------------------------- 保留清理 -----------------------------
def prune_old(days=None):
    days = RETAIN_DAYS if days is None else days
    cutoff = now_ms() - days * 86400 * 1000
    with get_conn() as c:
        c.execute("DELETE FROM results WHERE ts < ?", (cutoff,))
        c.execute("DELETE FROM resources WHERE ts < ?", (cutoff,))


def maybe_prune(min_interval_sec=3600):
    """节流：距上次清理超过 min_interval 才真正清，避免每次心跳都删。"""
    with get_conn() as c:
        row = c.execute("SELECT value FROM meta WHERE key='last_prune'").fetchone()
        last = int(row["value"]) if row and row["value"] else 0
        if now_ms() - last < min_interval_sec * 1000:
            return
        c.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_prune', ?)", (str(now_ms()),))
    prune_old()


# ----------------------------- 查询 -----------------------------
def get_overview():
    """公开总览：节点（含最新快照）+ 任务（含最新结果 + 近 24 点延迟 spark）+ 汇总。
    在线/离线读时计算，不写库。"""
    nodes = list_nodes()
    with get_conn() as c:
        for n in nodes:
            sp = c.execute(
                "SELECT cpu FROM resources WHERE node_id=? AND cpu IS NOT NULL "
                "ORDER BY ts DESC LIMIT 24", (n["id"],)).fetchall()
            n["spark"] = [row["cpu"] for row in reversed(sp)]   # 节点 CPU 趋势
        tasks = [dict(r) for r in c.execute("SELECT * FROM tasks ORDER BY created_at").fetchall()]
        for t in tasks:
            last = c.execute(
                "SELECT * FROM results WHERE task_id=? ORDER BY ts DESC LIMIT 1", (t["id"],)).fetchone()
            t["latest"] = dict(last) if last else None
            sp = c.execute(
                "SELECT latency FROM results WHERE task_id=? AND latency IS NOT NULL "
                "ORDER BY ts DESC LIMIT 24", (t["id"],)).fetchall()
            t["spark"] = [row["latency"] for row in reversed(sp)]
    summary = {
        "nodes_total": len(nodes),
        "online": sum(1 for n in nodes if n["status"] == "online"),
        "offline": sum(1 for n in nodes if n["status"] == "offline"),
        "tasks_total": len(tasks),
        "alerting": sum(1 for t in tasks if t.get("alert_status") == "alerting"),
    }
    return {"nodes": nodes, "tasks": tasks, "summary": summary}


def get_node_history(nid, minutes=30):
    cutoff = now_ms() - minutes * 60 * 1000
    with get_conn() as c:
        rows = c.execute(
            "SELECT ts, cpu, mem, disk, load, net_in, net_out FROM resources "
            "WHERE node_id=? AND ts>=? ORDER BY ts", (nid, cutoff)).fetchall()
    return [dict(r) for r in rows]


def get_task_history(tid, minutes=30):
    cutoff = now_ms() - minutes * 60 * 1000
    with get_conn() as c:
        rows = c.execute(
            "SELECT ts, latency, packet_loss, jitter, success, status_code, ttfb FROM results "
            "WHERE task_id=? AND ts>=? ORDER BY ts", (tid, cutoff)).fetchall()
    return [dict(r) for r in rows]


# 各时间档 → (窗口秒, 分桶秒)；分桶后每档约 60–96 个均匀点，长档不再被 24h 卡死
_RANGE_BUCKETS = {
    "30m": (1800, 30), "1h": (3600, 60), "6h": (21600, 300), "24h": (86400, 900),
    "3d": (259200, 3600), "7d": (604800, 7200), "14d": (1209600, 14400), "30d": (2592000, 28800),
}


def _bucket_unit_label(sec):
    if sec < 60:
        return "%d秒" % sec
    if sec < 3600:
        return "%d分钟" % (sec // 60)
    if sec < 86400:
        return "%d小时" % (sec // 3600)
    return "%d天" % (sec // 86400)


def get_task_history_bucketed(tid, range_key):
    """按时间档分桶聚合历史：每桶取均值（延迟/抖动/丢包）+ 成功率，时间戳对齐到桶起点。
    返回 {history, bucket_seconds, buckets_total, buckets_with_data, unit}。"""
    window, bucket = _RANGE_BUCKETS.get(range_key, _RANGE_BUCKETS["1h"])
    bucket_ms = bucket * 1000
    cutoff = now_ms() - window * 1000
    with get_conn() as c:
        rows = c.execute(
            "SELECT (ts/?)*? AS b, AVG(latency) lat, AVG(jitter) jit, AVG(packet_loss) loss, "
            "AVG(success)*100.0 sr, COUNT(*) n FROM results "
            "WHERE task_id=? AND ts>=? GROUP BY b ORDER BY b",
            (bucket_ms, bucket_ms, tid, cutoff)).fetchall()
    hist = [{
        "ts": int(r["b"]),
        "latency": round(r["lat"], 3) if r["lat"] is not None else None,
        "jitter": round(r["jit"], 3) if r["jit"] is not None else None,
        "packet_loss": round(r["loss"], 3) if r["loss"] is not None else None,
        "success_ratio": round(r["sr"], 1) if r["sr"] is not None else None,
        "samples": r["n"],
    } for r in rows]
    return {
        "history": hist,
        "bucket_seconds": bucket,
        "buckets_total": window // bucket,
        "buckets_with_data": len(hist),
        "unit": _bucket_unit_label(bucket),
    }


# ========================= 用户 / 会话 / 鉴权 =========================
def hash_password(pw):
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), salt, 100_000)
    return "pbkdf2$" + salt.hex() + "$" + dk.hex()


def verify_password(pw, stored):
    try:
        _, salt_hex, dk_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(salt_hex), 100_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def create_user(username, password, role="admin", created_by=None):
    uid = gen_id("u")
    with get_conn() as c:
        c.execute("INSERT INTO users (id, username, password_hash, role, created_at, created_by) "
                  "VALUES (?,?,?,?,?,?)", (uid, username, hash_password(password), role, now_str(), created_by))
    return uid


def get_user_by_name(username):
    with get_conn() as c:
        r = c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    return dict(r) if r else None


def list_users():
    with get_conn() as c:
        return [{"id": r["id"], "username": r["username"], "role": r["role"],
                 "created_at": r["created_at"], "created_by": r["created_by"]}
                for r in c.execute("SELECT * FROM users ORDER BY created_at").fetchall()]


def count_users():
    with get_conn() as c:
        return c.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]


def delete_user(uid):
    with get_conn() as c:
        u = c.execute("SELECT role FROM users WHERE id=?", (uid,)).fetchone()
        if not u:
            return False
        if u["role"] == "admin":
            admins = c.execute("SELECT COUNT(*) AS n FROM users WHERE role='admin'").fetchone()["n"]
            if admins <= 1:
                return False  # 至少保留一个管理员
        c.execute("DELETE FROM users WHERE id=?", (uid,))
        c.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
    return True


def reset_user_password(uid, password):
    with get_conn() as c:
        c.execute("UPDATE users SET password_hash=? WHERE id=?", (hash_password(password), uid))


SESSION_TTL_SEC = 7 * 86400


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    now = now_ms()
    with get_conn() as c:
        c.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)",
                  (hash_token(token), user_id, now, now + SESSION_TTL_SEC * 1000))
    return token


def get_session_user(token):
    if not token:
        return None
    with get_conn() as c:
        r = c.execute("SELECT s.expires_at, u.id, u.username, u.role FROM sessions s "
                      "JOIN users u ON u.id = s.user_id WHERE s.token_hash=?", (hash_token(token),)).fetchone()
    if not r or r["expires_at"] < now_ms():
        return None
    return {"id": r["id"], "username": r["username"], "role": r["role"]}


def delete_session(token):
    with get_conn() as c:
        c.execute("DELETE FROM sessions WHERE token_hash=?", (hash_token(token),))


# ===================== 告警渠道 / 历史 / 设置 =====================
def create_channel(name, url, type="webhook"):
    cid = gen_id("c")
    with get_conn() as c:
        c.execute("INSERT INTO alert_channels (id, name, type, url, created_at) VALUES (?,?,?,?,?)",
                  (cid, name, type, url, now_str()))
    return cid


def list_channels():
    with get_conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM alert_channels ORDER BY created_at").fetchall()]


def update_channel(cid, **f):
    allowed = {"name", "url", "enabled"}
    sets = {k: v for k, v in f.items() if k in allowed}
    if not sets:
        return
    cols = ", ".join(f"{k}=?" for k in sets)
    with get_conn() as c:
        c.execute(f"UPDATE alert_channels SET {cols} WHERE id=?", (*sets.values(), cid))


def delete_channel(cid):
    with get_conn() as c:
        c.execute("DELETE FROM alert_channels WHERE id=?", (cid,))


def list_alert_history(limit=100):
    with get_conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM alert_history ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()]


DEFAULT_SETTINGS = {
    "site_title": "ONC 网络状态中心",
    "site_subtitle": "实时服务器资源监控 · 网络质量探测",
    "data_retention_days": RETAIN_DAYS,
    "global_alert_cooldown": 300,
    "default_probe_interval": 5,
    "default_probe_timeout": 5,
    # Web 前置 / HTTPS（由内嵌 Caddy 落地，见 webserver.py）
    "web_mode": "http",            # http | https-le | https-custom | https-selfsigned
    "web_domain": "",             # https-le 必填；https-custom/selfsigned 可选
    "web_email": "",              # Let's Encrypt 通知邮箱（可选）
    "web_http_port": 80,
    "web_https_port": 443,
}


def get_settings():
    s = dict(DEFAULT_SETTINGS)
    with get_conn() as c:
        for r in c.execute("SELECT key, value FROM meta WHERE substr(key,1,4)='set_'").fetchall():
            k = r["key"][4:]
            try:
                s[k] = json.loads(r["value"])
            except Exception:
                s[k] = r["value"]
    return s


def update_settings(d):
    with get_conn() as c:
        for k, v in d.items():
            c.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?,?)", ("set_" + k, json.dumps(v)))
    return get_settings()


# ============================ 告警引擎 ============================
def evaluate_alerts(task_ids):
    """对给定任务评估告警：连续 trigger 次越阈→触发，连续 recovery 次正常→恢复。
    写 alert_history、更新 task.alert_status，返回需通知的事件列表。"""
    events = []
    now = now_ms()
    with get_conn() as c:
        for tid in set(task_ids):
            row = c.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
            if not row:
                continue
            t = dict(row)
            lat_th, loss_th, fail_n = (t.get("alert_latency_threshold"),
                                       t.get("alert_loss_threshold"), t.get("alert_fail_count"))
            if lat_th is None and loss_th is None and fail_n is None:
                continue
            trig = t.get("alert_trigger_count") or 3
            rec = t.get("alert_recovery_count") or 3
            rows = c.execute("SELECT latency, packet_loss, success FROM results WHERE task_id=? "
                             "ORDER BY ts DESC LIMIT ?", (tid, max(trig, rec))).fetchall()
            recent = [dict(r) for r in rows]
            if len(recent) < trig:
                continue

            def breach(r):
                if lat_th is not None and r["latency"] is not None and r["latency"] > lat_th:
                    return ("latency", r["latency"], lat_th)
                if loss_th is not None and r["packet_loss"] is not None and r["packet_loss"] > loss_th:
                    return ("loss", r["packet_loss"], loss_th)
                if fail_n is not None and not r["success"]:
                    return ("fail", 0, fail_n)
                return None

            cur = t.get("alert_status") or "normal"
            cooldown = (t.get("alert_cooldown") or 300) * 1000
            last_ts = t.get("alert_last_ts") or 0
            first = [breach(r) for r in recent[:trig]]
            if cur != "alerting" and all(b is not None for b in first) and now - last_ts >= cooldown:
                m, val, th = first[0]
                c.execute("UPDATE tasks SET alert_status='alerting', alert_last_ts=? WHERE id=?", (now, tid))
                c.execute("INSERT INTO alert_history (task_id, task_name, event_type, metric, actual_value, "
                          "threshold, ts) VALUES (?,?,?,?,?,?,?)", (tid, t["name"], "alert", m, val, th, now))
                events.append({"type": "alert", "task": t["name"], "metric": m, "value": val, "threshold": th})
            elif cur == "alerting" and len(recent) >= rec and all(breach(r) is None for r in recent[:rec]):
                c.execute("UPDATE tasks SET alert_status='normal', alert_last_ts=? WHERE id=?", (now, tid))
                c.execute("INSERT INTO alert_history (task_id, task_name, event_type, metric, actual_value, "
                          "threshold, ts) VALUES (?,?,?,?,?,?,?)",
                          (tid, t["name"], "recovery", "latency", recent[0]["latency"] or 0, lat_th or 0, now))
                events.append({"type": "recovery", "task": t["name"]})
    return events


def notify_channels(events):
    """把告警事件异步推送到所有启用的 webhook 渠道（best-effort，不阻塞上报）。"""
    if not events:
        return
    channels = [ch for ch in list_channels() if ch.get("enabled")]
    if not channels:
        return

    def _send():
        for ev in events:
            if ev["type"] == "alert":
                text = f"🔴 [ONC 告警] {ev['task']} 触发：{ev['metric']}={ev['value']} 超阈值 {ev['threshold']}"
            else:
                text = f"🟢 [ONC 恢复] {ev['task']} 已恢复正常"
            payload = json.dumps({"msgtype": "text", "text": {"content": text}, "content": text}).encode("utf-8")
            for ch in channels:
                try:
                    req = urllib.request.Request(ch["url"], data=payload,
                                                 headers={"Content-Type": "application/json"}, method="POST")
                    urllib.request.urlopen(req, timeout=5)
                except Exception:
                    pass

    threading.Thread(target=_send, daemon=True).start()
