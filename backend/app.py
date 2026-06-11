"""ONC — 后端入口（Flask）
单进程：① 服务构建后的前端静态资源（SPA）② REST API（见 api.py）③ 初始化 SQLite。
"""
import os

from flask import Flask, jsonify, send_from_directory

import db
from api import api_bp

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.environ.get("STATIC_DIR", os.path.join(BASE_DIR, "static"))


def read_version():
    for p in (os.path.join(BASE_DIR, "VERSION"), os.path.join(BASE_DIR, "..", "VERSION")):
        try:
            with open(p, "r", encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            continue
    return os.environ.get("APP_VERSION", "0.0.0")


VERSION = read_version()

app = Flask(__name__, static_folder=None)
app.register_blueprint(api_bp, url_prefix="/api")


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "name": "ONC", "version": VERSION})


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    """静态文件命中则返回，否则回落 index.html（前端 hash 路由 SPA）。"""
    if path.startswith("api/"):
        return jsonify({"error": "not found"}), 404
    candidate = os.path.join(STATIC_DIR, path)
    if path and os.path.isfile(candidate):
        resp = send_from_directory(STATIC_DIR, path)
        # 带内容 hash 的构建产物（assets/*）可不可变长缓存
        if path.startswith("assets/"):
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return resp
    # index.html 必须每次回源校验，否则浏览器缓存旧 HTML → 引用旧资源 hash → 看到旧前端
    resp = send_from_directory(STATIC_DIR, "index.html")
    resp.headers["Cache-Control"] = "no-cache"
    return resp


# 导入即初始化（gunicorn 多 worker 幂等安全）
db.init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=os.environ.get("FLASK_DEBUG") == "1")
