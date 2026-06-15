# ============================================================
# ONC center — 单镜像多阶段
#   阶段1 构建前端(Vite/React) → 阶段2 Python 运行后端(gunicorn)
#   + 内嵌 Caddy 作 web 前置(HTTP:80 / HTTPS:443，反代 gunicorn:8080)
#   supervisord 同容器拉起 gunicorn + caddy
# ============================================================

# ---- 阶段 1：构建前端 ----
FROM node:20-slim AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 阶段 2：取 Caddy 二进制 ----
FROM caddy:2 AS caddybin

# ---- 阶段 3：运行后端 + Caddy + supervisord ----
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# Caddy 二进制（静态，自带 ACME/Let's Encrypt 能力）
COPY --from=caddybin /usr/bin/caddy /usr/bin/caddy

COPY backend/ ./
COPY VERSION ./VERSION
COPY --from=frontend /fe/dist ./static
COPY deploy/supervisord.conf /etc/supervisord.conf
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV STATIC_DIR=/app/static \
    DATA_DIR=/app/data \
    PYTHONUNBUFFERED=1 \
    WEB_HTTP_PORT=80 \
    WEB_HTTPS_PORT=443 \
    XDG_DATA_HOME=/app/data/caddy-data \
    XDG_CONFIG_HOME=/app/data/caddy-data

# 80/443 = 浏览器 web（Caddy）；8080 = agent 上报 + 管理兜底（gunicorn 直连）
EXPOSE 80 443 8080
VOLUME ["/app/data"]

ENTRYPOINT ["/entrypoint.sh"]
