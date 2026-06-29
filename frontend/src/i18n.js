export const LANG_STORAGE_KEY = "onc-lang";

export const DEFAULT_BRAND = {
  zh: {
    name: "网络状态中心",
    subtitle: "实时服务器资源监控 · 网络质量探测",
  },
  en: {
    name: "Network Status Center",
    subtitle: "Real-time infrastructure and network probes",
  },
};

const DEFAULT_NAMES = new Set(Object.values(DEFAULT_BRAND).map((b) => b.name));
const DEFAULT_SUBTITLES = new Set(Object.values(DEFAULT_BRAND).map((b) => b.subtitle));

const MESSAGES = {
  zh: {
    "lang.switch": "切换语言",
    "lang.english": "English",
    "lang.chinese": "中文",
    "theme.toggle": "切换主题",
    "theme.toDark": "切换深色",
    "theme.toLight": "切换浅色",
    "header.adminLogin": "管理登录",
    "state.loading": "加载中…",
    "state.loadFailedRetry": ({ error }) => `加载失败：${error}（重试中…）`,
    "status.issueTitle": ({ count }) => `⚠ ${count} 个节点 / 线路异常`,
    "status.allOperational": "✓ 所有系统运行正常",
    "status.issueDesc": "部分节点离线或线路指标异常，团队正在处理；其余服务正常。",
    "status.allOperationalDesc": "全部节点在线，探测线路指标均在阈值内。",
    "status.online": "在线",
    "status.offline": "离线",
    "status.normal": "正常",
    "status.alerting": "告警中",
    "status.waitingData": "等待数据",
    "home.serverEyebrow": "Server Status",
    "home.serverTitle": "节点状态",
    "home.networkEyebrow": "Network Quality",
    "home.networkTitle": "网络质量探测",
    "home.incidentsEyebrow": "Incidents",
    "home.incidentsTitle": "事件与公告",
    "filters.searchNodes": "搜索节点 / 标签",
    "filters.allRegions": "全部",
    "filters.all": "全部",
    "filters.online": "在线",
    "filters.offline": "离线",
    "empty.noMatchingNodes": "没有符合条件的节点",
    "empty.noNodes": "暂无节点，请在管理端添加并部署 agent",
    "empty.noProbeTasks": "暂无探测任务，请在管理端创建",
    "empty.noIncidents": "暂无事件与公告，系统平稳运行",
    "table.probe": "探测线路",
    "table.protocol": "协议",
    "table.latency": "延迟",
    "table.loss": "丢包率",
    "table.availabilityTrend": "可用率趋势",
    "table.status": "状态",
    "table.line": "线路",
    "table.target": "目标",
    "footer.refreshEvery": ({ seconds }) => `数据每 ${seconds} 秒刷新`,
    "footer.lastUpdated": ({ seconds }) => `最后更新：${seconds} 秒前`,
    "node.downlink": "下行",
    "node.uplink": "上行",
    "node.uptime": "在线时长",
    "node.cpuTrend": "CPU 趋势",
    "node.offline": "节点离线",
    "node.lastOnline": ({ time }) => `最后在线 ${time}`,
    "node.backHome": "返回主页",
    "node.loadFailed": ({ error }) => `节点加载失败：${error}`,
    "node.notFound": "节点不存在",
    "node.version": "版本",
    "node.offlineNoData": "节点离线，暂无资源数据",
    "node.cpuUsage": "CPU 使用率",
    "node.memUsage": "内存使用率",
    "node.diskUsage": "磁盘使用率",
    "node.systemLoad": "系统负载",
    "node.downloadTraffic": "下行流量",
    "node.uploadTraffic": "上行流量",
    "node.resourceHistoryTitle": "资源使用率 · 近 30 分钟",
    "node.resourceHistorySubtitle": "CPU / 内存 / 磁盘",
    "node.resourceHistoryEmpty": "暂无资源历史数据",
    "node.trafficHistoryTitle": "网络流量 · 近 30 分钟",
    "node.trafficHistorySubtitle": "↓ 下行 / ↑ 上行",
    "node.trafficHistoryEmpty": "暂无流量历史数据",
    "node.probesTitle": ({ count }) => `该节点的探测线路 ${count}`,
    "node.probesEmpty": "该节点暂未配置探测任务",
    "probe.loadFailed": ({ error }) => `线路加载失败：${error}`,
    "probe.notFound": "线路不存在",
    "probe.sourceNode": "源节点",
    "probe.interval": ({ seconds }) => `探测间隔 ${seconds}s`,
    "probe.currentLatency": "当前延迟",
    "probe.avgLatency": "平均延迟",
    "probe.packetLoss": "丢包率",
    "probe.availability": "可用率",
    "probe.historyTitle": "延迟 / 丢包 / 抖动 · 近 30 分钟",
    "probe.historyLegendAlert": "红线=延迟(告警) · 红柱=丢包 · 琥珀虚线=抖动",
    "probe.historyLegendNormal": "绿线=延迟 · 琥珀虚线=抖动",
    "probe.historyEmpty": "暂无探测历史数据",
    "probe.publicNote": "· 对客简版，固定展示近 30 分钟数据，数据每 10 秒自动刷新。",
    "notFound.message": "页面不存在",
    "chart.latencyMs": "延迟 (ms)",
    "chart.lossPct": "丢包 (%)",
    "chart.jitterMs": "抖动 (ms)",
    "chart.memory": "内存",
    "chart.disk": "磁盘",
    "chart.download": "↓ 下行",
    "chart.upload": "↑ 上行",
    "unit.day": ({ count }) => `${count} 天`,
    "unit.hour": ({ count }) => `${count} 小时`,
    "unit.minute": ({ count }) => `${count} 分钟`,
    "unit.secondAgo": ({ count }) => `${count} 秒前`,
    "unit.minuteAgo": ({ count }) => `${count} 分钟前`,
    "unit.hourAgo": ({ count }) => `${count} 小时前`,
    "unit.dayAgo": ({ count }) => `${count} 天前`,
  },
  en: {
    "lang.switch": "Switch language",
    "lang.english": "English",
    "lang.chinese": "中文",
    "theme.toggle": "Toggle theme",
    "theme.toDark": "Switch to dark mode",
    "theme.toLight": "Switch to light mode",
    "header.adminLogin": "Admin Login",
    "state.loading": "Loading…",
    "state.loadFailedRetry": ({ error }) => `Load failed: ${error} (retrying…)`,
    "status.issueTitle": ({ count }) => `⚠ ${count} node/probe issue${count === 1 ? "" : "s"}`,
    "status.allOperational": "✓ All systems operational",
    "status.issueDesc": "Some nodes are offline or probe metrics are abnormal. The team is investigating while other services remain available.",
    "status.allOperationalDesc": "All nodes are online and probe metrics are within thresholds.",
    "status.online": "Online",
    "status.offline": "Offline",
    "status.normal": "Normal",
    "status.alerting": "Alerting",
    "status.waitingData": "Waiting for data",
    "home.serverEyebrow": "Server Status",
    "home.serverTitle": "Node Status",
    "home.networkEyebrow": "Network Quality",
    "home.networkTitle": "Network Probes",
    "home.incidentsEyebrow": "Incidents",
    "home.incidentsTitle": "Incidents & Announcements",
    "filters.searchNodes": "Search nodes / tags",
    "filters.allRegions": "All regions",
    "filters.all": "All",
    "filters.online": "Online",
    "filters.offline": "Offline",
    "empty.noMatchingNodes": "No nodes match the filters",
    "empty.noNodes": "No nodes yet. Add and deploy agents from admin.",
    "empty.noProbeTasks": "No probe tasks yet. Create one from admin.",
    "empty.noIncidents": "No incidents or announcements. Systems are stable.",
    "table.probe": "Probe",
    "table.protocol": "Protocol",
    "table.latency": "Latency",
    "table.loss": "Packet Loss",
    "table.availabilityTrend": "Availability Trend",
    "table.status": "Status",
    "table.line": "Line",
    "table.target": "Target",
    "footer.refreshEvery": ({ seconds }) => `Data refreshes every ${seconds} seconds`,
    "footer.lastUpdated": ({ seconds }) => `Last updated: ${seconds} second${seconds === 1 ? "" : "s"} ago`,
    "node.downlink": "Download",
    "node.uplink": "Upload",
    "node.uptime": "Uptime",
    "node.cpuTrend": "CPU Trend",
    "node.offline": "Node Offline",
    "node.lastOnline": ({ time }) => `Last online ${time}`,
    "node.backHome": "Back Home",
    "node.loadFailed": ({ error }) => `Node load failed: ${error}`,
    "node.notFound": "Node not found",
    "node.version": "Version",
    "node.offlineNoData": "Node is offline. No resource data is available.",
    "node.cpuUsage": "CPU Usage",
    "node.memUsage": "Memory Usage",
    "node.diskUsage": "Disk Usage",
    "node.systemLoad": "System Load",
    "node.downloadTraffic": "Download Traffic",
    "node.uploadTraffic": "Upload Traffic",
    "node.resourceHistoryTitle": "Resource Usage · Last 30 Minutes",
    "node.resourceHistorySubtitle": "CPU / Memory / Disk",
    "node.resourceHistoryEmpty": "No resource history data",
    "node.trafficHistoryTitle": "Network Traffic · Last 30 Minutes",
    "node.trafficHistorySubtitle": "↓ Download / ↑ Upload",
    "node.trafficHistoryEmpty": "No traffic history data",
    "node.probesTitle": ({ count }) => `Probes for this node ${count}`,
    "node.probesEmpty": "No probe tasks are configured for this node",
    "probe.loadFailed": ({ error }) => `Probe load failed: ${error}`,
    "probe.notFound": "Probe not found",
    "probe.sourceNode": "Source node",
    "probe.interval": ({ seconds }) => `Probe interval ${seconds}s`,
    "probe.currentLatency": "Current Latency",
    "probe.avgLatency": "Average Latency",
    "probe.packetLoss": "Packet Loss",
    "probe.availability": "Availability",
    "probe.historyTitle": "Latency / Loss / Jitter · Last 30 Minutes",
    "probe.historyLegendAlert": "Red line=latency (alert) · red bars=loss · amber dashed line=jitter",
    "probe.historyLegendNormal": "Green line=latency · amber dashed line=jitter",
    "probe.historyEmpty": "No probe history data",
    "probe.publicNote": "· Public view, fixed to the last 30 minutes. Data refreshes every 10 seconds.",
    "notFound.message": "Page not found",
    "chart.latencyMs": "Latency (ms)",
    "chart.lossPct": "Packet Loss (%)",
    "chart.jitterMs": "Jitter (ms)",
    "chart.memory": "Memory",
    "chart.disk": "Disk",
    "chart.download": "↓ Download",
    "chart.upload": "↑ Upload",
    "unit.day": ({ count }) => `${count} day${count === 1 ? "" : "s"}`,
    "unit.hour": ({ count }) => `${count} hour${count === 1 ? "" : "s"}`,
    "unit.minute": ({ count }) => `${count} minute${count === 1 ? "" : "s"}`,
    "unit.secondAgo": ({ count }) => `${count} second${count === 1 ? "" : "s"} ago`,
    "unit.minuteAgo": ({ count }) => `${count} minute${count === 1 ? "" : "s"} ago`,
    "unit.hourAgo": ({ count }) => `${count} hour${count === 1 ? "" : "s"} ago`,
    "unit.dayAgo": ({ count }) => `${count} day${count === 1 ? "" : "s"} ago`,
  },
};

export function normalizeLang(value) {
  if (!value) return null;
  const lang = String(value).trim().toLowerCase().replace("_", "-");
  if (lang === "en" || lang.startsWith("en-")) return "en";
  if (lang === "zh" || lang.startsWith("zh-")) return "zh";
  return null;
}

export function readUrlLang() {
  if (typeof window === "undefined") return null;
  return normalizeLang(new URLSearchParams(window.location.search).get("lang"));
}

export function readStoredLang() {
  try {
    return normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

export function resolveInitialLang() {
  const urlLang = readUrlLang();
  if (urlLang) return urlLang;
  const storedLang = readStoredLang();
  if (storedLang) return storedLang;
  const browserLang = typeof navigator !== "undefined" ? normalizeLang(navigator.language) : null;
  return browserLang || "zh";
}

export function persistLang(lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, normalizeLang(lang) || "zh");
  } catch (e) {
    /* noop */
  }
}

export function writeLangToUrl(lang) {
  if (typeof window === "undefined" || !window.history) return;
  const next = normalizeLang(lang) || "zh";
  const url = new URL(window.location.href);
  url.searchParams.set("lang", next);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export function localizeBrand(rawBrand, lang) {
  const current = DEFAULT_BRAND[normalizeLang(lang) || "zh"];
  const raw = rawBrand || {};
  const name = raw.name && !DEFAULT_NAMES.has(raw.name) ? raw.name : current.name;
  const subtitle = raw.subtitle && !DEFAULT_SUBTITLES.has(raw.subtitle) ? raw.subtitle : current.subtitle;
  return {
    name,
    subtitle,
    mark: raw.mark || "NC",
    logo: raw.logo || "",
  };
}

export function translate(lang, key, vars) {
  const normalized = normalizeLang(lang) || "zh";
  const value = (MESSAGES[normalized] && MESSAGES[normalized][key]) || MESSAGES.zh[key] || key;
  if (typeof value === "function") return value(vars || {});
  if (!vars) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] == null ? "" : String(vars[name])));
}

export function formatRelativeTime(ms, lang = "zh") {
  if (!ms) return "—";
  const t = (key, count) => translate(lang, key, { count });
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return t("unit.secondAgo", seconds);
  if (seconds < 3600) return t("unit.minuteAgo", Math.floor(seconds / 60));
  if (seconds < 86400) return t("unit.hourAgo", Math.floor(seconds / 3600));
  return t("unit.dayAgo", Math.floor(seconds / 86400));
}

export function formatUptimeDays(days, lang = "zh") {
  const d = Number(days) || 0;
  const t = (key, count) => translate(lang, key, { count });
  if (d >= 1) return t("unit.day", Math.floor(d));
  const hours = d * 24;
  if (hours >= 1) return t("unit.hour", Math.floor(hours));
  return t("unit.minute", Math.max(0, Math.round(d * 1440)));
}
