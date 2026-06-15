#!/usr/bin/env bash
# ============================================================
# ONC · Uninstall / 一键卸载
#   Removes center/agent containers + program images + install dir.
#   Only touches this program's own containers; keeps Docker by default.
#   只删本程序自己的容器/镜像，不碰机器上其它 Docker 容器；默认保留 Docker。
# Usage / 用法:
#   curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/uninstall.sh | sudo bash
# Options / 选项 (… | sudo bash -s -- --purge-docker):
#   --keep-data      keep /opt/onc/data  保留数据/证书
#   --purge-docker   also uninstall Docker      连 Docker 一并卸载
# ============================================================
set -eu

# —— Language: Chinese system → 中文, otherwise English ——
_loc="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
case "$_loc" in zh*|*zh_CN*|*zh*) NC_LANG=zh ;; *) NC_LANG=en ;; esac
L() { [ "$NC_LANG" = zh ] && printf '%s' "$1" || printf '%s' "$2"; }

KEEP_DATA=0
PURGE_DOCKER=0
for a in "$@"; do
  case "$a" in
    --keep-data)    KEEP_DATA=1 ;;
    --purge-docker) PURGE_DOCKER=1 ;;
    *) echo "$(L "未知参数：${a}（可用：--keep-data / --purge-docker）" "Unknown arg: ${a} (allowed: --keep-data / --purge-docker)")"; exit 1 ;;
  esac
done
say() { printf '\033[1;36m[NC]\033[0m %s\n' "$*"; }

DIR="${TNC_DIR:-/opt/onc}"

if command -v docker >/dev/null 2>&1; then
  say "$(L '停止并删除容器：nc-center / nc-agent ...' 'Removing containers: nc-center / nc-agent ...')"
  docker rm -f nc-center nc-agent >/dev/null 2>&1 || true
  say "$(L '删除本程序镜像（nc-center / nc-agent）...' 'Removing program images (nc-center / nc-agent) ...')"
  IMGS="$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -E '^(nc-center|nc-agent):' || true)"
  [ -n "$IMGS" ] && docker rmi -f $IMGS >/dev/null 2>&1 || true
else
  say "$(L '未检测到 Docker，跳过容器 / 镜像清理。' 'Docker not found; skipping container/image cleanup.')"
fi

if [ "$KEEP_DATA" = "1" ]; then
  say "$(L "保留数据目录 ${DIR}/data；删除源码 ${DIR}/src ..." "Keeping data ${DIR}/data; removing source ${DIR}/src ...")"
  rm -rf "$DIR/src" || true
else
  say "$(L "删除安装目录 ${DIR}（含数据 / 证书）..." "Removing install dir ${DIR} (incl. data/certs) ...")"
  rm -rf "$DIR" || true
fi

if [ "$PURGE_DOCKER" = "1" ] && command -v docker >/dev/null 2>&1; then
  say "$(L '卸载 Docker（--purge-docker）...' 'Uninstalling Docker (--purge-docker) ...')"
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
say "$(L '✅ ONC 已卸载完成。' '✅ ONC uninstalled.')"
[ "$KEEP_DATA" = "1" ]    && say "$(L "（数据保留在 ${DIR}/data）" "(data kept at ${DIR}/data)")"    || true
[ "$PURGE_DOCKER" = "1" ] || say "$(L '（Docker 已保留——它可能被机器上其它服务使用；如确需卸载，重跑并加 --purge-docker）' '(Docker kept — it may be used by other services; re-run with --purge-docker to remove it)')"
