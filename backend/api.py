"""ONC — REST API（Blueprint，挂在 /api 下）

- 公开（无鉴权）：/public/overview、/public/node/<id>(+/history)、/public/task/<id>(+/history)
- 鉴权：/auth/login|logout|me（登录得 session token，Bearer 携带）
- 管理（admin：session admin 角色 或 静态 X-Admin-Token）：nodes/tasks/users/channels/settings 增删改
- 登录可见（任意角色）：/alerts/history
- agent（节点 token，Bearer）：/agent/tasks、/agent/report
"""
import hmac
import os
from functools import wraps

from flask import Blueprint, g, jsonify, request

import db

api_bp = Blueprint("api", __name__)
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
REPORT_INTERVAL = int(os.environ.get("REPORT_INTERVAL", "10"))
PROTOCOLS = ("icmp", "tcp", "udp", "http", "dns")


def _public_node(n):
    n = dict(n)
    n.pop("token_hash", None)
    n["region"] = n.get("label_1") or ""
    n["tags"] = [t for t in (n.get("label_1"), n.get("label_2"), n.get("label_3")) if t]
    return n


def _hidden_ip_name_map():
    """脱敏：返回 {public_ip: name}，仅含 public_hidden=1 的节点（用于把内部目标 IP 换成节点名）。"""
    m = {}
    for n in db.list_nodes():
        if n.get("public_hidden") and n.get("public_ip"):
            m[n["public_ip"]] = n["name"]
    return m


def _mask_addr(addr, hmap):
    """把目标地址里出现的"我方隐藏节点 IP"替换成节点名；对外目标(非我方节点)原样不动。"""
    if addr:
        for ip, name in hmap.items():
            if ip in addr:
                return addr.replace(ip, name)
    return addr


def _int_or(v, default):
    if v is None or v == "":
        return default
    return int(v)


def _num_or_none(v):
    if v is None or v == "":
        return None
    return float(v)


def _clamp_minutes(v):
    try:
        m = int(v) if v is not None else 30
    except (TypeError, ValueError):
        m = 30
    return min(max(m, 1), 1440)


def _bearer():
    auth = request.headers.get("Authorization", "")
    return auth[7:].strip() if auth.startswith("Bearer ") else ""


def _static_admin_ok():
    return ADMIN_TOKEN and hmac.compare_digest(request.headers.get("X-Admin-Token", ""), ADMIN_TOKEN)


def require_admin(f):
    @wraps(f)
    def w(*a, **k):
        if _static_admin_ok():
            g.user = {"id": "admin-token", "username": "admin", "role": "admin"}
            return f(*a, **k)
        u = db.get_session_user(_bearer())
        if u and u["role"] == "admin":
            g.user = u
            return f(*a, **k)
        return jsonify({"error": "unauthorized"}), 401
    return w


def require_auth(f):
    """任意已登录用户（含 readonly）。"""
    @wraps(f)
    def w(*a, **k):
        if _static_admin_ok():
            g.user = {"id": "admin-token", "username": "admin", "role": "admin"}
            return f(*a, **k)
        u = db.get_session_user(_bearer())
        if u:
            g.user = u
            return f(*a, **k)
        return jsonify({"error": "unauthorized"}), 401
    return w


def require_node(f):
    @wraps(f)
    def w(*a, **k):
        token = _bearer() or request.headers.get("X-Node-Token", "")
        node = db.get_node_by_token(token) if token else None
        if not node:
            return jsonify({"error": "invalid node token"}), 401
        g.node = node
        return f(*a, **k)
    return w


# ----------------------------- 鉴权 -----------------------------
@api_bp.post("/auth/login")
def auth_login():
    b = request.get_json(silent=True) or {}
    u = db.get_user_by_name((b.get("username") or "").strip())
    if not u or not db.verify_password(b.get("password") or "", u["password_hash"]):
        return jsonify({"error": "用户名或密码错误"}), 401
    token = db.create_session(u["id"])
    return jsonify({"token": token, "user": {"username": u["username"], "role": u["role"]}})


@api_bp.post("/auth/logout")
def auth_logout():
    t = _bearer()
    if t:
        db.delete_session(t)
    return jsonify({"ok": True})


@api_bp.get("/auth/me")
@require_auth
def auth_me():
    return jsonify({"user": g.user})


# ----------------------------- 公开 -----------------------------
@api_bp.get("/public/overview")
def public_overview():
    data = db.get_overview()
    # 脱敏：被标记隐藏的节点 → 屏蔽其 IP；指向这些节点的探测目标用节点名替换（对外目标不变）
    hmap = {}
    for n in data["nodes"]:
        if n.get("public_hidden") and n.get("public_ip"):
            hmap[n["public_ip"]] = n["name"]
        if n.get("public_hidden"):
            n["public_ip"] = None
    if hmap:
        for t in data["tasks"]:
            t["target_address"] = _mask_addr(t.get("target_address"), hmap)
    data["nodes"] = [_public_node(n) for n in data["nodes"]]
    data["site"] = {k: db.get_settings().get(k) for k in ("site_title", "site_subtitle")}
    return jsonify(data)


@api_bp.get("/public/node/<nid>")
def public_node_detail(nid):
    n = db.get_node(nid)
    if not n:
        return jsonify({"error": "not found"}), 404
    hmap = _hidden_ip_name_map()
    if n.get("public_hidden"):
        n["public_ip"] = None
    n = _public_node(n)
    n["status"] = db._effective_status(n)
    tasks = db.list_tasks(source_node_id=nid)
    if hmap:
        for t in tasks:
            t["target_address"] = _mask_addr(t.get("target_address"), hmap)
    return jsonify({"node": n, "tasks": tasks})


@api_bp.get("/public/task/<tid>")
def public_task_detail(tid):
    t = db.get_task(tid)
    if not t:
        return jsonify({"error": "not found"}), 404
    t["target_address"] = _mask_addr(t.get("target_address"), _hidden_ip_name_map())
    return jsonify({"task": t})


@api_bp.get("/public/node/<nid>/history")
def public_node_history(nid):
    return jsonify({"history": db.get_node_history(nid, _clamp_minutes(request.args.get("minutes")))})


@api_bp.get("/public/task/<tid>/history")
def public_task_history(tid):
    # ?range=30m|1h|6h|24h|3d|7d|14d|30d → 分桶聚合（均匀点 + 元信息）；否则 ?minutes= 原始点
    rng = request.args.get("range")
    if rng:
        return jsonify(db.get_task_history_bucketed(tid, rng))
    return jsonify({"history": db.get_task_history(tid, _clamp_minutes(request.args.get("minutes")))})


# ----------------------------- 节点（admin）-----------------------------
@api_bp.post("/nodes")
@require_admin
def admin_create_node():
    b = request.get_json(silent=True) or {}
    name = (b.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    node = db.create_node(name, b.get("label_1", ""), b.get("label_2", ""), b.get("label_3", ""))
    return jsonify(node), 201  # 含一次性 token


@api_bp.get("/nodes")
@require_admin
def admin_list_nodes():
    return jsonify({"nodes": [_public_node(n) for n in db.list_nodes()]})


@api_bp.patch("/nodes/<nid>")
@require_admin
def admin_update_node(nid):
    db.update_node(nid, **(request.get_json(silent=True) or {}))
    return jsonify({"ok": True})


@api_bp.delete("/nodes/<nid>")
@require_admin
def admin_delete_node(nid):
    db.delete_node(nid)
    return jsonify({"ok": True})


@api_bp.post("/nodes/<nid>/token")
@require_admin
def admin_regen_token(nid):
    if not db.get_node(nid):
        return jsonify({"error": "not found"}), 404
    return jsonify({"token": db.regenerate_node_token(nid)})


# ----------------------------- 任务（admin）-----------------------------
@api_bp.post("/tasks")
@require_admin
def admin_create_task():
    b = request.get_json(silent=True) or {}
    for f in ("name", "source_node_id", "protocol"):
        if not b.get(f):
            return jsonify({"error": f"{f} required"}), 400
    if b["protocol"] not in PROTOCOLS:
        return jsonify({"error": "protocol must be one of " + "/".join(PROTOCOLS)}), 400
    try:
        tid = db.create_task(
            b["name"], b["source_node_id"], b["protocol"],
            target_address=b.get("target_address"), target_type=b.get("target_type", "external"),
            target_node_id=b.get("target_node_id"), target_port=_int_or(b.get("target_port"), None),
            interval=_int_or(b.get("interval"), 5), timeout=_int_or(b.get("timeout"), 5),
            alert_latency_threshold=_num_or_none(b.get("alert_latency_threshold")),
            alert_loss_threshold=_num_or_none(b.get("alert_loss_threshold")),
            alert_fail_count=_int_or(b.get("alert_fail_count"), None),
            alert_trigger_count=_int_or(b.get("alert_trigger_count"), 3),
            alert_recovery_count=_int_or(b.get("alert_recovery_count"), 3),
            alert_cooldown=_int_or(b.get("alert_cooldown"), 300),
        )
    except (TypeError, ValueError):
        return jsonify({"error": "数值字段格式错误"}), 400
    return jsonify({"id": tid}), 201


@api_bp.get("/tasks")
@require_admin
def admin_list_tasks():
    return jsonify({"tasks": db.list_tasks()})


@api_bp.patch("/tasks/<tid>")
@require_admin
def admin_update_task(tid):
    db.update_task(tid, **(request.get_json(silent=True) or {}))
    return jsonify({"ok": True})


@api_bp.delete("/tasks/<tid>")
@require_admin
def admin_delete_task(tid):
    db.delete_task(tid)
    return jsonify({"ok": True})


# ----------------------------- 用户（admin）-----------------------------
@api_bp.get("/users")
@require_admin
def admin_list_users():
    return jsonify({"users": db.list_users()})


@api_bp.post("/users")
@require_admin
def admin_create_user():
    b = request.get_json(silent=True) or {}
    username = (b.get("username") or "").strip()
    password = b.get("password") or ""
    role = b.get("role", "readonly")
    if not username or not password:
        return jsonify({"error": "username/password required"}), 400
    if role not in ("admin", "readonly"):
        return jsonify({"error": "role must be admin/readonly"}), 400
    if db.get_user_by_name(username):
        return jsonify({"error": "用户名已存在"}), 409
    uid = db.create_user(username, password, role=role, created_by=g.user["username"])
    return jsonify({"id": uid}), 201


@api_bp.delete("/users/<uid>")
@require_admin
def admin_delete_user(uid):
    if not db.delete_user(uid):
        return jsonify({"error": "无法删除（至少保留一个管理员，或用户不存在）"}), 400
    return jsonify({"ok": True})


@api_bp.post("/users/<uid>/reset-password")
@require_admin
def admin_reset_password(uid):
    b = request.get_json(silent=True) or {}
    if not b.get("password"):
        return jsonify({"error": "password required"}), 400
    db.reset_user_password(uid, b["password"])
    return jsonify({"ok": True})


# ----------------------------- 告警渠道（admin）-----------------------------
@api_bp.get("/channels")
@require_admin
def admin_list_channels():
    return jsonify({"channels": db.list_channels()})


@api_bp.post("/channels")
@require_admin
def admin_create_channel():
    b = request.get_json(silent=True) or {}
    if not b.get("name") or not b.get("url"):
        return jsonify({"error": "name/url required"}), 400
    return jsonify({"id": db.create_channel(b["name"], b["url"])}), 201


@api_bp.patch("/channels/<cid>")
@require_admin
def admin_update_channel(cid):
    db.update_channel(cid, **(request.get_json(silent=True) or {}))
    return jsonify({"ok": True})


@api_bp.delete("/channels/<cid>")
@require_admin
def admin_delete_channel(cid):
    db.delete_channel(cid)
    return jsonify({"ok": True})


# ----------------------------- 设置（admin）-----------------------------
@api_bp.get("/settings")
@require_admin
def admin_get_settings():
    return jsonify({"settings": db.get_settings()})


@api_bp.put("/settings")
@require_admin
def admin_put_settings():
    return jsonify({"settings": db.update_settings(request.get_json(silent=True) or {})})


# ----------------------------- 告警历史（登录可见）-----------------------------
@api_bp.get("/alerts/history")
@require_auth
def alerts_history():
    limit = min(max(_int_or(request.args.get("limit"), 100), 1), 500)
    return jsonify({"history": db.list_alert_history(limit)})


# ----------------------------- agent -----------------------------
def _resolve_target(t):
    if t.get("target_type") == "internal" and t.get("target_node_id"):
        tn = db.get_node(t["target_node_id"])
        if tn and (tn.get("public_ip") or tn.get("private_ip")):
            return tn.get("public_ip") or tn.get("private_ip")
    return t.get("target_address")


@api_bp.get("/agent/tasks")
@require_node
def agent_tasks():
    node = g.node
    tasks = db.list_tasks(source_node_id=node["id"])
    out = [{
        "id": t["id"], "name": t["name"], "protocol": t["protocol"],
        "target": _resolve_target(t), "port": t["target_port"],
        "timeout": t["timeout"], "interval": t["interval"], "enabled": bool(t["enabled"]),
    } for t in tasks if t["enabled"]]
    return jsonify({
        "node": {"id": node["id"], "name": node["name"]},
        "report_interval": REPORT_INTERVAL,
        "tasks": out,
    })


@api_bp.post("/agent/report")
@require_node
def agent_report():
    node = g.node
    b = request.get_json(silent=True) or {}
    db.record_heartbeat(
        node["id"], resources=b.get("resources"),
        agent_version=b.get("agent_version"),
        public_ip=b.get("public_ip") or request.remote_addr,
        private_ip=b.get("private_ip"),
    )
    results = b.get("results") or []
    stored = db.insert_results(node["id"], results)
    # 告警评估（对本次上报涉及的任务）+ 异步 webhook 通知
    if results:
        events = db.evaluate_alerts([r.get("task_id") for r in results if r.get("task_id")])
        db.notify_channels(events)
    return jsonify({"ok": True, "stored": stored})
