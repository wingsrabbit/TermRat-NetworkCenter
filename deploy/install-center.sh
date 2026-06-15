#!/usr/bin/env bash
# ============================================================
# TermRat-NC · Master(center) 一键安装
#   自动：装 Docker(如缺) → 拉源码 → 构建镜像 → 起容器
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/TermRat-NetworkCenter/main/deploy/install-center.sh | sudo bash
# 可选环境变量（默认值见下）：
#   TNC_HTTP_PORT=80  TNC_HTTPS_PORT=443  TNC_AGENT_PORT=8080
#   TNC_ADMIN_USER=admin  TNC_ADMIN_PASS=admin
#   TNC_DATA=/opt/termrat-nc/data  TNC_DIR=/opt/termrat-nc/src
#   TNC_REPO=https://github.com/wingsrabbit/TermRat-NetworkCenter.git
# ============================================================
set -euo pipefail

REPO="${TNC_REPO:-https://github.com/wingsrabbit/TermRat-NetworkCenter.git}"
DIR="${TNC_DIR:-/opt/termrat-nc/src}"
DATA="${TNC_DATA:-/opt/termrat-nc/data}"
IMAGE="termrat-nc:latest"
NAME="nc-center"
HTTP_PORT="${TNC_HTTP_PORT:-80}"
HTTPS_PORT="${TNC_HTTPS_PORT:-443}"
AGENT_PORT="${TNC_AGENT_PORT:-8080}"
ADMIN_USER="${TNC_ADMIN_USER:-admin}"
ADMIN_PASS="${TNC_ADMIN_PASS:-admin}"

say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

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

say "3/4 构建镜像 $IMAGE （首次约 2-3 分钟）..."
docker build -t "$IMAGE" "$DIR"

say "4/4 启动 center 容器 ..."
mkdir -p "$DATA"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  -p "${HTTP_PORT}:80" -p "${HTTPS_PORT}:443" -p "${AGENT_PORT}:8080" \
  -e INITIAL_ADMIN_USER="$ADMIN_USER" -e INITIAL_ADMIN_PASSWORD="$ADMIN_PASS" \
  -v "$DATA:/app/data" "$IMAGE"

sleep 5
IP="$(curl -fsS4 -m 5 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
HP=""; [ "$HTTP_PORT" != "80" ] && HP=":${HTTP_PORT}"
AP=""; [ "$AGENT_PORT" != "80" ] && AP=":${AGENT_PORT}"

cat <<EOF

============================================================
 ✅ TermRat-NC center 已启动
    公开页 : http://${IP}${HP}
    管理端 : http://${IP}${HP}/termadmin   （账号 ${ADMIN_USER} / 密码 ${ADMIN_PASS}）
    Agent口: http://${IP}${AP}              （从机用此地址上报，独立于 web）
------------------------------------------------------------
 下一步：
   1) 登录管理端，建议立即在「用户」里改掉默认密码。
   2)「节点管理 → 新增节点」拿到 Token，到每台从机执行 agent 一键安装：
      curl -fsSL https://raw.githubusercontent.com/wingsrabbit/TermRat-NetworkCenter/main/deploy/install-agent.sh \\
        | sudo bash -s -- -s http://${IP}${AP} -t <该节点Token>
   3) HTTPS：「系统设置 → Web 访问 / HTTPS」（Let's Encrypt / 上传证书 / 自签名）。
============================================================
EOF
