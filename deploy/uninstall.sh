#!/usr/bin/env bash
# ============================================================
# TermRat-NC · 一键卸载
#   移除 center / agent 容器 + 本程序镜像 + 安装目录（/opt/termrat-nc）。
#   只动本程序自己的东西，不碰机器上其它 Docker 容器；默认保留 Docker。
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/TermRat-NetworkCenter/main/deploy/uninstall.sh | sudo bash
# 选项（追加在末尾，如 … | sudo bash -s -- --purge-docker）：
#   --keep-data      保留 /opt/termrat-nc/data（数据 / 证书），只删容器/镜像/源码
#   --purge-docker   连 Docker 一并卸载（⚠ 仅当 Docker 是为本程序装的、机器上无其它容器时）
# ============================================================
set -eu

KEEP_DATA=0
PURGE_DOCKER=0
for a in "$@"; do
  case "$a" in
    --keep-data)    KEEP_DATA=1 ;;
    --purge-docker) PURGE_DOCKER=1 ;;
    *) echo "未知参数：$a（可用：--keep-data / --purge-docker）"; exit 1 ;;
  esac
done
say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

DIR="${TNC_DIR:-/opt/termrat-nc}"

if command -v docker >/dev/null 2>&1; then
  say "停止并删除容器：nc-center / nc-agent ..."
  docker rm -f nc-center nc-agent >/dev/null 2>&1 || true
  say "删除本程序镜像（termrat-nc*）..."
  IMGS="$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -E '^termrat-nc' || true)"
  [ -n "$IMGS" ] && docker rmi -f $IMGS >/dev/null 2>&1 || true
else
  say "未检测到 Docker，跳过容器 / 镜像清理。"
fi

if [ "$KEEP_DATA" = "1" ]; then
  say "保留数据目录 $DIR/data；删除源码 $DIR/src ..."
  rm -rf "$DIR/src" || true
else
  say "删除安装目录 $DIR（含数据 / 证书）..."
  rm -rf "$DIR" || true
fi

if [ "$PURGE_DOCKER" = "1" ] && command -v docker >/dev/null 2>&1; then
  say "卸载 Docker（--purge-docker）..."
  systemctl disable --now docker.service docker.socket containerd.service >/dev/null 2>&1 || true
  PKGS="$(dpkg -l 2>/dev/null | awk '/^ii/ && ($2 ~ /docker/ || $2 ~ /containerd/) {print $2}' | tr '\n' ' ')"
  if [ -n "$PKGS" ]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get purge -y $PKGS >/dev/null 2>&1 || true
    apt-get autoremove -y --purge >/dev/null 2>&1 || true
  fi
  rm -rf /var/lib/docker /var/lib/containerd /etc/docker /etc/apt/sources.list.d/docker.list >/dev/null 2>&1 || true
fi

echo ""
say "✅ TermRat-NC 已卸载完成。"
[ "$KEEP_DATA" = "1" ]    && say "（数据保留在 $DIR/data）"    || true
[ "$PURGE_DOCKER" = "1" ] || say "（Docker 已保留——它可能被机器上其它服务使用；如确需卸载，重跑并加 --purge-docker）"
