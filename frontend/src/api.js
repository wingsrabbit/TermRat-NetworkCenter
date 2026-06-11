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
      alertStatus: t.alert_status || "normal",
      // 阈值告警(v0.5 告警引擎) 或 最近一次探测失败 → 视为异常
      alerting: t.alert_status === "alerting" || !!(latest && latest.success === 0),
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

export function getNodeDetail(id) {
  return fetch(`/api/public/node/${id}`).then((r) => r.json());
}
export function getTaskDetail(id) {
  return fetch(`/api/public/task/${id}`).then((r) => r.json());
}
export function getNodeHistory(id, minutes = 30) {
  return fetch(`/api/public/node/${id}/history?minutes=${minutes}`).then((r) => r.json());
}
export function getTaskHistory(id, minutes = 30) {
  return fetch(`/api/public/task/${id}/history?minutes=${minutes}`).then((r) => r.json());
}

/* ============================================================
   管理端 API 客户端（带 Bearer 会话 token；!ok 抛出 data.error）
   ============================================================ */
const TOKEN_KEY = "onc-token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
}
export function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* noop */ }
}

/** 带鉴权的统一请求封装：自动加 Bearer + JSON；!ok 抛出后端 error 文案。 */
async function request(method, path, body) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  const opts = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch("/api" + path, opts);
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) {
    const msg = (data && data.error) || `请求失败（HTTP ${r.status}）`;
    throw new Error(msg);
  }
  return data == null ? {} : data;
}

/* —— 鉴权 —— */
export async function apiLogin(username, password) {
  // 登录不带旧 token（避免脏 token 干扰）
  const r = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (!r.ok) throw new Error((data && data.error) || "登录失败");
  setToken(data.token);
  return data.user; // {username, role}
}
export async function apiLogout() {
  try { await request("POST", "/auth/logout"); } catch (e) { /* 忽略：本地照常登出 */ }
  setToken("");
}
export function apiMe() { return request("GET", "/auth/me"); } // → {user}

/* —— 节点 —— */
export function apiListNodes() { return request("GET", "/nodes"); }                 // → {nodes}
export function apiCreateNode(body) { return request("POST", "/nodes", body); }      // → {id,name,token}
export function apiUpdateNode(id, body) { return request("PATCH", "/nodes/" + id, body); }
export function apiDeleteNode(id) { return request("DELETE", "/nodes/" + id); }
export function apiRegenNodeToken(id) { return request("POST", `/nodes/${id}/token`); } // → {token}

/* —— 任务 —— */
export function apiListTasks() { return request("GET", "/tasks"); }                  // → {tasks}
export function apiCreateTask(body) { return request("POST", "/tasks", body); }      // → {id}
export function apiUpdateTask(id, body) { return request("PATCH", "/tasks/" + id, body); }
export function apiDeleteTask(id) { return request("DELETE", "/tasks/" + id); }

/* —— 用户 —— */
export function apiListUsers() { return request("GET", "/users"); }                  // → {users}
export function apiCreateUser(body) { return request("POST", "/users", body); }      // → {id}
export function apiDeleteUser(id) { return request("DELETE", "/users/" + id); }
export function apiResetPassword(id, password) { return request("POST", `/users/${id}/reset-password`, { password }); }

/* —— 告警渠道 —— */
export function apiListChannels() { return request("GET", "/channels"); }            // → {channels}
export function apiCreateChannel(body) { return request("POST", "/channels", body); } // → {id}
export function apiUpdateChannel(id, body) { return request("PATCH", "/channels/" + id, body); }
export function apiDeleteChannel(id) { return request("DELETE", "/channels/" + id); }

/* —— 设置 —— */
export function apiGetSettings() { return request("GET", "/settings"); }             // → {settings}
export function apiPutSettings(body) { return request("PUT", "/settings", body); }   // → {settings}

/* —— 告警历史（任意登录角色） —— */
export function apiAlertHistory(limit = 100) { return request("GET", `/alerts/history?limit=${limit}`); } // → {history}
