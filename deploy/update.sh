#!/usr/bin/env bash
# ============================================================
# ONC · 真·更新（热替换，非重装）
#   git pull 最新源码 → 仅重建前端 → docker cp 进运行中的 center 容器
#   → 装新依赖 → 重启容器。不重建整镜像（不重拉基础层），数据卷不动。
# 用法（在中心服务器上）：
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/update.sh | sudo bash
# 可选：TNC_DIR=/opt/nc-center/src  TNC_NAME=nc-center
# 注：若某次更新涉及无法热装的底层变更，按提示改用 install-center.sh 重建镜像。
# ============================================================
set -euo pipefail

DIR="${TNC_DIR:-/opt/nc-center/src}"
NAME="${TNC_NAME:-nc-center}"
say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { echo "未检测到 Docker。"; exit 1; }
docker inspect "$NAME" >/dev/null 2>&1 || { echo "未找到容器 $NAME，请先用 install-center.sh 安装。"; exit 1; }
[ -d "$DIR/.git" ] || { echo "源码目录 $DIR 不存在（git），请先用 install-center.sh。"; exit 1; }

OLD="$(docker exec "$NAME" cat /app/VERSION 2>/dev/null | tr -d '[:space:]' || echo '?')"

say "拉取最新源码 ..."
git -C "$DIR" fetch --depth 1 origin main
git -C "$DIR" reset --hard origin/main
NEW="$(tr -d '[:space:]' < "$DIR/VERSION")"

if [ "$OLD" = "$NEW" ]; then
  say "已是最新 v$NEW，无需更新。"
  exit 0
fi
say "v$OLD → v$NEW，开始热更新 ..."

say "重建前端（临时 node 容器，node_modules 复用）..."
docker run --rm -v "$DIR/frontend":/fe -w /fe node:20-slim \
  sh -c "npm install --registry=https://registry.npmmirror.com --no-audit --no-fund && npm run build"

say "热替换代码到容器 $NAME ..."
docker cp "$DIR/backend/." "$NAME":/app/
docker cp "$DIR/VERSION" "$NAME":/app/VERSION
docker exec "$NAME" sh -c 'rm -rf /app/static/*'
docker cp "$DIR/frontend/dist/." "$NAME":/app/static/

say "安装/校验后端依赖（仅新增项会真正安装）..."
docker exec "$NAME" pip install --no-cache-dir -r /app/requirements.txt >/dev/null 2>&1 \
  || { echo "⚠ 依赖安装失败，可能涉及底层变更——请改用 install-center.sh 重建镜像。"; exit 1; }

say "重启 center ..."
docker restart "$NAME" >/dev/null
sleep 6

RUN="$(curl -fsS -m 6 http://127.0.0.1:8080/api/health 2>/dev/null | sed -n 's/.*\"version\":\"\([^\"]*\)\".*/\1/p' || echo '?')"
if [ "$RUN" = "$NEW" ]; then
  say "✅ 已更新到 v$NEW（运行中已确认）。浏览器硬刷一次即可看到最新界面。"
else
  say "⚠ 已尝试更新到 v$NEW，但健康检查返回 v$RUN，请查看 docker logs $NAME。"
fi
