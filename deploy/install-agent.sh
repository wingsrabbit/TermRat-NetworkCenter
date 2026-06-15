#!/usr/bin/env bash
# ============================================================
# TermRat-NC · Slave(agent) 一键安装
#   自动：装 Docker(如缺) → 拉源码 → 构建 agent 镜像 → 起容器
# 用法（-s 中心 agent 地址，-t 节点 Token，均来自管理端「节点管理」）：
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/TermRat-NetworkCenter/main/deploy/install-agent.sh \
#     | sudo bash -s -- -s http://MASTER_IP:8080 -t NODE_TOKEN
# 可选环境变量（自定义 agent 互测端口，避免默认端口被屏蔽）：
#   TNC_TEST_HTTP_PORT=8799  TNC_TEST_HTTPS_PORT=8443  TNC_TEST_UDP_PORT=8799
# ============================================================
set -euo pipefail

REPO="${TNC_REPO:-https://github.com/wingsrabbit/TermRat-NetworkCenter.git}"
DIR="${TNC_DIR:-/opt/termrat-nc/src}"
IMAGE="termrat-nc-agent:latest"
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
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ] || [ -z "$TOKEN" ]; then
  echo "用法：install-agent.sh -s http://MASTER_IP:8080 -t NODE_TOKEN"
  echo "（-s 与 -t 来自管理端「节点管理 → 新增节点」）"
  exit 1
fi

say "1/4 检查 Docker ..."
if ! command -v docker >/dev/null 2>&1; then
  say "    未检测到 Docker，自动安装中（get.docker.com）..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker 2>/dev/null || true
fi

say "2/4 获取源码 -> $DIR"
mkdir -p "$(dirname "$DIR")"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --depth 1 origin main && git -C "$DIR" reset --hard origin/main
else
  git clone --depth 1 "$REPO" "$DIR"
fi

say "3/4 构建 agent 镜像 $IMAGE ..."
# 根上下文 + -f agent/Dockerfile（以便 COPY 顶层 VERSION）
docker build -f "$DIR/agent/Dockerfile" -t "$IMAGE" "$DIR"

say "4/4 启动 agent 容器 ..."
docker rm -f "$NAME" >/dev/null 2>&1 || true
# --network host：探测/测试服需真实网络栈；--pid host + NET_RAW：采主机资源 + ICMP
docker run -d --name "$NAME" --restart unless-stopped \
  --network host --pid host --cap-add NET_RAW \
  -e NC_SERVER="$SERVER" -e NC_TOKEN="$TOKEN" \
  -e NC_TEST_HTTP_PORT="$HTTP_P" -e NC_TEST_HTTPS_PORT="$HTTPS_P" -e NC_TEST_UDP_PORT="$UDP_P" \
  "$IMAGE"

sleep 3
say "完成。最近日志："
docker logs --tail 6 "$NAME" 2>&1 || true
cat <<EOF

============================================================
 ✅ agent 已启动，约 10s 后该节点会在管理端「节点管理」转为在线。
    上报中心 : ${SERVER}
    互测端口 : HTTP ${HTTP_P} / HTTPS ${HTTPS_P} / UDP ${UDP_P}
 排查：docker logs -f ${NAME}   |   重启：docker restart ${NAME}
============================================================
EOF
