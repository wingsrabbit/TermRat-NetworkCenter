/* ============================================================
   ONC — 公开版 节点详情 (/node/:id)（接后端真数据）
   ============================================================ */
import React, { useState, useEffect } from "react";
import { useApp, ThemeToggle, Brand, LanguageSwitch } from "../store.jsx";
import { Ic, Tag, StatusDot, Empty } from "../ui.jsx";
import { DB, fmtTraffic, fmtUptime } from "../data.js";
import { ResourceChart, TrafficChart } from "../charts.jsx";
import { getNodeDetail, getNodeHistory } from "../api.js";

const PROTO_COLORS = { ICMP: "blue", TCP: "green", UDP: "amber", HTTP: "blue", DNS: "green" };

/* —— 公开页通用外壳：顶栏 + 容器 + 页脚 —— */
export function PublicShell({ children }) {
  const { navigate, brand, adminPath, t } = useApp();
  return (
    <div style={{ minHeight: "100%", background: "var(--bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
        <div className="container row between" style={{ height: 60 }}>
          <div style={{ cursor: "pointer" }} onClick={() => navigate("/")}><Brand /></div>
          <div className="row gap-8">
            <LanguageSwitch />
            <ThemeToggle />
            <button className="btn soft sm" onClick={() => navigate(`/${adminPath}`)}><Ic name="logout" size={14} />{t("header.adminLogin")}</button>
          </div>
        </div>
      </header>
      <div className="container" style={{ padding: "24px 24px 64px" }}>{children}</div>
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--panel-2)" }}>
        <div className="container" style={{ padding: "20px 24px", fontSize: 12.5, color: "var(--text-3)" }}>© 2026 {brand.name} · {t("footer.refreshEvery", { seconds: 10 })}</div>
      </footer>
    </div>
  );
}

/* —— 即时值小卡 —— */
export function MiniStat({ label, value, suffix, icon, tone, level }) {
  let color = tone;
  if (level) color = level === "green" ? "var(--green)" : level === "amber" ? "var(--amber)" : level === "red" ? "var(--red)" : undefined;
  return (
    <div className="card card-pad" style={{ padding: "13px 16px" }}>
      <div className="faint row gap-4" style={{ fontSize: 11.5 }}>{icon && <Ic name={icon} size={12} style={{ color }} />}{label}</div>
      <div className="num" style={{ fontSize: 21, fontWeight: 640, marginTop: 4, color }}>{value}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>{suffix ? " " + suffix : ""}</span></div>
    </div>
  );
}

export function NodeDetail({ id }) {
  const { navigate, tick, lang, t } = useApp();
  const [node, setNode] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [hist, setHist] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [detail, h] = await Promise.all([getNodeDetail(id), getNodeHistory(id, 30)]);
        if (!alive) return;
        if (detail && detail.node) {
          setNode(detail.node);
          setTasks(detail.tasks || []);
          setHist(h && h.history ? h.history : []);
          setError(null);
        } else {
          setNode(null);
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

  // 首次加载
  if (!loaded) {
    return <PublicShell><div className="card card-pad"><div className="muted">{t("state.loading")}</div></div></PublicShell>;
  }
  if (!node) {
    return <PublicShell><div className="card"><Empty text={error ? t("node.loadFailed", { error }) : t("node.notFound")} /></div></PublicShell>;
  }

  const online = node.status === "online";
  const tags = node.tags || [];
  const ip = node.public_ip || "-";
  const version = node.agent_version || "?";
  const uptime = Math.round(node.uptime_days ?? 0);
  // 资源历史 → 图表所需结构
  const resData = hist.map((d) => ({ ts: d.ts, cpu: Math.round(d.cpu ?? 0), mem: Math.round(d.mem ?? 0), disk: Math.round(d.disk ?? 0) }));
  const netData = hist.map((d) => ({ ts: d.ts, netIn: d.net_in ?? 0, netOut: d.net_out ?? 0 }));

  const cpu = Math.round(node.cpu ?? 0);
  const mem = Math.round(node.mem ?? 0);
  const disk = Math.round(node.disk ?? 0);
  const netIn = +(node.net_in ?? 0).toFixed(1);
  const netOut = +(node.net_out ?? 0).toFixed(1);

  return (
    <PublicShell>
      <button className="btn sm" style={{ marginBottom: 16 }} onClick={() => navigate("/")}><Ic name="chevLeft" size={15} />{t("node.backHome")}</button>

      {/* 头部 */}
      <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
        <div className="row between wrap gap-12">
          <div className="row gap-10" style={{ alignItems: "center" }}>
            <StatusDot status={node.status} pulse={!online} />
            <h1 className="h1" style={{ fontSize: 20 }}>{node.name}</h1>
            <Tag tone={online ? "green" : "red"} dot>{online ? t("status.online") : t("status.offline")}</Tag>
          </div>
          <div className="row gap-6 wrap">{tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
        </div>
        <div className="row gap-24 wrap" style={{ marginTop: 14, fontSize: 13 }}>
          {ip !== "-" && <span className="muted">IP <span className="mono" style={{ color: "var(--text)" }}>{ip}</span></span>}
          <span className="muted">{t("node.version")} <span className="mono" style={{ color: "var(--text)" }}>v{version}</span></span>
          <span className="muted">{t("node.uptime")} <span className="num" style={{ color: "var(--text)" }}>{online ? fmtUptime(node.uptime_days, lang) : "—"}</span></span>
        </div>
      </div>

      {!online ? (
        <div className="card"><Empty text={t("node.offlineNoData")} /></div>
      ) : (
        <React.Fragment>
          {/* 即时值小卡 */}
          <div className="grid mini fade-up" style={{ marginBottom: 18 }}>
            <MiniStat label={t("node.cpuUsage")} value={cpu} suffix="%" icon="cpu" level={DB.usageLevel(cpu)} />
            <MiniStat label={t("node.memUsage")} value={mem} suffix="%" icon="activity" level={DB.usageLevel(mem)} />
            <MiniStat label={t("node.diskUsage")} value={disk} suffix="%" icon="dashboard" level={DB.usageLevel(disk)} />
            <MiniStat label={t("node.systemLoad")} value={+(node.load ?? 0).toFixed(2)} icon="signal" />
            <MiniStat label={t("node.downloadTraffic")} value={fmtTraffic(node.net_in)} icon="arrowDown" tone="var(--green)" />
            <MiniStat label={t("node.uploadTraffic")} value={fmtTraffic(node.net_out)} icon="arrowUp" tone="var(--primary)" />
          </div>

          {/* 资源历史 */}
          <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
            <div className="card-head"><div><h3 className="h3">{t("node.resourceHistoryTitle")}</h3><span className="faint" style={{ fontSize: 12 }}>{t("node.resourceHistorySubtitle")}</span></div></div>
            {resData.length ? <ResourceChart data={resData} lang={lang} /> : <Empty text={t("node.resourceHistoryEmpty")} />}
          </div>
          <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
            <div className="card-head"><div><h3 className="h3">{t("node.trafficHistoryTitle")}</h3><span className="faint" style={{ fontSize: 12 }}>{t("node.trafficHistorySubtitle")}</span></div></div>
            {netData.length ? <TrafficChart data={netData} lang={lang} /> : <Empty text={t("node.trafficHistoryEmpty")} />}
          </div>
        </React.Fragment>
      )}

      {/* 该节点的探测线路 */}
      <section>
        <h2 className="h2" style={{ marginBottom: 12 }}>{t("node.probesTitle", { count: tasks.length })}</h2>
        <div className="card fade-up">
          {tasks.length === 0 ? <Empty text={t("node.probesEmpty")} /> : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>{t("table.line")}</th><th>{t("table.protocol")}</th><th>{t("table.target")}</th><th>{t("table.status")}</th></tr></thead>
                <tbody>
                  {tasks.map((task) => {
                    const proto = (task.protocol || "").toUpperCase();
                    const target = task.target_address || task.target_node_id || "-";
                    const alerting = task.alert_status === "alerting";
                    return (
                      <tr key={task.id} style={{ cursor: "pointer" }} onClick={() => navigate("/probe/" + task.id)}>
                        <td><div style={{ fontWeight: 540 }}>{task.name}</div></td>
                        <td><Tag tone={PROTO_COLORS[proto] || "gray"} className="proto-tag">{proto}</Tag></td>
                        <td className="muted mono" style={{ fontSize: 12 }}>{target}{task.target_port ? ":" + task.target_port : ""}</td>
                        <td>{alerting ? <span className="row gap-6"><StatusDot status="offline" pulse /><span style={{ color: "var(--red)", fontWeight: 540 }}>{t("status.alerting")}</span></span> : <span className="row gap-6"><StatusDot status="online" /><span className="muted">{t("status.normal")}</span></span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
