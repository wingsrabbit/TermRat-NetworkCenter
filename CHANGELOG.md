# 更新日志 / Changelog

本项目版本号**按操作规模递增**：大操作 +0.1、中型 +0.01、小型 +0.001。
格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [Unreleased]

## [1.0] - 2026-06-16
**ONC（Open Network Center）正式版 🎉**

统一的服务器资源 + 网络质量监控：公开状态页 + 管理后台（`/admin`）。单 Docker 镜像；中心 / 探针各一行命令**安装 · 更新 · 卸载**（`update.sh` 自动识别角色）；HTTPS（Let's Encrypt / 上传证书 / 自签）；品牌与 Logo 可自定义；首次安装向导；左上版本号与 GitHub 比对。

### 本版变更
- **管理后台路径可在安装向导自定义**（默认 `/admin`，不再写死）：后端新增 `admin_path` 设置 + 公开 branding 暴露并校验（仅 `[a-z0-9_-]`、避开保留段），前端路由全程动态拼接；安装向导新增「管理后台路径」字段。
- **彻底移除项目早期命名指向**：源码 / 脚本 / 文档统一规范化，去掉已无用的旧库自动迁移逻辑。

自 v0.971 起线上 nc.cloud 业务机测试通过、无新增功能变更，版本正式跨入 **1.0**。

## [0.971] - 2026-06-15
### 修复
- **弹窗(Modal/Drawer)被裁出视口、标题与首个字段标签不可见**——根因纠正:0.961 误判为 flexbox 溢出滚动(`min-height:0`),真因是 **transform 祖先劫持 `position:fixed` 包含块**。页面内容包在 `.fade-up`(入场动画 `animation: fadeUp ... both`),`both` 让动画结束停在含 `transform: translateY(0)` 的 `to` 帧——这个**非 `none` 的 transform** 使 `.fade-up` 成为内部 fixed 弹窗的包含块,于是 `.modal` 的 `top:50%` 居中改为相对仅 155px 高的 `.fade-up` 而非视口 → 弹窗被推到 `top:-127px`、整个 head(标题+首标签)裁出视口顶部。改用 **React Portal 把 Modal/Drawer 渲染到 `document.body`**,彻底脱离任何 transform/overflow 祖先(modal 行业标准做法),一次性修好所有弹窗。线上 nc.cloud 真实环境实测:添加任务 / 添加通道弹窗均 `parentEl=BODY`、`offsetParent=视口`、完整居中、标题可见。

## [0.97] - 2026-06-15
### 修复
- **探针(agent)无法用 `update.sh` 更新**：`update.sh` 整套逻辑只为中心写死（`nc-center`、拉前端、`docker cp`、查 `/api/health`），在探针机上执行直接 `Container nc-center not found` 退出。改为**自动识别本机角色**并分别处理：
  - 中心 `nc-center` → 原热替换流程（重建前端 + `docker cp` + 重启，数据/配置不动）。
  - 探针 `nc-agent` → 重建 `nc-agent:latest` 镜像，并**从运行中的容器读回原配置**（`NC_SERVER` / `NC_TOKEN` / 三个测试端口）按原样重启，约 10s 回到在线。
  - 同机两个都装就都更新；一个都没有才报错并提示对应 install 脚本。
- README「更新与维护」改为「中心 / 探针通用，同一条命令」，删除旧的「agent 升级＝重跑安装命令」表述（正是它误导成在 agent 上跑 update 报错）。

## [0.961] - 2026-06-15
### 修复
- **弹窗内容过高时标题被裁**：`.modal` 有 `max-height` 但 `.modal-body` 缺 `min-height: 0`（flexbox 经典坑）——内容一高、body 无法收缩滚动，整个弹窗超出 `max-height`，垂直居中后**顶部 head（标题 + 首个字段标签）被挤出视口裁掉**（如短视口下「添加任务」弹窗看不到标题与「任务名称」标签）。给 `.modal-body` 加 `flex: 1 1 auto; min-height: 0`、head/foot 加 `flex: none`：body 内部滚动、head/foot 始终可见。影响所有共享 Modal 的弹窗。

## [0.96] - 2026-06-15
### 变更（去品牌化 → 通用开源 NC）
- **全面去除早期品牌指向性内容，项目定名 ONC（Open Network Center）**：仓库 / 安装 / 更新 / 版本检查 URL、镜像名（`nc-center` / `nc-agent`）、安装目录（`/opt/onc`）、数据库（`nc.sqlite`）、前端 localStorage 键（`onc-*`）、告警 Webhook 文案、自签证书 CN、`/api/health` name、各代码注释统一为 ONC 命名；旧实例数据库**自动迁移、数据不丢**。
### 新增（品牌 / Logo 可自定义）
- **管理端「系统设置 → 品牌 / 外观」**：可改**品牌名称**（显示在侧栏 / 登录 / 安装向导 / 公开页 / 浏览器标题）、**副标题**、**Logo 字母标**（1–3 字符），以及**上传自有 Logo 图片**（≤256KB，存为 data URL）。
- 后端公开 `GET /api/branding`；新增 `brand_mark` / `brand_logo` 设置项，默认品牌名改为通用「网络状态中心」、默认字母标「NC」。
- 前端品牌全部动态化：新增 `BrandMark` 组件（自定义图片 或 字母标），`Brand` / `AdminShell` / `Login` / `Setup` / 公开页页脚均读 `store.brand`。
### 清理
- README 去品牌（标题 ONC、去「WHMCS 风」指向）、**删除「开发规范」段**（含「缺什么装什么」等维护者内部流程，不应出现在公开产品 README）。

## [0.95] - 2026-06-15
### 新增
- **安装/更新/卸载脚本自适应系统语言**：`install-center.sh` / `install-agent.sh` / `update.sh` / `uninstall.sh` 根据 `LC_ALL`/`LC_MESSAGES`/`LANG` 判断——系统为中文（`zh*`）则输出中文，否则英文。每条提示用 `L '中文' 'English'` 双语包裹，含 4/4 步骤、角色标注、结果摘要、错误/用法提示。
### 修复
- 脚本里「变量紧跟中文标点」（如 `$DIR（`、`$NAME，`）在 bash 下会把多字节首字节并入变量名、`set -u` 报 `unbound variable`（且 `$(L 中 英)` 两个参数都会被展开，无论选哪种语言都会触发）。已对全部此类变量加 `${}` 花括号定界。

## [0.941] - 2026-06-15
### 修复
- **复制按钮在 HTTP 下无效**：`CodeBlock`（接入 Token / 部署命令等）的复制只用了 `navigator.clipboard`，而该 API 仅在 **HTTPS / localhost（安全上下文）** 可用；纯 HTTP（如 `http://IP`）下 `navigator.clipboard` 为 undefined → 短路啥也没干，却仍弹「已复制」假成功。改为 `copyToClipboard()`：安全上下文用 Clipboard API，否则**回退 `execCommand('copy')`**（HTTP 可用），且**真复制成功才提示**、失败提示「请手动选择复制」。

## [0.94] - 2026-06-15
### 新增
- **一键卸载 `deploy/uninstall.sh`**：`curl … uninstall.sh | sudo bash` 移除 `nc-center` / `nc-agent` 容器 + `nc-center` / `nc-agent` 镜像 + 安装目录 `/opt/onc`（含数据）。**只删本程序自己的容器/镜像，不碰机器上其它 Docker 容器**；默认**保留 Docker**（生产机可能他用）。选项 `--keep-data`（保留数据/证书）、`--purge-docker`（连 Docker 卸，动态 dpkg 查包名）。
### 变更
- **安装脚本加醒目角色标注**：`install-center.sh` 开头打印「▶ 部署【中心 master】…要装探针请用 install-agent.sh」、`install-agent.sh` 打印「▶ 部署【探针 agent】…」，避免把中心 / 探针两条相似的 `curl|bash` 命令搞混（误把中心装到被监控机上）。
- README 增「一键卸载」说明。

## [0.93] - 2026-06-15
### 新增
- **左上角版本标 + 是否最新**：管理后台侧栏品牌下显示当前运行版本 `vX`，并与 **GitHub main 的 VERSION** 对比——**绿「· 最新」/ 橙「· 有新版 vY」**（鼠标悬停提示更新方式）。后端新增公开 `GET /api/version`（返回 `running` / `latest` / `up_to_date`，latest 从 GitHub 拉取并缓存 30 分钟）。
- **真·更新脚本 `deploy/update.sh`（非重装）**：`git pull` 最新 → 临时 node 容器仅重建前端 → `docker cp` 热替换进运行中的 center 容器 + `pip install` 校验后端依赖 → 重启容器。**不重建整镜像（不重拉基础层）、数据卷不动**；版本未变则直接跳过。一行命令：`curl … update.sh | sudo bash`。涉及底层变更时脚本提示改用 `install-center.sh`。
### 变更
- README「更新与维护」改为主推 `update.sh`（真·更新），`install-center.sh` 退为首装 / 彻底重建。

## [0.922] - 2026-06-15
### 修复
- **节点「部署」弹窗改为一行命令安装**：原先给的是裸 `docker run nc-agent`，但全新探针机本地**没有该镜像**会直接失败；且 `NC_SERVER` 用 `location.origin`（web 80 口、漏了 agent 口）。现改为一行 `curl … install-agent.sh | sudo bash -s -- -s http://<host>:8080 -t <token>`（自动装 Docker / 拉源码 / 构建 / 运行），`NC_SERVER` 固定用中心 **agent 上报口 :8080**（与 web 端口解耦）。弹窗文案同步更新。

## [0.921] - 2026-06-15
### 变更
- **去除 origin 兔子品牌**：项目源自 ServerStatus-Rabbit / NetworkStatus-Rabbit（均🐇吉祥物），适配时把兔子图标带了进来。品牌标志改为简洁的字母标：替换 `store.jsx`(Brand) 与 `AdminShell.jsx`(侧栏 logo×2) 共 3 处用法、删除 `ui.jsx` 的 `rabbit` 图标定义、去掉 README 标题的 🐇。
- README 架构说明弱化对 origin 技术栈的指名（InfluxDB → 「独立时序库」）。
### 检查
- 全项目复检确认**无其它 origin 残留**：前端依赖仅 react/vite/echarts（无 vue/naive/pinia/socket.io/semantic）；无 ServerStatus/NetworkStatus/Hotaru/SocketIO 等代码或文案。（`wingsrabbit` 为仓库属主用户名，非污染。）

## [0.92] - 2026-06-15
### 新增
- **初次安装向导**：全新部署（库内尚无用户）首次打开 `/admin` 自动进入安装向导，设置**管理员用户名 / 密码**（密码≥8 位、需确认）+ 站点标题 / 副标题，提交后创建管理员并直接登录进入仪表盘。
- 后端 `GET /api/setup/status`（公开，返回 `needs_setup`）+ `POST /api/setup`（仅「无任何用户」时可用，创建首个管理员 + 可选站点信息 + 直接发会话；已初始化后返回 409，防重复 / 顶替）。
### 变更
- **不再默认播种 admin/admin**：`_ensure_default_admin` 仅在**显式提供** `INITIAL_ADMIN_USER`+`INITIAL_ADMIN_PASSWORD`（无人值守部署）时播种；否则保持 0 用户 → 走安装向导。
- `install-center.sh` 默认不再预置管理员（→ 向导）；仅当传 `TNC_ADMIN_USER`+`TNC_ADMIN_PASS` 时预置。登录页移除「默认 admin/admin」提示与用户名预填。

## [0.91] - 2026-06-15
### 新增
- **一键安装脚本**：`deploy/install-center.sh`（Master）与 `deploy/install-agent.sh`（Slave），自动装 Docker → 拉源码 → 构建 → 起容器，各一行命令即可上手；支持 `TNC_*` 环境变量定制端口/账号/互测端口。
- **LICENSE**（MIT）。
### 变更
- **README 全面重写**：徽章 + 目录 + 功能表 + 架构图 + 探测协议 + Master/Slave 一行命令快速开始 + 端口/HTTPS/后台/持久化/运维/源码构建/目录结构/技术栈（参考 origin 两项目风格，面向「5 分钟上手」）。
### 移除（仓库瘦身，只留项目本身）
- 删除 `docs/design-prototype/`（设计原型参考前端，已被 `frontend/src/` 正式实现取代）。
- 删除过时的 `agent/README.md`（并入主 README）。
- `.gitignore` 清理（移除已失效条目，泛化 `*.zip`）；`origin/` 取材 clone 与 本地打包文件 仅本地、从未入库。

## [0.9] - 2026-06-11
### 新增
- **HTTPS 支持（内嵌 Caddy）**：center 镜像内置 Caddy 作 web 前置，反代到 gunicorn:8080。管理后台「系统设置 → Web 访问 / HTTPS」可在线切换四种模式并**热重载**（配置非法自动保持原配置，不中断访问）：
  - `http`（默认）：纯 HTTP，监听 80；
  - `https-le`：**Let's Encrypt** 自动签发（填域名，需解析到本机 + 80/443 可达）；
  - `https-custom`：**上传自有证书**（PEM 证书 + 私钥，存 `/app/data/certs`）；
  - `https-selfsigned`：自生成自签证书（cryptography，对任意 SNI/纯 IP 出示同证书），适合 IP-only 测试机。
- **端口可配**：web HTTP/HTTPS 端口可改；agent **上报端口**走独立 8080（与 web TLS 解耦，兼容现有 agent 不动）；agent **互测端口**（HTTP/HTTPS/UDP）此前已支持 `NC_TEST_*` env 自定义，避免默认端口被屏蔽。
### 变更
- **容器改双进程**：`supervisord` 同容器拉起 gunicorn + caddy（均 autorestart），入口 `deploy/entrypoint.sh` 启动时据 DB 设置生成 Caddyfile（带兜底 HTTP 配置）。Caddy 证书/数据落 `/app/data/caddy-data`（卷持久化，LE 证书跨重启复用）。
- **部署端口**：`-p 80:80 -p 443:443 -p 8080:8080`（80/443=浏览器 web，8080=agent 上报 + 管理兜底，始终直连可用）。
### 后端
- 新增 `backend/webserver.py`（Caddyfile 生成 + `caddy reload` 热重载 + 访问地址推导）、`backend/gen_caddyfile.py`（启动期生成）。
- 新增 API：`GET/POST /api/web/config`、`POST /api/web/cert`；设置项新增 `web_mode/web_domain/web_email/web_http_port/web_https_port`。
- Dockerfile 多阶段引入官方 `caddy:2` 二进制 + `supervisor`，`EXPOSE 80 443 8080`。

## [0.84] - 2026-06-11
### 新增
- **节点编辑**：节点管理新增「编辑」按钮 + 弹窗，可改节点名称与 3 个标签（地区/线路/可选），无需删除重建。
- **公开页脱敏（每节点单独控制）**：编辑弹窗内「公开页隐藏本节点敏感信息」开关。开启后——
  - 公开主页节点卡片 / 节点详情页**屏蔽本节点公网 IP**（卡片不显示 IP 前缀、详情页隐藏 IP 行）；
  - 其它节点**指向本节点**的探测目标地址（如 `http://31.77.185.13:8799`）在公开页用**节点名**替换（→ `http://VPS3:8799`）；
  - **对外公共目标**（非我方节点，如对外 HTTP/DNS 探测）原样保留，不受影响。
### 后端
- `nodes` 表新增 `public_hidden` 列（含老库 ALTER 迁移）；`update_node` 白名单纳入 `public_hidden`。
- 公开接口 `public/overview`、`public/node/<id>`、`public/task/<id>` 统一脱敏：隐藏节点 IP→null、目标地址按 `_mask_addr` 用节点名替换我方隐藏 IP。

## [0.83] - 2026-06-11
### 修复
- **浏览器缓存看到旧前端**：app.py 给 index.html 加 `Cache-Control: no-cache`（带 hash 的 assets 长缓存 immutable），redeploy 后自动拿最新 CSS/JS，无需硬刷。这是"改了却没生效"的根因。
- **启用开关不可见**：关态背景由过浅的 #dfe3ea 改为明显灰 #9aa6b6 + 滑块阴影加强 → 关=灰/开=绿 清晰。
- **部署弹窗背景渲染**：去掉 .overlay 的 backdrop-filter blur（个别环境渲染异常）。
- **agent 莫名离线根因**：节点管理「部署」会重置 Token，使运行中探针旧 Token 立即失效→离线。改为点击先弹确认警告。
### 新增
- 节点管理离线诊断：离线节点显示「最后上报 X 前」+ 排查提示（agent 是否运行 / 是否被重置 Token / 网络）。

## [0.82] - 2026-06-11
### 变更
- **数字统一 2 位小数**：新增 `fmtNum`，延迟/抖动/丢包/负载/可用率等数值显示固定 2 位；图表 tooltip（TimeChart/ProbeMiniChart/ResourceChart/TrafficChart）加 valueFormatter，不再出现长浮点（如 583.5203…）。
- **启用开关配色**：Switch 开态由蓝改绿（关=灰白 / 开=绿），状态更直观。

## [0.81] - 2026-06-11
### 修复
- **agent 容器崩溃**：agent/Dockerfile 漏拷 v0.8 新增的 `testserver.py`，导致 `import testserver` 失败、容器重启循环。补入 COPY。

## [0.8] - 2026-06-11
### 新增
- **agent 内置测试服务**：每个 agent 起 HTTP(:8799)/HTTPS(:8443 自签)/UDP echo(:8799) 监听，使节点间可互测 HTTP/HTTPS/UDP（不止 ICMP/TCP）。
- **图表按时间档分桶聚合**：任务历史 `?range=` 后端按档位（30m/1h/6h/24h/3d/7d/14d/30d → 30s…8h 桶）聚合均值+成功率，数据点均匀、长档不再被 24h 卡死；管理端任务详情显示「X / 共 N 桶 · 每Δ」。
### 变更
- **agent 采样规整化**：墙钟网格对齐 + 线程池非阻塞探测，结果 ts 取网格时刻，点数均匀（30min=干净整数点），允许排队、不再因单线程抖动丢点。
- **公开/管理显示修正**：延迟统一最多 2 位小数；流量自适应 B/KB/MB（解决空闲机显示 0）；在线时长自适应 分/时/天；节点流量曲线自适应单位。
- agent HTTP 探测 verify=False（支持内部自签 HTTPS + 外部仍测时延/状态）；新增依赖 cryptography（自签证书）。
### 修复
- 管理端弹窗从右下角闪现到中央：modalIn 关键帧补回 translate(-50%,-50%)，改为原位缩放淡入。
- 资源抓取经实测核对准确（容器 psutil + --pid/--network host），问题仅在显示层。

## [0.711] - 2026-06-11
### 修复
- **agent 版本号不再写死**：`agent/main.py` 优先环境变量 `AGENT_VERSION`，否则读镜像内 `VERSION`（回退 0.71），避免显示陈旧的 0.3。
- `agent/Dockerfile` 改为仓库根构建上下文（`docker build -f agent/Dockerfile .`）并拷入根 `VERSION`，使容器内可读版本号。

## [0.71] - 2026-06-11
### 修复
- **公开页 / 仪表盘纳入阈值告警**（e2e 联调发现）：`api.js normalize()` 的 `alerting` 此前只看最近探测 `success`，漏了 v0.5 告警引擎的 `alert_status`（延迟/丢包阈值告警）。修复后公开主页网络质量表「状态」列、顶部异常横幅、管理仪表盘「活跃告警」KPI 与任务卡均正确反映阈值告警（线路详情/告警历史本就正确）。
- 任务归一化补充 `alertStatus` 字段，便于前端区分告警来源。

## [0.7] - 2026-06-11
### 新增
- **管理端 `/admin` 全量落地**（前端）：WHMCS 风格登录页 → 鉴权外壳（折叠侧栏 + 顶栏 + 底栏）→ 仪表盘 + 各管理页。
  - 登录页：用户名/密码（显隐切换）+ 记住我，调用 `/api/auth/login` 取会话 token。
  - 仪表盘：KPI（节点数/在线/告警/平均延迟）+ 任务卡片网格（搜索 + 协议筛选，复用 `/api/public/overview`）；任务详情：TimeChart + 30m–30d 范围选择 + 统计卡（均值/P95/抖动/丢包）。
  - 节点管理（表格 + 添加 → 一次性 token + Docker 部署片段、重生成 token、启用/禁用、删除）；任务管理（增删改 + 告警阈值，编辑仅改后端 PATCH 允许字段）；告警通道、告警历史、用户管理（重置密码/删除保留≥1 admin）、系统设置。
  - readonly 角色仅见「仪表盘 / 告警历史」，其余管理路由拦截为「无权限」。
- `api.js` 增管理端客户端（Bearer 会话 token、统一 `request` 封装、节点/任务/用户/渠道/设置 CRUD + 告警历史），保留全部既有导出；`store.jsx` 接真实登录/登出 + `apiMe` 启动校验（内部 ctx 改名，避免与 api 导入冲突）；`App.jsx` 接管 `/admin` 路由（parts 解析），公开路由不变。
- 仅改 `frontend/`，后端/agent 未改动；`npm run build` 通过。

## [0.6] - 2026-06-11
### 新增
- **公开详情页**：节点详情（/node/:id，固定近 30min 的 CPU/内存/磁盘 + 上下行流量曲线 + 即时值 + 该节点探测线路列表）、线路详情（/probe/:id，固定近 30min 延迟/丢包/抖动曲线 + 当前/均值/丢包/可用率）。对客简版。
- `charts.jsx`（echarts：EChart/TimeChart/ProbeMiniChart/ResourceChart/TrafficChart）ESM 化（由 subagent 移植）；`api.js` 加 getNodeDetail/getTaskDetail；`App.jsx` 落地 /node/:id、/probe/:id（替换占位）。

## [0.5] - 2026-06-11
### 新增
- **管理端鉴权**：用户表（pbkdf2 密码）+ 会话 token + 角色（admin/readonly）；/api/auth/login|logout|me；首启自动建默认管理员（admin/admin，可经 env 改）。
- **管理 API**：任务编辑（PATCH，含告警阈值）、用户 / 告警渠道 / 设置 CRUD、节点 token 重生成、节点/任务详情、告警历史（登录可见）。
- **告警引擎**：任务阈值（延迟/丢包/连续失败）评估 → 触发/恢复事件 + alert_history + 任务 alert_status + webhook 异步通知 + 冷却。
- 老库 ALTER TABLE 迁移补告警列；鉴权同时支持会话 token 与静态 X-Admin-Token（CLI 引导）。

## [0.41] - 2026-06-10
### 修复
- agent UDP 探测：对 53 端口改发合法 DNS 查询（dnspython 构包），可拿到真实响应与延迟；其它端口仍用通用单字节探测。

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
