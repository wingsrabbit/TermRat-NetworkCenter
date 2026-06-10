"""ONC — REST API（Blueprint，挂在 /api 下）

- 公开（无鉴权）：/api/public/overview、/api/public/node/<id>/history、/api/public/task/<id>/history
- 管理（X-Admin-Token）：/api/nodes、/api/tasks 的增删查
- agent（节点 token，Authorization: Bearer）：/api/agent/tasks、/api/agent/report
"""
import os
from functools import wraps

from flask import Blueprint, g, jsonify, request

import db

api_bp = Blueprint("api", __name__)
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
REPORT_INTERVAL = int(os.environ.get("REPORT_INTERVAL", "10"))


def _public_node(n):
    n = dict(n)
    n.pop("token_hash", None)
    n["region"] = n.get("label_1") or ""
    n["tags"] = [t for t in (n.get("label_1"), n.get("label_2"), n.get("label_3")) if t]
    return n


def require_admin(f):
    @wraps(f)
    def w(*a, **k):
        if not ADMIN_TOKEN:
            return jsonify({"error": "admin API 未启用（后端未设置 ADMIN_TOKEN）"}), 503
        if request.headers.get("X-Admin-Token") != ADMIN_TOKEN:
            return jsonify({"error": "unauthorized"}), 401
        return f(*a, **k)
    return w


def require_node(f):
    @wraps(f)
    def w(*a, **k):
        auth = request.headers.get("Authorization", "")
        token = auth[7:].strip() if auth.startswith("Bearer ") else request.headers.get("X-Node-Token", "")
        node = db.get_node_by_token(token) if token else None
        if not node:
            return jsonify({"error": "invalid node token"}), 401
        g.node = node
        return f(*a, **k)
    return w


# ----------------------------- 公开 -----------------------------
@api_bp.get("/public/overview")
def public_overview():
    data = db.get_overview()
    data["nodes"] = [_public_node(n) for n in data["nodes"]]
    return jsonify(data)


@api_bp.get("/public/node/<nid>/history")
def public_node_history(nid):
    minutes = request.args.get("minutes", 30, type=int)
    return jsonify({"history": db.get_node_history(nid, minutes)})


@api_bp.get("/public/task/<tid>/history")
def public_task_history(tid):
    minutes = request.args.get("minutes", 30, type=int)
    return jsonify({"history": db.get_task_history(tid, minutes)})


# ----------------------------- 管理 -----------------------------
@api_bp.post("/nodes")
@require_admin
def admin_create_node():
    b = request.get_json(silent=True) or {}
    name = (b.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    node = db.create_node(name, b.get("label_1", ""), b.get("label_2", ""), b.get("label_3", ""))
    return jsonify(node), 201  # 含明文 token，仅此一次


@api_bp.get("/nodes")
@require_admin
def admin_list_nodes():
    return jsonify({"nodes": [_public_node(n) for n in db.list_nodes()]})


@api_bp.delete("/nodes/<nid>")
@require_admin
def admin_delete_node(nid):
    db.delete_node(nid)
    return jsonify({"ok": True})


@api_bp.post("/tasks")
@require_admin
def admin_create_task():
    b = request.get_json(silent=True) or {}
    for f in ("name", "source_node_id", "protocol"):
        if not b.get(f):
            return jsonify({"error": f"{f} required"}), 400
    tid = db.create_task(
        b["name"], b["source_node_id"], b["protocol"],
        target_address=b.get("target_address"), target_type=b.get("target_type", "external"),
        target_node_id=b.get("target_node_id"), target_port=b.get("target_port"),
        interval=int(b.get("interval", 5)), timeout=int(b.get("timeout", 5)),
    )
    return jsonify({"id": tid}), 201


@api_bp.get("/tasks")
@require_admin
def admin_list_tasks():
    return jsonify({"tasks": db.list_tasks()})


@api_bp.delete("/tasks/<tid>")
@require_admin
def admin_delete_task(tid):
    db.delete_task(tid)
    return jsonify({"ok": True})


# ----------------------------- agent -----------------------------
def _resolve_target(t):
    """内部目标：解析为目标节点的 IP；外部目标：直接用地址。"""
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
    stored = db.insert_results(node["id"], b.get("results") or [])
    return jsonify({"ok": True, "stored": stored})
