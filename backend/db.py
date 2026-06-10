"""TermRat-NC — 数据层（SQLite，标准库 sqlite3，无 ORM，刻意做简）

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
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
DB_PATH = os.path.join(DATA_DIR, "termrat.sqlite")

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
"""


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with get_conn() as c:
        c.execute("PRAGMA journal_mode=WAL")     # 仅在初始化时设一次（持久化于 db 文件）
        c.executescript(SCHEMA)
        c.execute("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1')")


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
    allowed = {"name", "label_1", "label_2", "label_3", "enabled"}
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


# ----------------------------- 任务 -----------------------------
def create_task(name, source_node_id, protocol, target_address=None, target_type="external",
                target_node_id=None, target_port=None, interval=5, timeout=5):
    tid = gen_id("t")
    with get_conn() as c:
        c.execute(
            "INSERT INTO tasks (id, name, source_node_id, protocol, target_type, target_address, "
            "target_node_id, target_port, interval, timeout, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (tid, name, source_node_id, protocol, target_type, target_address,
             target_node_id, target_port, interval, timeout, now_str()),
        )
    return tid


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
        "alerting": 0,  # 告警引擎后续增量
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
