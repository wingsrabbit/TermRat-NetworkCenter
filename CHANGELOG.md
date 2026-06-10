# 更新日志 / Changelog

本项目版本号**按操作规模递增**：大操作 +0.1、中型 +0.01、小型 +0.001（详见 README「开发规范」）。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

## [0.4] - 2026-06-10
### 变更
- **前端接真数据**：公开主页改为调用 `/api/public/overview` 并每 10s 轮询，去掉 mock；新增归一化数据层 `frontend/src/api.js`。
- 网络质量表三态（告警 / 正常 / 等待数据）；节点卡片趋势改为 **CPU 趋势**（后端 overview 为每节点补充 CPU spark）。
- 事件与公告区暂为空态（后端事件功能列后续增量）。

## [0.3] - 2026-06-10
### 新增
- **统一 agent**（agent/）：ICMP(icmplib)/TCP/UDP/HTTP(httpx trace 拆解时延)/DNS(dnspython) 五种探测 + psutil 采资源（CPU/内存/磁盘/负载/流量/在线时长）+ 调度/上报循环（全程容错）。
- Dockerfile + 一条命令部署；README（含 CAP_NET_RAW 说明）。
- 由构建 subagent 实现并自测（tcp/http/dns 通过、udp 双分支、icmp 代码路径正确）。

## [0.2] - 2026-06-10
### 新增
- **后端数据层**（SQLite）：nodes / tasks / results / resources + 节点 token(sha256) 鉴权 + 在线/离线读时判定 + 时序保留清理。
- **REST API**：公开总览/历史；admin 节点/任务（X-Admin-Token）；agent 取任务/上报（Bearer token）。
- **manage.py** CLI（建节点/任务，直连 DB）。
- 经独立复审并应用修复：公开读路径不写库、`busy_timeout`、admin token 恒定时间比较、入参校验、保留清理。

## [0.1] - 2026-06-10
### 新增
- **前端工程**：Vite + React（ESM），复用 cd 设计系统 `styles.css`；将设计原型干净 ESM 化（`data` / `ui` / `sparkline` / `store` / `PublicHome`），去掉 babel-in-browser 与 CDN。
- **公开主页**（`/`）：状态横幅 + 节点状态卡片（CPU/内存/磁盘 阈值配色 + 流量 + 延迟 sparkline）+ 网络质量探测表 + 事件公告时间线；其余路由（节点/线路详情、管理端）占位，后续增量落地。
- **后端**：Flask 单进程，服务前端静态（SPA 回落）+ `/api/health` + SQLite 初始化。
- **单 Dockerfile 多阶段**（node 构建前端 → python 运行）= 一镜像一容器；配 `.dockerignore`。容器端口 8080，数据卷 `/app/data`。

## [0.000] - 2026-06-10
### 新增
- 仓库 bootstrap：`.gitignore`、`VERSION`、本更新日志、`README.md`（含架构与规范）。
- 收纳已认可的 cd 设计原型到 `docs/design-prototype/`（React 免构建版，作为前端设计基线）。
- `origin/`（两个源仓库 clone）与 `DEPLOY-NOTES.local.md`（含测试 VM 凭据）列入忽略，不入库。
