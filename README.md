# TermRat-NetworkCenter (NC)

> 一个**服务器资源** + **网络质量**统一状态站，用于 WHMCS 的 Network Status 页面。
> 融合 ServerStatus-Rabbit 与 NetworkStatus-Rabbit 的核心能力，但**比 origin 更简洁**，目标 **单个 Docker 即可部署**。

## 这是什么
- 对客 **公开主页**（`/`）：节点资源状态 + 网络质量探测 + 事件公告，只读、免登录。
- 对内 **管理端**（`/termadmin`）：登录（WHMCS 风）、仪表盘、节点 / 任务 / 告警 / 用户 / 设置。
- UI 采用已认可的 **cd 设计**（见 `docs/design-prototype/`）：白底 + 蓝点缀 + 绿/红表数据，轻量动效。

## 架构（刻意做简，区别于 origin）
单镜像单容器（center）：
- **后端** Flask：① 提供 REST API　② 接收 agent 上报（HTTP POST）　③ 服务构建后的前端静态资源。
- **存储** SQLite：配置 + 近期时序（简单保留策略）。**不用 InfluxDB / 独立 nginx / WebSocket**。
- **前端** React（由 cd 设计正经 Vite 构建），定时轮询刷新。
- **采集** 统一轻量 **agent**（部署在每个被监控节点）：同时采服务器资源 + 跑网络探测（ICMP/TCP/UDP/HTTP/DNS），HTTPS POST 上报。
- 单 **Dockerfile** 多阶段：node 构建前端 → python 运行 → 一镜像一容器。

> 注：「单 docker」指 center；agent 必须装在被监控机器上（监控架构使然）。

## 目录结构（规划）
```
TermRat-NetworkCenter/
├── backend/        # Flask：API + agent 接收 + 服务前端 + SQLite
├── frontend/       # React + Vite（源自 docs/design-prototype 的设计）
├── agent/          # 统一轻量采集端（资源 + 探测）
├── Dockerfile      # 多阶段：构建前端 + 运行后端 = 单镜像
├── docs/
│   └── design-prototype/   # 已认可的 cd 设计原型（设计基线）
├── VERSION
├── CHANGELOG.md
└── README.md
```
（`origin/` 为两个源仓库 clone，仅取材、不入库；`DEPLOY-NOTES.local.md` 含测试 VM 凭据、不入库。）

## 开发规范
- 版本号按操作规模：**大 +0.1 / 中 +0.01 / 小 +0.001**（由 `VERSION` 维护，git tag 标记）。
- **每个操作**：开分支 → 实现 → PR → 合并后打 tag → 写入 `CHANGELOG.md`。
- 缺什么装什么。

## 路线
- [x] **bootstrap**：仓库骨架 + 设计基线归位。
- [ ] **v0.1**：可跑的脚手架（Flask 服务 React 构建 + SQLite 初始化 + 单 Dockerfile；公开页/登录页可见）。
- [ ] 之后：REST API → agent 上报接口 → 统一 agent → 各管理页 → 告警与保留策略。
