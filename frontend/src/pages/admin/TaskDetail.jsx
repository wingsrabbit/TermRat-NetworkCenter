/* ============================================================
   TermRat — 管理端任务详情（TimeChart + 范围选择 + 统计卡）
   接后端真数据：getTaskDetail / getTaskHistory（按范围映射 minutes）
   ============================================================ */
import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../../store.jsx";
import { Ic, Tag, Empty, StatCard } from "../../ui.jsx";
import { TimeChart } from "../../charts.jsx";
import { getTaskDetail, getTaskHistoryRange } from "../../api.js";

const PROTO_COLORS = { ICMP: "blue", TCP: "green", UDP: "amber", HTTP: "blue", DNS: "green" };

// 范围 → minutes（后端历史最大约束为 1440min，超出部分由后端自动收敛）
const RANGES = [
  { k: "30m", label: "30 分钟", minutes: 30 },
  { k: "1h", label: "1 小时", minutes: 60 },
  { k: "6h", label: "6 小时", minutes: 360 },
  { k: "24h", label: "24 小时", minutes: 1440 },
  { k: "3d", label: "3 天", minutes: 4320 },
  { k: "7d", label: "7 天", minutes: 10080 },
  { k: "14d", label: "14 天", minutes: 20160 },
  { k: "30d", label: "30 天", minutes: 43200 },
];

export function TaskDetail({ taskId }) {
  const { navigate, tick } = useApp();
  const [task, setTask] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [range, setRange] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [hist, setHist] = useState([]);
  const [meta, setMeta] = useState(null);   // 分桶元信息 {bucket_seconds, buckets_total, buckets_with_data, unit}

  // 任务元信息（随轮询刷新告警状态）
  useEffect(() => {
    let alive = true;
    getTaskDetail(taskId).then((d) => {
      if (!alive) return;
      if (d && d.task) { setTask(d.task); setNotFound(false); }
      else { setTask(null); setNotFound(true); }
    }).catch(() => { if (alive) setNotFound(true); });
    return () => { alive = false; };
  }, [taskId, tick]);

  // 历史（按时间档后端分桶聚合 + 轮询刷新）
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getTaskHistoryRange(taskId, range).then((d) => {
      if (!alive) return;
      setHist(d && d.history ? d.history : []);
      setMeta(d || null);
      setLoading(false);
    }).catch(() => { if (alive) { setHist([]); setMeta(null); setLoading(false); } });
    return () => { alive = false; };
  }, [range, taskId, tick]);

  const data = useMemo(
    () => hist.map((d) => ({ ts: d.ts, latency: d.latency, loss: d.packet_loss ?? 0, jitter: d.jitter ?? 0 })),
    [hist]
  );

  const stats = useMemo(() => {
    const lat = data.map((d) => d.latency).filter((v) => v != null);
    if (!lat.length) return null;
    const sorted = [...lat].sort((a, b) => a - b);
    const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    const jit = data.map((d) => d.jitter).reduce((a, b) => a + b, 0) / data.length;
    const loss = data.map((d) => d.loss).reduce((a, b) => a + b, 0) / data.length;
    return { avg, p95, jit, loss, points: data.length };
  }, [data]);

  if (notFound) {
    return (
      <div className="col gap-16 fade-up">
        <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/termadmin/dashboard")}><Ic name="chevLeft" size={15} />返回</button>
        <div className="card"><Empty text="任务不存在" /></div>
      </div>
    );
  }

  const proto = task ? (task.protocol || "").toUpperCase() : "";
  const source = task ? (task.source_node_id || "源节点") : "";
  const target = task ? (task.target_address || task.target_node_id || "-") : "";
  const alerting = task && task.alert_status === "alerting";

  return (
    <div className="col gap-20 fade-up">
      {/* 顶部返回 + 范围 */}
      <div className="row between wrap gap-12">
        <div className="row gap-12">
          <button className="btn sm" onClick={() => navigate("/termadmin/dashboard")}><Ic name="chevLeft" size={15} />返回</button>
          <div>
            <div className="row gap-8">
              {proto && <Tag tone={PROTO_COLORS[proto] || "gray"} className="proto-tag">{proto}</Tag>}
              <h2 className="h1" style={{ fontSize: 19 }}>{task ? task.name : "加载中…"}</h2>
              {alerting && <Tag tone="red" dot>告警中</Tag>}
            </div>
            {task && (
              <div className="muted mono" style={{ fontSize: 12.5, marginTop: 4 }}>
                {source} → {target}{task.target_port ? ":" + task.target_port : ""}{task.interval ? " · 间隔 " + task.interval + "s" : ""}
              </div>
            )}
          </div>
        </div>
        <select className="select" style={{ width: 130 }} value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
        </select>
      </div>

      {/* 统计卡 */}
      <div className="grid kpi">
        {loading || !stats ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card card-pad"><div className="skel" style={{ height: 14, width: 70, marginBottom: 12 }} /><div className="skel" style={{ height: 28, width: 90 }} /></div>
        )) : (
          <React.Fragment>
            <StatCard label="平均延迟" icon="activity" value={stats.avg} decimals={2} suffix=" ms" tone={stats.avg >= 200 ? "var(--red)" : stats.avg >= 50 ? "var(--amber)" : "var(--green)"} />
            <StatCard label="P95 延迟" icon="signal" value={stats.p95} decimals={2} suffix=" ms" />
            <StatCard label="窗口抖动" icon="activity" value={stats.jit} decimals={2} suffix=" ms" tone="var(--amber)" />
            <StatCard label="平均丢包" icon="warnTri" value={stats.loss} decimals={2} suffix=" %" tone={stats.loss > 0 ? "var(--red)" : "var(--green)"} />
            <StatCard label="数据点数" icon="dashboard" value={meta ? meta.buckets_with_data : stats.points} sub={meta ? `共 ${meta.buckets_total} 桶 · 每${meta.unit}` : ""} />
          </React.Fragment>
        )}
      </div>

      {/* 时序图 */}
      <div className="card card-pad">
        <div className="card-head">
          <div>
            <h3 className="h3">延迟 / 丢包 / 抖动 时序</h3>
            <span className="faint" style={{ fontSize: 12 }}>绿实线=延迟 · 红柱=丢包 · 琥珀虚线=抖动 · 支持滚轮缩放与拖拽</span>
          </div>
        </div>
        {loading ? <div className="skel" style={{ height: 360, borderRadius: 8 }} />
          : data.length ? <TimeChart data={data} range={range} />
          : <Empty text="该范围内暂无探测历史数据" />}
      </div>
    </div>
  );
}
