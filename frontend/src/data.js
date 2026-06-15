/* ============================================================
   ONC — 数据层（v0.1：内置 mock，后续增量接真实 API）
   导出 DB 供组件 import 使用
   ============================================================ */

// —— 阈值配色工具 —— //
function latencyLevel(ms) {
  if (ms == null) return "muted";
  if (ms < 50) return "green";
  if (ms < 200) return "amber";
  return "red";
}
function usageLevel(pct) {
  if (pct < 60) return "green";
  if (pct < 80) return "amber";
  return "red";
}

// —— 显示格式化 —— //
/** 数字：固定保留 2 位小数。null/非数 → "—"。用于延迟/抖动/丢包等所有数值显示。 */
export function fmtNum(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toFixed(2);
}
/** 延迟显示（= fmtNum，固定 2 位小数） */
export const fmtLatency = fmtNum;
/** 流量：入参 MB/s，按量级自适应 MB/s · KB/s · B/s */
export function fmtTraffic(mbps) {
  const v = Number(mbps) || 0;
  if (v >= 1) return v.toFixed(2) + " MB/s";
  const kb = v * 1024;
  if (kb >= 1) return kb.toFixed(1) + " KB/s";
  return Math.round(v * 1024 * 1024) + " B/s";
}
/** 在线时长：入参为天（float），自适应 天 · 小时 · 分钟 */
export function fmtUptime(days) {
  const d = Number(days) || 0;
  if (d >= 1) return Math.floor(d) + " 天";
  const h = d * 24;
  if (h >= 1) return Math.floor(h) + " 小时";
  return Math.max(0, Math.round(d * 1440)) + " 分钟";
}

// —— 生成一段带噪声的 sparkline 序列 —— //
function series(base, jitter, n, spike) {
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.5) * jitter;
    v = Math.max(1, v);
    let val = v;
    if (spike && i > n * 0.7 && i < n * 0.8) val = v * 2.4;
    out.push(Math.round(val * 10) / 10);
  }
  return out;
}

// —— 节点（6 个：5 在线含 1 琥珀，1 离线红） —— //
const nodes = [
  {
    id: "n-hk01", name: "香港-CN2-01", region: "香港", tags: ["香港", "CN2 GIA", "BGP"],
    status: "online", enabled: true, version: "1.2.0", ip: "1.2.3.4",
    cpu: 23, mem: 41, disk: 55, load: 0.8, netIn: 12.3, netOut: 3.1, uptimeDays: 36,
    lastSeen: "刚刚", spark: series(13, 5, 24),
  },
  {
    id: "n-tyo01", name: "东京-01", region: "日本", tags: ["日本", "IIJ"],
    status: "online", enabled: true, version: "1.2.0", ip: "45.76.10.22",
    cpu: 17, mem: 38, disk: 43, load: 0.5, netIn: 8.1, netOut: 2.0, uptimeDays: 21,
    lastSeen: "刚刚", spark: series(11, 4, 24),
  },
  {
    id: "n-lax01", name: "洛杉矶-01", region: "美国", tags: ["美国", "GIA"],
    status: "online", enabled: true, version: "1.1.8", ip: "104.22.41.9",
    cpu: 61, mem: 72, disk: 80, load: 2.1, netIn: 22.6, netOut: 9.4, uptimeDays: 9,
    lastSeen: "刚刚", spark: series(140, 30, 24),
  },
  {
    id: "n-fra01", name: "法兰克福-01", region: "德国", tags: ["德国"],
    status: "online", enabled: true, version: "1.2.0", ip: "88.99.120.5",
    cpu: 12, mem: 30, disk: 35, load: 0.3, netIn: 5.4, netOut: 1.2, uptimeDays: 52,
    lastSeen: "刚刚", spark: series(290, 60, 24, true),
  },
  {
    id: "n-sin01", name: "新加坡-01", region: "新加坡", tags: ["新加坡", "CN2"],
    status: "online", enabled: true, version: "1.2.0", ip: "159.65.8.77",
    cpu: 28, mem: 44, disk: 49, load: 0.7, netIn: 9.8, netOut: 3.6, uptimeDays: 14,
    lastSeen: "刚刚", spark: series(33, 8, 24),
  },
  {
    id: "n-can01", name: "广州-源站", region: "中国", tags: ["中国", "电信"],
    status: "offline", enabled: true, version: "1.1.8", ip: "120.235.10.18",
    cpu: 0, mem: 0, disk: 62, load: 0, netIn: 0, netOut: 0, uptimeDays: 0,
    lastSeen: "2 分钟前", spark: [],
  },
];
// 额外探测源（任务里引用，但不计入节点总数 KPI 卡）
const sourceLabels = ["上海-源站", ...nodes.map((n) => n.name)];

// —— 探测任务（5 个，含 1 个告警中） —— //
const tasks = [
  {
    id: "t-sh-bj", name: "沪→京延迟", proto: "ICMP",
    source: "上海-源站", target: "111.13.100.92", targetType: "外部目标",
    interval: 5, timeout: 3, enabled: true, alertOn: true, alerting: false,
    latency: 28.4, loss: 0, jitter: 1.6, code: null, ttfb: null,
    latP95: 41.2, points: 17280, spark: series(27, 6, 24),
    alert: { latency: 200, loss: 5, fails: 3, window: 60, trigger: 3, recover: 3, cooldown: 300 },
  },
  {
    id: "t-hk-tyo", name: "HK→Tokyo", proto: "TCP",
    source: "香港-CN2-01", target: "8.8.8.8", port: 443, targetType: "外部目标",
    interval: 10, timeout: 3, enabled: true, alertOn: true, alerting: false,
    latency: 12.1, loss: 0, jitter: 0.9, code: null, ttfb: null,
    latP95: 18.5, points: 8640, spark: series(12, 3, 24),
    alert: { latency: 150, loss: 3, fails: 3, window: 60, trigger: 3, recover: 3, cooldown: 300 },
  },
  {
    id: "t-dns", name: "公网 DNS", proto: "DNS",
    source: "东京-01", target: "1.1.1.1", targetType: "外部目标",
    interval: 30, timeout: 5, enabled: true, alertOn: false, alerting: false,
    latency: 9.4, loss: 0, jitter: 0.4, code: "OK", ttfb: null,
    latP95: 14.0, points: 2880, spark: series(9, 2, 24),
    alert: null,
  },
  {
    id: "t-la-http", name: "LA HTTP", proto: "HTTP",
    source: "洛杉矶-01", target: "https://example.com", targetType: "外部目标",
    interval: 30, timeout: 10, enabled: true, alertOn: true, alerting: false,
    latency: 142, loss: 0, jitter: 6.2, code: 200, ttfb: 142,
    latP95: 188, points: 2880, spark: series(140, 22, 24),
    alert: { latency: 500, loss: 5, fails: 2, window: 120, trigger: 2, recover: 2, cooldown: 300 },
  },
  {
    id: "t-fra-can", name: "跨境回程", proto: "ICMP",
    source: "法兰克福-01", target: "广州源站", targetType: "内部节点",
    interval: 5, timeout: 3, enabled: true, alertOn: true, alerting: true,
    latency: 312, loss: 6.2, jitter: 22.4, code: null, ttfb: null,
    latP95: 358, points: 17280, spark: series(300, 50, 24, true),
    alert: { latency: 200, loss: 5, fails: 3, window: 60, trigger: 3, recover: 3, cooldown: 300 },
  },
];

// —— 告警历史 —— //
const alertHistory = [
  { id: "h1", time: "2026-06-10 09:14:22", task: "跨境回程", taskId: "t-fra-can", event: "告警", metric: "latency", value: "312 ms", threshold: "> 200 ms", notified: true },
  { id: "h2", time: "2026-06-10 08:50:07", task: "沪→京延迟", taskId: "t-sh-bj", event: "恢复", metric: "latency", value: "26 ms", threshold: "< 200 ms", notified: true },
  { id: "h3", time: "2026-06-09 23:41:55", task: "跨境回程", taskId: "t-fra-can", event: "告警", metric: "loss", value: "8.1 %", threshold: "> 5 %", notified: true },
  { id: "h4", time: "2026-06-09 21:12:30", task: "LA HTTP", taskId: "t-la-http", event: "恢复", metric: "latency", value: "165 ms", threshold: "< 500 ms", notified: true },
  { id: "h5", time: "2026-06-09 20:58:11", task: "LA HTTP", taskId: "t-la-http", event: "告警", metric: "latency", value: "642 ms", threshold: "> 500 ms", notified: false },
];

// —— 告警通道 —— //
const channels = [
  { id: "c1", name: "企业微信-运维群", type: "webhook", url: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=••••3f8a", enabled: true, created: "2026-05-21 10:30" },
  { id: "c2", name: "Slack-ops", type: "webhook", url: "https://hooks.slack.com/services/T0••••/B0••••/xN••••", enabled: true, created: "2026-05-18 14:02" },
];

// —— 用户 —— //
const users = [
  { id: "u1", name: "admin", role: "admin", created: "2026-04-01 09:00", creator: "system" },
  { id: "u2", name: "viewer", role: "readonly", created: "2026-05-12 16:20", creator: "admin" },
];

// —— 公告 / 事件时间线 —— //
const incidents = [
  { id: "i1", level: "red", time: "06-10 09:14", title: "跨境回程线路延迟异常", desc: "法兰克福→广州源站 延迟升至 312ms、丢包 6.2%，已触发告警，工程团队排查中。", status: "调查中" },
  { id: "i2", level: "amber", time: "06-09 22:00", title: "洛杉矶-01 磁盘使用率偏高", desc: "磁盘占用达 80%，已安排清理任务，暂不影响服务。", status: "监控中" },
  { id: "i3", level: "blue", time: "06-08 02:00 - 04:00", title: "新加坡-01 计划内维护", desc: "完成内核与探针升级至 v1.2.0，期间监控数据短暂中断。", status: "已完成" },
  { id: "i4", level: "green", time: "06-07 18:30", title: "广州源站网络抖动已恢复", desc: "上游运营商线路调整完成，回程延迟恢复正常水平。", status: "已解决" },
];

// —— KPI 概览 —— //
const kpi = {
  nodesTotal: 6, online: 5, offline: 1,
  tasksTotal: 5, alerts: 1,
  avgLatency: 78, availability: 99.2,
};

// —— 任务详情时序数据 —— //
function detailSeries(taskId, points) {
  const t = tasks.find((x) => x.id === taskId) || tasks[0];
  const now = Date.now();
  const stepMs = (points <= 60 ? 30 : points <= 120 ? 60 : 300) * 1000;
  const data = [];
  let lat = t.latency;
  for (let i = points - 1; i >= 0; i--) {
    const ts = now - i * stepMs;
    lat += (Math.random() - 0.5) * (t.jitter || 4) * 1.5;
    lat = Math.max(2, lat);
    let l = lat;
    // 告警任务制造一段尖峰
    if (t.alerting && i < points * 0.35 && i > points * 0.18) l = lat * 1.35;
    const loss = t.loss > 0 ? Math.max(0, t.loss + (Math.random() - 0.5) * 3) : (Math.random() < 0.04 ? Math.random() * 2 : 0);
    const jit = Math.abs((Math.random() - 0.5) * (t.jitter || 3) * 2) + (t.jitter || 1) * 0.5;
    data.push({
      ts,
      latency: Math.round(l * 10) / 10,
      loss: Math.round(loss * 10) / 10,
      jitter: Math.round(jit * 10) / 10,
    });
  }
  return data;
}

// —— 节点资源历史（固定近 30 分钟，每 30s 一个点 = 60 点） —— //
function nodeHistory(node) {
  if (!node || node.status !== "online") return [];
  const n = node;
  const points = 60;
  const stepMs = 30 * 1000;
  const now = Date.now();
  const data = [];
  let cpu = n.cpu, mem = n.mem, disk = n.disk, ni = n.netIn, no = n.netOut;
  for (let i = points - 1; i >= 0; i--) {
    cpu = clamp(cpu + (Math.random() - 0.5) * 8, 2, 99);
    mem = clamp(mem + (Math.random() - 0.5) * 4, 5, 98);
    disk = clamp(disk + (Math.random() - 0.5) * 1.2, 5, 99);
    ni = Math.max(0.1, ni + (Math.random() - 0.5) * 3);
    no = Math.max(0.1, no + (Math.random() - 0.5) * 1.6);
    data.push({
      ts: now - i * stepMs,
      cpu: Math.round(cpu), mem: Math.round(mem), disk: Math.round(disk),
      netIn: Math.round(ni * 10) / 10, netOut: Math.round(no * 10) / 10,
    });
  }
  // 收尾对齐到当前即时值
  const last = data[data.length - 1];
  last.cpu = n.cpu; last.mem = n.mem; last.disk = n.disk; last.netIn = n.netIn; last.netOut = n.netOut;
  return data;
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// —— 公开线路历史：固定近 30 分钟（60 点） —— //
function probeHistory(task) {
  return detailSeries(task.id, 60);
}

export const DB = {
  nodes, tasks, alertHistory, channels, users, incidents, kpi, sourceLabels,
  latencyLevel, usageLevel, detailSeries, nodeHistory, probeHistory,
  site: { title: "网络状态中心", subtitle: "实时服务器资源监控 · 网络质量探测" },
  protoColors: { ICMP: "blue", TCP: "green", UDP: "amber", HTTP: "blue", DNS: "green" },
};
