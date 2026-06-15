#!/usr/bin/env bash
# ============================================================
# ONC · Master(center) installer / 中心(center) 一键安装
#   Auto: install Docker → pull source → build image → run container.
# Usage / 用法:
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-center.sh | sudo bash
# Optional env / 可选环境变量:
#   TNC_HTTP_PORT=80  TNC_HTTPS_PORT=443  TNC_AGENT_PORT=8080
#   TNC_ADMIN_USER=...  TNC_ADMIN_PASS=...   (preset admin, skip wizard)
#   TNC_DATA=/opt/onc/data  TNC_DIR=/opt/onc/src
#   TNC_REPO=https://github.com/wingsrabbit/ONC.git
# ============================================================
set -euo pipefail

# —— Language: Chinese system → 中文, otherwise English ——
_loc="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
case "$_loc" in zh*|*zh_CN*|*zh*) NC_LANG=zh ;; *) NC_LANG=en ;; esac
L() { [ "$NC_LANG" = zh ] && printf '%s' "$1" || printf '%s' "$2"; }

REPO="${TNC_REPO:-https://github.com/wingsrabbit/ONC.git}"
DIR="${TNC_DIR:-/opt/onc/src}"
DATA="${TNC_DATA:-/opt/onc/data}"
IMAGE="nc-center:latest"
NAME="nc-center"
HTTP_PORT="${TNC_HTTP_PORT:-80}"
HTTPS_PORT="${TNC_HTTPS_PORT:-443}"
AGENT_PORT="${TNC_AGENT_PORT:-8080}"
# No preset admin by default → first open shows the setup wizard.
# Only preset (and skip wizard) when TNC_ADMIN_USER + TNC_ADMIN_PASS are set.
ADMIN_USER="${TNC_ADMIN_USER:-}"
ADMIN_PASS="${TNC_ADMIN_PASS:-}"

say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

say "$(L '▶ 部署【中心 master】——若要在被监控机上装【探针 agent】，请改用 install-agent.sh' '▶ Installing [center/master] — to install an [agent] on a monitored host use install-agent.sh')"
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

say "$(L "3/4 构建镜像 $IMAGE （首次约 2-3 分钟）..." "3/4 Building image $IMAGE (first time ~2-3 min) ...")"
docker build -t "$IMAGE" "$DIR"

say "$(L '4/4 启动 center 容器 ...' '4/4 Starting center container ...')"
mkdir -p "$DATA"
docker rm -f "$NAME" >/dev/null 2>&1 || true
ADMIN_ENV=""
if [ -n "$ADMIN_USER" ] && [ -n "$ADMIN_PASS" ]; then
  ADMIN_ENV="-e INITIAL_ADMIN_USER=$ADMIN_USER -e INITIAL_ADMIN_PASSWORD=$ADMIN_PASS"
fi
docker run -d --name "$NAME" --restart unless-stopped \
  -p "${HTTP_PORT}:80" -p "${HTTPS_PORT}:443" -p "${AGENT_PORT}:8080" \
  $ADMIN_ENV \
  -v "$DATA:/app/data" "$IMAGE"

sleep 5
IP="$(curl -fsS4 -m 5 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
HP=""; [ "$HTTP_PORT" != "80" ] && HP=":${HTTP_PORT}"
AP=""; [ "$AGENT_PORT" != "80" ] && AP=":${AGENT_PORT}"

if [ -n "$ADMIN_USER" ]; then
  ADMIN_LINE="$(L "管理端 : http://${IP}${HP}/termadmin   （已预置账号 ${ADMIN_USER}）" "Admin  : http://${IP}${HP}/termadmin   (preset account ${ADMIN_USER})")"
  NEXT1="$(L '1) 登录管理端，建议在「用户」里改密。' '1) Log in; change the password under Users.')"
else
  ADMIN_LINE="$(L "管理端 : http://${IP}${HP}/termadmin   （首次打开进入安装向导，设置管理员账号）" "Admin  : http://${IP}${HP}/termadmin   (first open → setup wizard creates admin)")"
  NEXT1="$(L '1) 打开管理端，按「初次安装向导」设置管理员用户名 / 密码。' '1) Open the admin; use the setup wizard to create admin user/password.')"
fi

if [ "$NC_LANG" = zh ]; then
cat <<EOF

============================================================
 ✅ ONC center 已启动
    公开页 : http://${IP}${HP}
    ${ADMIN_LINE}
    Agent口: http://${IP}${AP}              （从机用此地址上报，独立于 web）
------------------------------------------------------------
 下一步：
   ${NEXT1}
   2)「节点管理 → 新增节点」拿到 Token，到每台从机执行 agent 一键安装：
      curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-agent.sh \\
        | sudo bash -s -- -s http://${IP}${AP} -t <该节点Token>
   3) HTTPS：「系统设置 → Web 访问 / HTTPS」（Let's Encrypt / 上传证书 / 自签名）。
============================================================
EOF
else
cat <<EOF

============================================================
 ✅ ONC center started
    Public : http://${IP}${HP}
    ${ADMIN_LINE}
    Agent  : http://${IP}${AP}              (agents report here; independent of web)
------------------------------------------------------------
 Next:
   ${NEXT1}
   2) Nodes → Add node → copy the Token, then on each monitored host run:
      curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-agent.sh \\
        | sudo bash -s -- -s http://${IP}${AP} -t <NODE_TOKEN>
   3) HTTPS: System Settings → Web / HTTPS (Let's Encrypt / upload cert / self-signed).
============================================================
EOF
fi
