/* ============================================================
   TermRat — 管理端仪表盘（KPI + 任务卡片网格，接 /api/public/overview）
   ============================================================ */
import React, { useState, useMemo } from "react";
import { useApp } from "../../store.jsx";
import { Ic, Tag, StatusDot, Bar, Empty, Latency, StatCard } from "../../ui.jsx";
import { Sparkline } from "../../sparkline.jsx";
import { DB, fmtTraffic, fmtNum } from "../../data.js";
import { useOverview } from "../../api.js";

const PROTOS = ["全部", "ICMP", "TCP", "UDP", "HTTP", "DNS"];

export function Dashboard() {
  const { navigate } = useApp();
  const { data: db, error } = useOverview();
  const [q, setQ] = useState("");
  const [proto, setProto] = useState("全部");

  // 平均延迟（仅统计有数据的任务）
  const avgLatency = useMemo(() => {
    if (!db) return 0;
    const arr = db.tasks.map((t) => t.latency).filter((v) => v != null);
    if (!arr.length) return 0;
    return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
  }, [db]);

  if (!db) {
    return (
      <div className="card card-pad">
        <div className="muted">{error ? `加载失败：${error}（重试中…）` : "加载中…"}</div>
      </div>
    );
  }

  const tasks = db.tasks.filter((t) => {
    if (proto !== "全部" && t.proto !== proto) return false;
    if (q) {
      const s = (t.name + " " + t.source + " " + t.target).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="col gap-24">
      {/* KPI */}
      <div className="grid kpi">
        <StatCard label="节点数" icon="nodes" value={db.kpi.nodesTotal} delay={0} />
        <StatCard label="在线节点" icon="checkCircle" value={db.kpi.online} tone="var(--green)" sub={`离线 ${db.kpi.offline}`} delay={40} />
        <StatCard label="活跃告警" icon="bell" value={db.kpi.alerts} tone={db.kpi.alerts ? "var(--red)" : "var(--green)"} delay={80} />
        <StatCard label="平均延迟" icon="activity" value={avgLatency} decimals={2} suffix=" ms" tone={avgLatency >= 200 ? "var(--red)" : avgLatency >= 50 ? "var(--amber)" : "var(--green)"} delay={120} />
      </div>

      {/* 筛选条 */}
      <div className="card card-pad fade-up" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search grow" style={{ minWidth: 220, maxWidth: 360 }}>
          <Ic name="search" /><input className="input" placeholder="搜索任务 / 目标 / 节点" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row gap-6">
          <span className="label">协议</span>
          <select className="select" style={{ width: 120 }} value={proto} onChange={(e) => setProto(e.target.value)}>
            {PROTOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* 任务卡片网格 */}
      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 className="h2">探测任务 <span className="faint" style={{ fontWeight: 400 }}>{tasks.length}</span></h2>
        </div>
        {tasks.length === 0 ? (
          <div className="card"><Empty text={db.tasks.length ? "没有符合条件的任务" : "暂无探测任务，请在任务管理中创建"} /></div>
        ) : (
          <div className="grid cards-4">
            {tasks.map((t, i) => <TaskCard key={t.id} task={t} protoColors={db.protoColors} delay={i * 50} onClick={() => navigate("/termadmin/dashboard/" + t.id)} />)}
          </div>
        )}
      </section>

      {/* 节点资源迷你卡（体现融合监控） */}
      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 className="h2">节点资源 <span className="faint" style={{ fontWeight: 400 }}>实时</span></h2>
          <span className="label">服务器监控 · 网络探测 融合视图</span>
        </div>
        {db.nodes.length === 0 ? (
          <div className="card"><Empty text="暂无节点" /></div>
        ) : (
          <div className="grid mini">
            {db.nodes.map((n, i) => <ResourceMini key={n.id} node={n} delay={i * 40} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/* —— 任务卡片 —— */
function TaskCard({ task, protoColors, delay, onClick }) {
  const t = task;
  return (
    <div className="card card-pad card-hover fade-up" style={{ animationDelay: (delay || 0) + "ms", position: "relative" }} onClick={onClick}>
      {t.alerting && <span className="dot red pulse" style={{ position: "absolute", top: 14, right: 14 }} />}
      <div className="row gap-8" style={{ marginBottom: 10 }}>
        <Tag tone={protoColors[t.proto] || "gray"} className="proto-tag">{t.proto}</Tag>
        <span style={{ fontWeight: 600, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
      </div>
      <div className="muted mono" style={{ fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <span>{t.source}</span><Ic name="arrowRight" size={12} /><span>{t.target}{t.port ? ":" + t.port : ""}</span>
      </div>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div className="col gap-2">
          <span className="faint" style={{ fontSize: 11 }}>延迟</span>
          <Latency ms={t.latency} big />
        </div>
        <div className="col gap-2" style={{ textAlign: "center" }}>
          <span className="faint" style={{ fontSize: 11 }}>丢包</span>
          <span className="num" style={{ fontWeight: 600, color: t.loss > 0 ? "var(--red)" : "var(--text)" }}>{t.hasData ? fmtNum(t.loss) + "%" : "—"}</span>
        </div>
        <Sparkline data={t.spark} tone={t.alerting ? "red" : DB.latencyLevel(t.latency)} width={72} height={26} />
      </div>
    </div>
  );
}

/* —— 节点资源迷你卡 —— */
function ResourceMini({ node, delay }) {
  const n = node;
  const online = n.status === "online";
  return (
    <div className="card card-pad fade-up" style={{ animationDelay: (delay || 0) + "ms", padding: "14px 16px" }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="row gap-6" style={{ fontWeight: 540, fontSize: 13 }}><StatusDot status={n.status} pulse={!online} />{n.name}</span>
        <span className="faint" style={{ fontSize: 11 }}>{online ? "load " + fmtNum(n.load) : "离线"}</span>
      </div>
      {online ? (
        <div className="col gap-6">
          <Bar label="CPU" value={n.cpu} />
          <Bar label="内存" value={n.mem} />
          <Bar label="磁盘" value={n.disk} />
          <div className="row between faint" style={{ fontSize: 11, marginTop: 2 }}>
            <span>↓ <span className="num">{fmtTraffic(n.netIn)}</span></span>
            <span>↑ <span className="num">{fmtTraffic(n.netOut)}</span></span>
          </div>
        </div>
      ) : <div className="faint" style={{ fontSize: 12, padding: "8px 0" }}>最后在线 {n.lastSeen}</div>}
    </div>
  );
}
