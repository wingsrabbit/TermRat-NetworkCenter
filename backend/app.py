"""ONC — 后端（v0.1 脚手架）
单进程 Flask：① 服务构建后的前端静态资源（SPA）② /api/health ③ 初始化 SQLite。
后续增量在此基础上加 REST API、agent 上报接口等。
"""
import os
import sqlite3

from flask import Flask, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(BASE_DIR, "static"))
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))
DB_PATH = os.path.join(DATA_DIR, "nc.sqlite")


def read_version():
    for p in (os.path.join(BASE_DIR, "VERSION"), os.path.join(BASE_DIR, "..", "VERSION")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            continue
    return os.environ.get("APP_VERSION", "0.0.0")


VERSION = read_version()


def init_db():
    """初始化 SQLite（建库 + 元信息表）。后续增量在此扩展业务表。"""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)")
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '0')"
        )
        conn.commit()
    finally:
        conn.close()


app = Flask(__name__, static_folder=None)


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "name": "ONC", "version": VERSION})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    """静态文件命中则返回，否则回落 index.html（前端为 hash 路由的 SPA）。"""
    if path.startswith("api/"):
        return jsonify({"error": "not found"}), 404
    candidate = os.path.join(STATIC_DIR, path)
    if path and os.path.isfile(candidate):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, "index.html")


# 模块导入即初始化（gunicorn 多 worker 下幂等安全）
init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
