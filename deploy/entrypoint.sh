#!/bin/sh
# TermRat-NC center 容器入口：先据 DB 设置生成 Caddyfile，再起 supervisord（gunicorn+caddy）。
set -e

mkdir -p /app/data /app/data/certs /app/data/caddy-data /etc/caddy

# 据 DB 当前设置生成 Caddyfile（失败不阻断，下面有兜底）
python3 /app/gen_caddyfile.py || echo "[entrypoint] gen_caddyfile 失败，使用兜底 HTTP 配置"

# 兜底：若没有 Caddyfile，写一个最简 HTTP 反代，保证 web 可访问
if [ ! -f /etc/caddy/Caddyfile ]; then
  printf '{\n\tauto_https off\n\tadmin localhost:2019\n}\n\n:%s {\n\treverse_proxy localhost:8080\n}\n' "${WEB_HTTP_PORT:-80}" > /etc/caddy/Caddyfile
  echo "[entrypoint] 已写入兜底 Caddyfile (HTTP:${WEB_HTTP_PORT:-80})"
fi

exec supervisord -c /etc/supervisord.conf
