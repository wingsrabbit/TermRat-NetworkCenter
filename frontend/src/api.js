/* ============================================================
   ONC — 前端数据接入（调用后端 REST，替代 mock）
   - useOverview(): 拉 /api/public/overview，轮询，归一化成页面所需结构
   - getNodeHistory / getTaskHistory: 详情页历史曲线（v0.x 详情页用）
   ============================================================ */
import { useState, useEffect } from "react";

const PROTO_COLORS = { ICMP: "blue", TCP: "green", UDP: "amber", HTTP: "blue", DNS: "green" };

function relTime(ms) {
  if (!ms) return "—";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s} 秒前`;
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  return `${Math.floor(s / 86400)} 天前`;
}

/** 把后端 overview 原始结构归一化成页面组件期望的字段名 */
function normalize(raw) {
  const nodes = (raw.nodes || []).map((n) => ({
    id: n.id, name: n.name, region: n.region || "", tags: n.tags || [], status: n.status,
    cpu: Math.round(n.cpu ?? 0), mem: Math.round(n.mem ?? 0), disk: Math.round(n.disk ?? 0),
    load: n.load ?? 0,
    netIn: +(n.net_in ?? 0).toFixed(1), netOut: +(n.net_out ?? 0).toFixed(1),
    uptimeDays: Math.round(n.uptime_days ?? 0),
    ip: n.public_ip || "-", version: n.agent_version || "?",
    spark: (n.spark || []).map((v) => Math.round(v)),
    lastSeen: relTime(n.last_seen),
  }));
  const nameById = Object.fromEntries(nodes.map((n) => [n.id, n.name]));
  const tasks = (raw.tasks || []).map((t) => {
    const latest = t.latest;
    return {
      id: t.id, name: t.name, proto: (t.protocol || "").toUpperCase(),
      source: nameById[t.source_node_id] || t.source_node_id,
      target: t.target_address || nameById[t.target_node_id] || "-",
      port: t.target_port,
      latency: latest ? latest.latency : null,
      loss: latest ? (latest.packet_loss ?? 0) : 0,
      spark: (t.spark || []).map((v) => +(+v).toFixed(1)),
      alerting: !!(latest && latest.success === 0),  // 最近一次失败 → 视为异常
      hasData: !!latest,
    };
  });
  const s = raw.summary || {};
  return {
    nodes, tasks, protoColors: PROTO_COLORS,
    kpi: {
      offline: s.offline || 0, online: s.online || 0, nodesTotal: s.nodes_total || 0,
      tasksTotal: s.tasks_total || 0, alerts: tasks.filter((t) => t.alerting).length,
    },
  };
}

/** 拉总览 + 定时轮询。返回 { data, error }，data 为 null 表示加载中。 */
export function useOverview(intervalMs = 10000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/public/overview");
        if (!r.ok) throw new Error("HTTP " + r.status);
        const raw = await r.json();
        if (alive) { setData(normalize(raw)); setError(null); }
      } catch (e) {
        if (alive) setError(e.message || String(e));
      }
    }
    load();
    const t = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [intervalMs]);
  return { data, error };
}

export function getNodeHistory(id, minutes = 30) {
  return fetch(`/api/public/node/${id}/history?minutes=${minutes}`).then((r) => r.json());
}
export function getTaskHistory(id, minutes = 30) {
  return fetch(`/api/public/task/${id}/history?minutes=${minutes}`).then((r) => r.json());
}
