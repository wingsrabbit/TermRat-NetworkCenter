# ONC Agent

轻量监控 Agent：周期性从中心拉取探测任务（ICMP / TCP / UDP / HTTP / DNS），
执行后连同主机资源（CPU / 内存 / 磁盘 / 负载 / 网络 / 开机时长）一并上报。
以 root 在 Docker（Linux VPS）中运行。

## 构建

```bash
docker build -t nc-agent .
```

## 一键部署

```bash
docker run -d --restart=always --name nc-agent \
  -e NC_SERVER=http://<master-ip>:8080 \
  -e NC_TOKEN=<token> \
  nc-agent
```

可选环境变量：
- `AGENT_VERSION`：上报时携带的版本号，默认 `0.3`。

`NC_SERVER` / `NC_TOKEN` 缺失时容器会打印明确错误并退出。

## ICMP / CAP_NET_RAW 说明

ICMP 探测用 `privileged=True` 直接发原始 ICMP 包，需要 `CAP_NET_RAW` 能力。
Docker 默认就授予该能力，通常无需额外配置。若你的运行环境（某些受限平台 /
安全策略）显式 drop 了它，请加上：

```bash
docker run -d --restart=always --name nc-agent \
  --cap-add=NET_RAW \
  -e NC_SERVER=http://<master-ip>:8080 \
  -e NC_TOKEN=<token> \
  nc-agent
```

## 接口契约

- `GET  {NC_SERVER}/api/agent/tasks` → `{node, report_interval, tasks:[...]}`
- `POST {NC_SERVER}/api/agent/report` → `{ok, stored}`

两者均需请求头 `Authorization: Bearer <NC_TOKEN>`。

## 日志

所有探测 / 上报 / 错误信息打到 stdout，用 `docker logs -f nc-agent` 查看。
