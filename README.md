# ONC (NC)

> **服务器资源 + 网络质量** 统一状态中心 —— 一个公开状态页 + 一个 WHMCS 风管理后台。
> 中心端 **单 Docker** 即可跑（内置 Caddy 自动 HTTPS），被监控机各跑一个轻量 agent。

![version](https://img.shields.io/badge/version-v0.91-blue)
![python](https://img.shields.io/badge/python-3.12-green)
![docker](https://img.shields.io/badge/docker-single--image-2496ED)
![license](https://img.shields.io/badge/license-MIT-orange)

---

## 目录

- [功能特性](#功能特性)
- [架构概览](#架构概览)
- [探测协议](#探测协议)
- [快速开始 — Master（中心）](#快速开始--master中心)
- [快速开始 — Slave（节点）](#快速开始--slave节点)
- [端口说明](#端口说明)
- [HTTPS / Web 访问](#https--web-访问)
- [管理后台](#管理后台)
- [数据持久化](#数据持久化)
- [更新与维护](#更新与维护)
- [从源码手动构建](#从源码手动构建)
- [目录结构](#目录结构)
- [技术栈](#技术栈)
- [开发规范](#开发规范)
- [License](#license)

---

## 功能特性

| 类别 | 特性 |
|------|------|
| 资源监控 | 每节点 CPU / 内存 / 磁盘 / 网络流量 / 负载 / 在线时长，实时 + 历史曲线 |
| 网络探测 | ICMP / TCP / UDP / HTTP / HTTPS / DNS 六类；节点间组网状探测 + 对外目标探测 |
| 公开页 | 对客只读主页（`/`）：节点状态 + 线路质量，免登录 |
| 管理后台 | `/admin`：仪表盘、节点、任务、告警、用户、系统设置（admin / readonly 双角色）|
| 节点管理 | Web 端增删改、启停、一键生成部署命令；**编辑前端展示名 / 标签** |
| 隐私脱敏 | **每节点可单独隐藏**公网 IP，指向它的探测目标在公开页用节点名替换（对外目标不变）|
| 告警 | 延迟 / 丢包 / 连续失败阈值 → 触发 / 恢复事件 + 冷却 + Webhook 通知 |
| HTTPS | 内嵌 Caddy：**Let's Encrypt 自动签发** / 上传自有证书 / 自签名；后台在线切换热重载 |
| 端口 | web 端口可配；agent 上报口与 web TLS 解耦；agent 互测端口可自定义（防默认端口被屏蔽）|
| 部署 | 中心**单镜像单容器**；agent 一行命令装；数据卷持久化 |

---

## 架构概览

```
              浏览器 (HTTP/HTTPS)                         Webhook 告警
                    │                                          ▲
            80 / 443 │  Caddy (TLS 终止 / 自动证书)             │
        ┌───────────▼──────────────────────────────────────────┴──┐
        │   Center  ·  单容器 (supervisord)                        │
        │   Caddy  ⇄  gunicorn (Flask: API + 收上报 + 服务前端)     │
        │                         ⇩                                │
        │                    SQLite (配置 + 时序)                  │
        └───────────▲──────────────────────────────────────────────┘
            8080     │  agent 上报 / 管理兜底（明文，独立于 web TLS，始终可用）
        ┌────────────┼─────────────┬─────────────┐
        ▼            ▼             ▼
    ┌───────┐    ┌───────┐     ┌───────┐
    │Agent 1│    │Agent 2│ ··· │Agent N│      每台被监控机各一个
    └───┬───┘    └───┬───┘     └───┬───┘
        └──── 互相探测 ICMP/TCP/UDP/HTTP/HTTPS ────┘   +   对外目标 HTTP/DNS/UDP
```

- **Center**：单 Docker 镜像（多阶段：Node 构建前端 → Python 运行 + 内嵌 Caddy）。`supervisord` 同容器拉起 `gunicorn`（应用，8080）与 `caddy`（web，80/443，反代到 8080）。存储用 **SQLite**，架构精简（无需独立时序库 / 外置 nginx / WebSocket）。
- **Agent**：装在每台被监控机，周期性拉任务 → 执行探测 + 采资源 → HTTP POST 上报。内置测试服务（HTTP/HTTPS/UDP echo），使节点间可互测应用层协议。

---

## 探测协议

| 协议 | 指标 | 目标 |
|------|------|------|
| ICMP | 延迟 / 丢包 / 抖动 | 节点 / 任意 IP / 域名 |
| TCP  | 连接延迟 | 节点端口 / 任意 host:port |
| UDP  | 延迟（echo 往返）| 节点内置 echo / 任意目标 |
| HTTP | 延迟 / 状态码 | 节点内置测试服 / 任意 URL |
| HTTPS| 延迟 / 状态码 | 节点内置自签测试服 / 任意 URL |
| DNS  | 解析延迟 / 结果 | 任意域名 |

---

## 快速开始 — Master（中心）

在你的**中心服务器**（Linux）上，一行命令（自动装 Docker → 构建 → 启动）：

```bash
curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-center.sh | sudo bash
```

完成后会输出访问地址：

- 公开页：`http://你的IP`
- 管理端：`http://你的IP/admin` —— **首次打开进入「初次安装向导」**，设置管理员用户名 / 密码 + 站点信息后即可使用
- Agent 口：`http://你的IP:8080`（从机用此地址上报）

> 自定义端口：在命令里加环境变量，例如 `… | sudo TNC_HTTP_PORT=8000 bash`。
> 无人值守（跳过向导、直接预置管理员）：再加 `TNC_ADMIN_USER=…  TNC_ADMIN_PASS=…`。

---

## 快速开始 — Slave（节点）

1. 先在管理端 **节点管理 → 新增节点**，复制该节点的 **Token**。
2. 在**被监控机**上一行命令安装（`-s` 填中心 agent 地址，`-t` 填 Token）：

```bash
curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-agent.sh \
  | sudo bash -s -- -s http://中心IP:8080 -t 你的节点TOKEN
```

约 10 秒后该节点在管理端转为「在线」。之后在 **任务管理** 里给它配探测任务即可。

> 互测端口被屏蔽时可自定义：命令前加 `TNC_TEST_HTTP_PORT=9001 TNC_TEST_HTTPS_PORT=9002 TNC_TEST_UDP_PORT=9001`。

---

## 端口说明

| 端口 | 用途 | 必需 |
|------|------|------|
| 80   | 浏览器 web（Caddy）/ Let's Encrypt HTTP-01 验证 | ✅ |
| 443  | 浏览器 HTTPS（Caddy，开启 HTTPS 后生效）| HTTPS 时 ✅ |
| 8080 | agent 上报 + 管理兜底（gunicorn 直连，明文，独立于 web TLS）| ✅ |
| 8799 / 8443 | agent 内置测试服（HTTP / HTTPS，节点间互测用，可自定义）| 内部探测时 |

> agent 上报口（8080）与 web 端口分离：切换 web HTTPS 不影响 agent；agent 永远直连 8080。

---

## HTTPS / Web 访问

管理端 **系统设置 → Web 访问 / HTTPS** 在线切换，切换即 `caddy reload` 热生效（配置非法会自动保持原配置、不中断访问）：

| 模式 | 说明 |
|------|------|
| `HTTP`（默认）| 纯 HTTP，监听 80 |
| `Let's Encrypt` | 填域名自动签发 + 自动续期。**要求**：域名 A 记录解析到本机、80/443 公网可达；若用 Cloudflare，该子域须**灰云 / DNS-only**（橙云代理会拦截验证）|
| `上传证书` | 粘贴自有 PEM 证书 + 私钥 |
| `自签名` | 内置自生成自签证书，适合纯 IP 测试（浏览器告警后继续访问即可）|

> 无论何种模式，`http://IP:8080` 始终明文直连可用，作为管理兜底（避免证书配置失误把自己锁在门外）。

---

## 管理后台

| 模块 | 说明 |
|------|------|
| 仪表盘 | 节点 / 任务 / 告警 概览 |
| 节点管理 | 增删改、启停、**编辑名称与标签**、一键生成部署命令、**公开页脱敏开关**、离线诊断 |
| 任务管理 | 6 协议探测任务，间隔 / 超时 / 阈值可配，启停 |
| 告警 | 渠道（Webhook）、告警历史 |
| 用户 | admin / readonly 角色，pbkdf2 口令 |
| 系统设置 | 站点信息、探测默认值、数据保留、**Web 访问 / HTTPS** |

---

## 数据持久化

中心所有状态在容器 `/app/data`（一键脚本挂到宿主 `/opt/nc-center/data`）：

```
data/
├── nc.sqlite     # 配置 + 用户 + 节点 + 任务 + 时序 + 告警历史
├── certs/             # 上传 / 自签的 web 证书
└── caddy-data/        # Caddy 数据（Let's Encrypt 证书等，跨重启复用）
```

> 升级 / 重建容器不丢数据，卷在即可。

---

## 更新与维护

**中心升级**（重新拉取 + 构建 + 重启，数据保留）：

```bash
curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-center.sh | sudo bash
```

**agent 升级**：在节点上重跑一键 agent 安装命令即可。

**运维**：

```bash
docker logs -f nc-center      # 中心日志（gunicorn + caddy）
docker logs -f nc-agent       # 节点 agent 日志
docker restart nc-center      # 重启中心
```

---

## 从源码手动构建

不想用一键脚本时：

```bash
git clone https://github.com/wingsrabbit/ONC.git
cd ONC

# 1) 中心（首次打开 /admin 进入安装向导设置管理员；
#    无人值守可加 -e INITIAL_ADMIN_USER=… -e INITIAL_ADMIN_PASSWORD=… 跳过向导）
docker build -t nc-center:latest .
docker run -d --name nc-center --restart unless-stopped \
  -p 80:80 -p 443:443 -p 8080:8080 \
  -v /opt/nc-center/data:/app/data nc-center:latest

# 2) agent（在每台被监控机；用根上下文 + -f agent/Dockerfile 以拷入 VERSION）
docker build -f agent/Dockerfile -t nc-agent:latest .
docker run -d --name nc-agent --restart unless-stopped \
  --network host --pid host --cap-add NET_RAW \
  -e NC_SERVER=http://中心IP:8080 -e NC_TOKEN=节点TOKEN \
  nc-agent:latest
```

---

## 目录结构

```
ONC/
├── backend/                # Flask：REST API + 收 agent 上报 + 服务前端 + SQLite
│   ├── app.py              #   入口（SPA 回落 + 缓存头）
│   ├── api.py              #   全部 REST 端点（公开 / 鉴权 / admin / agent）
│   ├── db.py               #   SQLite 数据层 + 告警引擎 + 历史分桶
│   ├── webserver.py        #   内嵌 Caddy：Caddyfile 生成 + 热重载 + 自签证书
│   ├── gen_caddyfile.py    #   容器启动时据设置生成 Caddyfile
│   └── manage.py           #   CLI（建管理员等）
├── frontend/               # React + Vite（公开页 + /admin 后台）
│   └── src/
│       ├── pages/          #   PublicHome / NodeDetail / admin/*
│       ├── charts.jsx      #   ECharts 封装
│       └── api.js  store.jsx  ui.jsx  ...
├── agent/                  # 轻量采集端
│   ├── main.py             #   调度 + 上报
│   ├── probes.py           #   ICMP/TCP/UDP/HTTP(S)/DNS 探测
│   ├── resources.py        #   主机资源采集（psutil）
│   ├── testserver.py       #   内置 HTTP/HTTPS/UDP 测试服（供节点互测）
│   └── Dockerfile
├── deploy/
│   ├── install-center.sh   # Master 一键安装
│   ├── install-agent.sh    # Slave 一键安装
│   ├── supervisord.conf    # gunicorn + caddy 进程管理
│   └── entrypoint.sh       # 容器入口（生成 Caddyfile → supervisord）
├── Dockerfile              # 中心多阶段镜像（前端构建 → Python + Caddy + supervisor）
├── VERSION   CHANGELOG.md   README.md   LICENSE
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.12 · Flask 3 · gunicorn · 标准库 sqlite3 |
| Web 前置 | Caddy 2（TLS / Let's Encrypt / 反代）· supervisor |
| 前端 | React 18 · Vite · ECharts |
| 采集 | psutil · icmplib · httpx · dnspython · cryptography |
| 存储 | SQLite（WAL）|
| 容器 | Docker 多阶段单镜像（node:20-slim + python:3.12-slim + caddy:2）|

---

## 开发规范

- 版本号按操作规模：**大 +0.1 / 中 +0.01 / 小 +0.001**（由 `VERSION` 维护，git tag 标记）。
- 每个改动：**开分支 → 实现 → PR → 合并后打 tag → 写入 `CHANGELOG.md`**。
- 缺什么装什么。

---

## License

[MIT](LICENSE) © wingsrabbit
