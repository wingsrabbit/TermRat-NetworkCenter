#!/usr/bin/env bash
# ============================================================
# ONC · Update (hot, not reinstall) / 真·更新（热替换，非重装）
#   Auto-detects role on THIS host and updates accordingly:
#     · nc-center → git pull → rebuild frontend → docker cp into the
#       running container → install deps → restart (data volume untouched).
#     · nc-agent  → git pull → rebuild agent image → restart with the
#       SAME config (server/token/ports read back from the old container).
#   Works on BOTH the center host and any agent (monitored) host.
# Usage / 用法 (同一条命令，中心 / 探针都适用):
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/update.sh | sudo bash
#   Optional: TNC_DIR=/opt/onc/src
# ============================================================
set -euo pipefail

# —— Language: Chinese system → 中文, otherwise English ——
_loc="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
case "$_loc" in zh*|*zh_CN*|*zh*) NC_LANG=zh ;; *) NC_LANG=en ;; esac
L() { [ "$NC_LANG" = zh ] && printf '%s' "$1" || printf '%s' "$2"; }

DIR="${TNC_DIR:-/opt/onc/src}"
say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || { echo "$(L '未检测到 Docker。' 'Docker not found.')"; exit 1; }

# —— Detect what's installed on this host —— #
HAS_CENTER=0; docker inspect nc-center >/dev/null 2>&1 && HAS_CENTER=1
HAS_AGENT=0;  docker inspect nc-agent  >/dev/null 2>&1 && HAS_AGENT=1
if [ "$HAS_CENTER" = 0 ] && [ "$HAS_AGENT" = 0 ]; then
  echo "$(L '本机未找到 nc-center 或 nc-agent 容器；请先用 install-center.sh（中心）或 install-agent.sh（探针）安装。' \
           'Neither nc-center nor nc-agent found on this host; install first via install-center.sh (center) or install-agent.sh (agent).')"
  exit 1
fi
[ -d "$DIR/.git" ] || { echo "$(L "源码目录 ${DIR} 不存在（git），请先用对应的 install 脚本安装。" "Source dir ${DIR} (git) missing; use the matching install script first.")"; exit 1; }

# —— Pull latest source once (shared by both roles) —— #
say "$(L '拉取最新源码 ...' 'Pulling latest source ...')"
git -C "$DIR" fetch --depth 1 origin main
git -C "$DIR" reset --hard origin/main
NEW="$(tr -d '[:space:]' < "$DIR/VERSION")"

# Read one env var (e.g. NC_TOKEN) back from a running container's config.
# Keeps values intact even when they contain '=' or '/' (URLs, base64 tokens).
ct_env() { docker inspect "$1" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n "s/^$2=//p" | head -1; }

# ------------------------------------------------------------ center
update_center() {
  local NAME=nc-center OLD RUN
  OLD="$(docker exec "$NAME" cat /app/VERSION 2>/dev/null | tr -d '[:space:]' || echo '?')"
  if [ "$OLD" = "$NEW" ]; then
    say "$(L "中心 center 已是最新 v${NEW}，无需更新。" "Center already up to date (v${NEW}).")"
    return 0
  fi
  say "$(L "中心 center：v${OLD} → v${NEW}，开始热更新 ..." "Center: v${OLD} → v${NEW}, hot-updating ...")"

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
    || { echo "$(L '⚠ 依赖安装失败，可能涉及底层变更——请改用 install-center.sh 重建镜像。' '⚠ Dependency install failed (low-level change?); use install-center.sh to rebuild the image.')"; return 1; }

  say "$(L '重启 center ...' 'Restarting center ...')"
  docker restart "$NAME" >/dev/null
  sleep 6
  RUN="$(curl -fsS -m 6 http://127.0.0.1:8080/api/health 2>/dev/null | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' || echo '?')"
  if [ "$RUN" = "$NEW" ]; then
    say "$(L "✅ 中心已更新到 v${NEW}（运行中已确认）。浏览器硬刷一次即可看到最新界面。" "✅ Center updated to v${NEW} (confirmed running). Hard-refresh your browser to see the new UI.")"
  else
    say "$(L "⚠ 已尝试更新到 v${NEW}，但健康检查返回 v${RUN}，请查看 docker logs ${NAME}。" "⚠ Tried to update to v${NEW} but health reports v${RUN}; check docker logs ${NAME}.")"
  fi
}

# ------------------------------------------------------------ agent
update_agent() {
  local NAME=nc-agent OLD SERVER TOKEN HP HSP UP RUNV
  OLD="$(docker exec "$NAME" cat /app/VERSION 2>/dev/null | tr -d '[:space:]' || echo '?')"
  if [ "$OLD" = "$NEW" ]; then
    say "$(L "探针 agent 已是最新 v${NEW}，无需更新。" "Agent already up to date (v${NEW}).")"
    return 0
  fi
  say "$(L "探针 agent：v${OLD} → v${NEW}，重建镜像并按原配置重启 ..." "Agent: v${OLD} → v${NEW}, rebuilding image & restarting with existing config ...")"

  # Recover the original run config from the live container so server/token/ports survive.
  SERVER="$(ct_env "$NAME" NC_SERVER)"; TOKEN="$(ct_env "$NAME" NC_TOKEN)"
  HP="$(ct_env "$NAME" NC_TEST_HTTP_PORT)";   HP="${HP:-8799}"
  HSP="$(ct_env "$NAME" NC_TEST_HTTPS_PORT)"; HSP="${HSP:-8443}"
  UP="$(ct_env "$NAME" NC_TEST_UDP_PORT)";    UP="${UP:-8799}"
  if [ -z "$SERVER" ] || [ -z "$TOKEN" ]; then
    echo "$(L '⚠ 无法从运行中的 agent 容器读出 NC_SERVER / NC_TOKEN，请改用 install-agent.sh 重新安装。' '⚠ Could not read NC_SERVER/NC_TOKEN from the running agent; reinstall via install-agent.sh.')"
    return 1
  fi

  say "$(L '重建 agent 镜像 nc-agent:latest ...' 'Rebuilding agent image nc-agent:latest ...')"
  docker build -f "$DIR/agent/Dockerfile" -t nc-agent:latest "$DIR"

  say "$(L "按原配置重启 ${NAME}（上报 ${SERVER}）..." "Restarting ${NAME} with existing config (reports to ${SERVER}) ...")"
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped \
    --network host --pid host --cap-add NET_RAW \
    -e NC_SERVER="$SERVER" -e NC_TOKEN="$TOKEN" \
    -e NC_TEST_HTTP_PORT="$HP" -e NC_TEST_HTTPS_PORT="$HSP" -e NC_TEST_UDP_PORT="$UP" \
    nc-agent:latest >/dev/null
  sleep 3
  RUNV="$(docker exec "$NAME" cat /app/VERSION 2>/dev/null | tr -d '[:space:]' || echo '?')"
  if [ "$RUNV" = "$NEW" ]; then
    say "$(L "✅ 探针 agent 已更新到 v${NEW}（上报中心 ${SERVER}，约 10s 后回到在线）。" "✅ Agent updated to v${NEW} (reports to ${SERVER}; back online in ~10s).")"
  else
    say "$(L "⚠ 已尝试更新 agent 到 v${NEW}，但容器内为 v${RUNV}，请查看 docker logs ${NAME}。" "⚠ Tried to update agent to v${NEW} but container reports v${RUNV}; check docker logs ${NAME}.")"
  fi
}

[ "$HAS_CENTER" = 1 ] && update_center
[ "$HAS_AGENT"  = 1 ] && update_agent
exit 0
