/* ============================================================
   ONC — 公开版 线路详情 (/probe/:id)（接后端真数据）
   ============================================================ */
import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../store.jsx";
import { Ic, Tag, Empty } from "../ui.jsx";
import { DB, fmtLatency, fmtNum } from "../data.js";
import { ProbeMiniChart } from "../charts.jsx";
import { PublicShell, MiniStat } from "./NodeDetail.jsx";
import { getTaskDetail, getTaskHistory } from "../api.js";

const PROTO_COLORS = { ICMP: "blue", TCP: "green", UDP: "amber", HTTP: "blue", DNS: "green" };

export function ProbeDetail({ id }) {
  const { navigate, tick, lang, t } = useApp();
  const [task, setTask] = useState(null);
  const [hist, setHist] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [detail, h] = await Promise.all([getTaskDetail(id), getTaskHistory(id, 30)]);
        if (!alive) return;
        if (detail && detail.task) {
          setTask(detail.task);
          setHist(h && h.history ? h.history : []);
          setError(null);
        } else {
          setTask(null);
          setError(detail && detail.error ? detail.error : "not found");
        }
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoaded(true);
      }
    }
    load();
    return () => { alive = false; };
  }, [id, tick]);

  // 历史 → 图表所需结构 {ts, latency, loss, jitter}
  const chartData = useMemo(
    () => hist.map((d) => ({ ts: d.ts, latency: d.latency, loss: d.packet_loss ?? 0, jitter: d.jitter ?? 0 })),
    [hist]
  );

  // 统计：当前延迟 / 平均延迟 / 丢包率 / 可用率（success 比例）
  const stats = useMemo(() => {
    if (!hist.length) return { cur: null, avg: null, loss: null, avail: null };
    const lats = hist.map((d) => d.latency).filter((v) => v != null);
    const last = hist[hist.length - 1];
    const avg = lats.length ? lats.reduce((a, b) => a + b, 0) / lats.length : null;
    const lossArr = hist.map((d) => d.packet_loss ?? 0);
    const lossAvg = lossArr.reduce((a, b) => a + b, 0) / hist.length;
    const okCount = hist.filter((d) => d.success === 1).length;
    return {
      cur: last && last.latency != null ? last.latency : null,
      avg: avg != null ? avg : null,
      loss: lossAvg,
      avail: (okCount / hist.length) * 100,
    };
  }, [hist]);

  if (!loaded) {
    return <PublicShell><div className="card card-pad"><div className="muted">{t("state.loading")}</div></div></PublicShell>;
  }
  if (!task) {
    return <PublicShell><div className="card"><Empty text={error ? t("probe.loadFailed", { error }) : t("probe.notFound")} /></div></PublicShell>;
  }

  const proto = (task.protocol || "").toUpperCase();
  const source = task.source_node_id || t("probe.sourceNode");
  const target = task.target_address || task.target_node_id || "-";
  const alerting = task.alert_status === "alerting";

  return (
    <PublicShell>
      <button className="btn sm" style={{ marginBottom: 16 }} onClick={() => navigate("/")}><Ic name="chevLeft" size={15} />{t("node.backHome")}</button>

      <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
        <div className="row between wrap gap-12">
          <div className="row gap-10" style={{ alignItems: "center" }}>
            <Tag tone={PROTO_COLORS[proto] || "gray"} className="proto-tag">{proto}</Tag>
            <h1 className="h1" style={{ fontSize: 20 }}>{task.name}</h1>
            {alerting ? <Tag tone="red" dot>{t("status.alerting")}</Tag> : <Tag tone="green" dot>{t("status.normal")}</Tag>}
          </div>
        </div>
        <div className="muted mono" style={{ fontSize: 13, marginTop: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ whiteSpace: "nowrap" }}>{source}</span>
          <Ic name="arrowRight" size={13} />
          <span style={{ whiteSpace: "nowrap" }}>{target}{task.target_port ? ":" + task.target_port : ""}</span>
          {task.interval ? <span className="faint" style={{ whiteSpace: "nowrap" }}>· {t("probe.interval", { seconds: task.interval })}</span> : null}
        </div>
      </div>

      {/* 统计小卡 */}
      <div className="grid mini fade-up" style={{ marginBottom: 18 }}>
        <MiniStat label={t("probe.currentLatency")} value={stats.cur != null ? fmtLatency(stats.cur) : "—"} suffix={stats.cur != null ? "ms" : ""} icon="activity" level={stats.cur != null ? DB.latencyLevel(stats.cur) : null} />
        <MiniStat label={t("probe.avgLatency")} value={stats.avg != null ? fmtLatency(stats.avg) : "—"} suffix={stats.avg != null ? "ms" : ""} icon="signal" level={stats.avg != null ? DB.latencyLevel(stats.avg) : null} />
        <MiniStat label={t("probe.packetLoss")} value={stats.loss != null ? fmtNum(stats.loss) : "—"} suffix={stats.loss != null ? "%" : ""} icon="warnTri" tone={stats.loss > 0 ? "var(--red)" : "var(--green)"} />
        <MiniStat label={t("probe.availability")} value={stats.avail != null ? fmtNum(stats.avail) : "—"} suffix={stats.avail != null ? "%" : ""} icon="checkCircle" tone={stats.avail != null && stats.avail < 99 ? "var(--amber)" : "var(--green)"} />
      </div>

      {/* 历史曲线 */}
      <div className="card card-pad fade-up">
        <div className="card-head">
          <div>
            <h3 className="h3">{t("probe.historyTitle")}</h3>
            <span className="faint" style={{ fontSize: 12 }}>{alerting ? t("probe.historyLegendAlert") : t("probe.historyLegendNormal")}</span>
          </div>
        </div>
        {chartData.length ? <ProbeMiniChart data={chartData} lang={lang} /> : <Empty text={t("probe.historyEmpty")} />}
        <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>{t("probe.publicNote")}</div>
      </div>
    </PublicShell>
  );
}
