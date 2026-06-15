#!/usr/bin/env bash
# ============================================================
# ONC · Update (hot, not reinstall) / 真·更新（热替换，非重装）
#   git pull → rebuild frontend only → docker cp into the running container
#   → install deps → restart. No full image rebuild; data volume untouched.
# Usage / 用法 (run on the center host):
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/update.sh | sudo bash
#   Optional: TNC_DIR=/opt/onc/src  TNC_NAME=nc-center
# ============================================================
set -euo pipefail

# —— Language: Chinese system → 中文, otherwise English ——
_loc="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
case "$_loc" in zh*|*zh_CN*|*zh*) NC_LANG=zh ;; *) NC_LANG=en ;; esac
L() { [ "$NC_LANG" = zh ] && printf '%s' "$1" || printf '%s' "$2"; }

DIR="${TNC_DIR:-/opt/onc/src}"
NAME="${TNC_NAME:-nc-center}"
say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { echo "$(L '未检测到 Docker。' 'Docker not found.')"; exit 1; }
docker inspect "$NAME" >/dev/null 2>&1 || { echo "$(L "未找到容器 ${NAME}，请先用 install-center.sh 安装。" "Container ${NAME} not found; install with install-center.sh first.")"; exit 1; }
[ -d "$DIR/.git" ] || { echo "$(L "源码目录 ${DIR} 不存在（git），请先用 install-center.sh。" "Source dir ${DIR} (git) missing; use install-center.sh first.")"; exit 1; }

OLD="$(docker exec "$NAME" cat /app/VERSION 2>/dev/null | tr -d '[:space:]' || echo '?')"

say "$(L '拉取最新源码 ...' 'Pulling latest source ...')"
git -C "$DIR" fetch --depth 1 origin main
git -C "$DIR" reset --hard origin/main
NEW="$(tr -d '[:space:]' < "$DIR/VERSION")"

if [ "$OLD" = "$NEW" ]; then
  say "$(L "已是最新 v${NEW}，无需更新。" "Already up to date (v${NEW}).")"
  exit 0
fi
say "$(L "v${OLD} → v${NEW}，开始热更新 ..." "v${OLD} → v${NEW}, hot-updating ...")"

say "$(L '重建前端（临时 node 容器，node_modules 复用）...' 'Rebuilding frontend (temp node container) ...')"
docker run --rm -v "$DIR/frontend":/fe -w /fe node:20-slim \
  sh -c "npm install --registry=https://registry.npmmirror.com --no-audit --no-fund && npm run build"

say "$(L "热替换代码到容器 ${NAME} ..." "Hot-swapping code into ${NAME} ...")"
docker cp "$DIR/backend/." "$NAME":/app/
docker cp "$DIR/VERSION" "$NAME":/app/VERSION
docker exec "$NAME" sh -c 'rm -rf /app/static/*'
docker cp "$DIR/frontend/dist/." "$NAME":/app/static/

say "$(L '安装/校验后端依赖（仅新增项会真正安装）...' 'Installing/verifying backend deps ...')"
docker exec "$NAME" pip install --no-cache-dir -r /app/requirements.txt >/dev/null 2>&1 \
  || { echo "$(L '⚠ 依赖安装失败，可能涉及底层变更——请改用 install-center.sh 重建镜像。' '⚠ Dependency install failed (low-level change?); use install-center.sh to rebuild the image.')"; exit 1; }

say "$(L '重启 center ...' 'Restarting center ...')"
docker restart "$NAME" >/dev/null
sleep 6

RUN="$(curl -fsS -m 6 http://127.0.0.1:8080/api/health 2>/dev/null | sed -n 's/.*\"version\":\"\([^\"]*\)\".*/\1/p' || echo '?')"
if [ "$RUN" = "$NEW" ]; then
  say "$(L "✅ 已更新到 v${NEW}（运行中已确认）。浏览器硬刷一次即可看到最新界面。" "✅ Updated to v${NEW} (confirmed running). Hard-refresh your browser to see the new UI.")"
else
  say "$(L "⚠ 已尝试更新到 v${NEW}，但健康检查返回 v${RUN}，请查看 docker logs ${NAME}。" "⚠ Tried to update to v${NEW} but health reports v${RUN}; check docker logs ${NAME}.")"
fi
