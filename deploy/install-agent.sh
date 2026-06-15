#!/usr/bin/env bash
# ============================================================
# ONC · Slave(agent) installer / 探针(agent) 一键安装
#   Auto: install Docker → pull source → build agent image → run.
# Usage / 用法 (-s center agent URL, -t node token, from admin Nodes page):
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-agent.sh \
#     | sudo bash -s -- -s http://MASTER_IP:8080 -t NODE_TOKEN
#   Optional: TNC_TEST_HTTP_PORT=8799  TNC_TEST_HTTPS_PORT=8443  TNC_TEST_UDP_PORT=8799
# ============================================================
set -euo pipefail

# —— Language: Chinese system → 中文, otherwise English ——
_loc="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
case "$_loc" in zh*|*zh_CN*|*zh*) NC_LANG=zh ;; *) NC_LANG=en ;; esac
L() { [ "$NC_LANG" = zh ] && printf '%s' "$1" || printf '%s' "$2"; }

REPO="${TNC_REPO:-https://github.com/wingsrabbit/ONC.git}"
DIR="${TNC_DIR:-/opt/onc/src}"
IMAGE="nc-agent:latest"
NAME="nc-agent"
SERVER=""
TOKEN=""
HTTP_P="${TNC_TEST_HTTP_PORT:-8799}"
HTTPS_P="${TNC_TEST_HTTPS_PORT:-8443}"
UDP_P="${TNC_TEST_UDP_PORT:-8799}"

say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    -s|--server) SERVER="${2:-}"; shift 2 ;;
    -t|--token)  TOKEN="${2:-}";  shift 2 ;;
    *) echo "$(L "未知参数：$1" "Unknown arg: $1")"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ] || [ -z "$TOKEN" ]; then
  echo "$(L '用法：install-agent.sh -s http://MASTER_IP:8080 -t NODE_TOKEN' 'Usage: install-agent.sh -s http://MASTER_IP:8080 -t NODE_TOKEN')"
  echo "$(L '（-s 与 -t 来自管理端「节点管理 → 新增节点」）' '(-s and -t come from the admin Nodes page → Add node)')"
  exit 1
fi

say "$(L "▶ 部署【探针 agent】——上报至 ${SERVER}（这是被监控机；中心 master 请用 install-center.sh）" "▶ Installing [agent] — reports to ${SERVER} (this is a monitored host; for the master use install-center.sh)")"
say "$(L '1/4 检查 Docker ...' '1/4 Checking Docker ...')"
if ! command -v docker >/dev/null 2>&1; then
  say "$(L '    未检测到 Docker，自动安装中（get.docker.com）...' '    Docker not found, installing (get.docker.com) ...')"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker 2>/dev/null || true
fi

say "$(L "2/4 获取源码 -> $DIR" "2/4 Fetching source -> $DIR")"
mkdir -p "$(dirname "$DIR")"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin main && git -C "$DIR" reset --hard origin/main
else
  git clone --depth 1 "$REPO" "$DIR"
fi

say "$(L "3/4 构建 agent 镜像 $IMAGE ..." "3/4 Building agent image $IMAGE ...")"
# root context + -f agent/Dockerfile (to COPY top-level VERSION)
docker build -f "$DIR/agent/Dockerfile" -t "$IMAGE" "$DIR"

say "$(L '4/4 启动 agent 容器 ...' '4/4 Starting agent container ...')"
docker rm -f "$NAME" >/dev/null 2>&1 || true
# --network host: probes/test servers need real netstack; --pid host + NET_RAW: host metrics + ICMP
docker run -d --name "$NAME" --restart unless-stopped \
  --network host --pid host --cap-add NET_RAW \
  -e NC_SERVER="$SERVER" -e NC_TOKEN="$TOKEN" \
  -e NC_TEST_HTTP_PORT="$HTTP_P" -e NC_TEST_HTTPS_PORT="$HTTPS_P" -e NC_TEST_UDP_PORT="$UDP_P" \
  "$IMAGE"

sleep 3
say "$(L '完成。最近日志：' 'Done. Recent logs:')"
docker logs --tail 6 "$NAME" 2>&1 || true

if [ "$NC_LANG" = zh ]; then
cat <<EOF

============================================================
 ✅ agent 已启动，约 10s 后该节点会在管理端「节点管理」转为在线。
    上报中心 : ${SERVER}
    互测端口 : HTTP ${HTTP_P} / HTTPS ${HTTPS_P} / UDP ${UDP_P}
 排查：docker logs -f ${NAME}   |   重启：docker restart ${NAME}
============================================================
EOF
else
cat <<EOF

============================================================
 ✅ agent started; the node turns online in the admin Nodes page in ~10s.
    Reports to : ${SERVER}
    Test ports : HTTP ${HTTP_P} / HTTPS ${HTTPS_P} / UDP ${UDP_P}
 Debug: docker logs -f ${NAME}   |   Restart: docker restart ${NAME}
============================================================
EOF
fi
