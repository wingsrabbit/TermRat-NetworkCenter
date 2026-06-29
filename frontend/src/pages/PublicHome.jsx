/* ============================================================
   ONC — 公开主页 (/)（接后端真数据）
   ============================================================ */
import React, { useState } from "react";
import { useApp, ThemeToggle, Brand, LanguageSwitch } from "../store.jsx";
import { Ic, Tag, StatusDot, Bar, Empty, Latency } from "../ui.jsx";
import { Sparkline } from "../sparkline.jsx";
import { DB, fmtTraffic, fmtUptime, fmtNum } from "../data.js";   // 纯函数 usageLevel + 显示格式化
import { useOverview } from "../api.js";

export function PublicHome() {
  const { navigate, secondsAgo, brand, adminPath, lang, t } = useApp();
  const { data: db, error } = useOverview(10000, lang);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");

  // 首次加载 / 加载失败
  if (!db) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "var(--bg)" }}>
        <Brand />
        <div className="muted">{error ? t("state.loadFailedRetry", { error }) : t("state.loading")}</div>
      </div>
    );
  }

  const regions = ["all", ...Array.from(new Set(db.nodes.map((n) => n.region).filter(Boolean)))];
  const hasIssue = db.kpi.offline > 0 || db.kpi.alerts > 0;
  const issueCount = db.kpi.offline + db.tasks.filter((t) => t.alerting).length;

  const filtered = db.nodes.filter((n) => {
    if (region !== "all" && n.region !== region) return false;
    if (status !== "all" && n.status !== status) return false;
    if (q && !(n.name.toLowerCase().includes(q.toLowerCase()) || n.tags.join(" ").toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100%", background: "var(--bg)" }}>
      {/* 顶栏 */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
        <div className="container row between" style={{ height: 60 }}>
          <Brand />
          <div className="row gap-8">
            <LanguageSwitch />
            <ThemeToggle />
            <button className="btn soft sm" onClick={() => navigate(`/${adminPath}`)}><Ic name="logout" size={14} />{t("header.adminLogin")}</button>
          </div>
        </div>
      </header>

      <div className="container" style={{ padding: "28px 24px 64px" }}>
        {/* 总览横幅 */}
        <div className="card card-pad fade-up" style={{
          borderLeft: "3px solid " + (hasIssue ? "var(--red)" : "var(--green)"),
          background: hasIssue ? "var(--red-soft)" : "var(--green-soft)", borderColor: "transparent",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Ic name={hasIssue ? "warnTri" : "checkCircle"} size={22} style={{ color: hasIssue ? "var(--red)" : "var(--green)" }} />
          </div>
          <div>
            <div className="h2" style={{ color: hasIssue ? "var(--red)" : "var(--green)" }}>
              {hasIssue ? t("status.issueTitle", { count: issueCount }) : t("status.allOperational")}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {hasIssue ? t("status.issueDesc") : t("status.allOperationalDesc")}
            </div>
          </div>
        </div>

        {/* 节点状态 */}
        <section style={{ marginTop: 30 }}>
          <div className="row between wrap gap-12" style={{ marginBottom: 16 }}>
            <div>
              <div className="eyebrow">{t("home.serverEyebrow")}</div>
              <h2 className="h1" style={{ marginTop: 4 }}>{t("home.serverTitle")}</h2>
            </div>
            <div className="row gap-8 wrap">
              <div className="search"><Ic name="search" /><input className="input" style={{ width: 200 }} placeholder={t("filters.searchNodes")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <select className="select" style={{ width: 130 }} value={region} onChange={(e) => setRegion(e.target.value)}>
                {regions.map((r) => <option key={r} value={r}>{r === "all" ? t("filters.allRegions") : r}</option>)}
              </select>
              <div className="seg">
                {["all", "online", "offline"].map((s) => <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>{t("filters." + s)}</button>)}
              </div>
            </div>
          </div>
          <div className="grid nodes">
            {filtered.map((n, i) => <NodeCard key={n.id} node={n} delay={i * 50} lang={lang} t={t} onClick={() => navigate("/node/" + n.id)} />)}
          </div>
          {filtered.length === 0 && <Empty text={db.nodes.length ? t("empty.noMatchingNodes") : t("empty.noNodes")} />}
        </section>

        {/* 网络质量 */}
        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">{t("home.networkEyebrow")}</div>
          <h2 className="h1" style={{ marginTop: 4, marginBottom: 16 }}>{t("home.networkTitle")}</h2>
          <div className="card fade-up">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t("table.probe")}</th><th>{t("table.protocol")}</th><th>{t("table.latency")}</th><th>{t("table.loss")}</th><th style={{ width: 140 }}>{t("table.availabilityTrend")}</th><th>{t("table.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {db.tasks.map((task) => (
                    <tr key={task.id} style={{ cursor: "pointer" }} onClick={() => navigate("/probe/" + task.id)}>
                      <td>
                        <div style={{ fontWeight: 540 }}>{task.name}</div>
                        <div className="muted mono" style={{ fontSize: 12 }}>{task.source} <Ic name="arrowRight" size={11} style={{ verticalAlign: "-1px", margin: "0 2px" }} /> {task.target}{task.port ? ":" + task.port : ""}</div>
                      </td>
                      <td><Tag tone={db.protoColors[task.proto]} className="proto-tag">{task.proto}</Tag></td>
                      <td><Latency ms={task.latency} /></td>
                      <td className="num" style={{ color: task.loss > 0 ? "var(--red)" : "var(--text-2)", fontWeight: task.loss > 0 ? 600 : 400 }}>{task.hasData ? fmtNum(task.loss) + "%" : "—"}</td>
                      <td><Sparkline data={task.spark} tone={task.alerting ? "red" : "green"} width={120} /></td>
                      <td>
                        {task.alerting
                          ? <span className="row gap-6"><StatusDot status="offline" pulse /><span style={{ color: "var(--red)", fontWeight: 540 }}>{t("status.alerting")}</span></span>
                          : task.hasData
                            ? <span className="row gap-6"><StatusDot status="online" /><span className="muted">{t("status.normal")}</span></span>
                            : <span className="row gap-6"><span className="dot" style={{ background: "var(--text-3)" }} /><span className="faint">{t("status.waitingData")}</span></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {db.tasks.length === 0 && <Empty text={t("empty.noProbeTasks")} />}
        </section>

        {/* 事件 / 公告时间线（后端事件功能为后续增量，暂空态） */}
        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">{t("home.incidentsEyebrow")}</div>
          <h2 className="h1" style={{ marginTop: 4, marginBottom: 16 }}>{t("home.incidentsTitle")}</h2>
          <div className="card card-pad fade-up">
            <Empty text={t("empty.noIncidents")} />
          </div>
        </section>
      </div>

      {/* 页脚 + 最后更新 */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--panel-2)" }}>
        <div className="container row between wrap gap-12" style={{ padding: "20px 24px", fontSize: 12.5, color: "var(--text-3)" }}>
          <span>© 2026 {brand.name} · {t("footer.refreshEvery", { seconds: 10 })}</span>
          <span className="row gap-6"><span className="dot green" style={{ width: 6, height: 6 }} />{t("footer.lastUpdated", { seconds: secondsAgo })}</span>
        </div>
      </footer>
    </div>
  );
}

/* —— 节点卡片 —— */
export function NodeCard({ node, delay, onClick, lang, t }) {
  const n = node;
  const online = n.status === "online";
  const lastCpu = n.spark && n.spark.length ? n.spark[n.spark.length - 1] : 0;
  return (
    <div className="card card-pad card-hover fade-up" style={{ animationDelay: (delay || 0) + "ms" }} onClick={onClick}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row gap-8">
          <StatusDot status={n.status} pulse={!online} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{n.name}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{n.ip && n.ip !== "-" ? n.ip + " · " : ""}v{n.version}</div>
          </div>
        </div>
        <Tag tone={online ? "green" : "red"}>{online ? t("status.online") : t("status.offline")}</Tag>
      </div>

      <div className="row gap-6 wrap" style={{ marginBottom: 14 }}>
        {n.tags.map((t) => <Tag key={t}>{t}</Tag>)}
      </div>

      {online ? (
        <React.Fragment>
          <div className="col gap-8">
            <Bar label="CPU" value={n.cpu} />
            <Bar label={t("chart.memory")} value={n.mem} />
            <Bar label={t("chart.disk")} value={n.disk} />
          </div>
          <div className="divider" style={{ margin: "14px 0" }} />
          <div className="row between" style={{ fontSize: 12.5 }}>
            <span className="row gap-4 muted" title={t("node.downlink")}><Ic name="arrowDown" size={13} style={{ color: "var(--green)" }} /><span className="num">{fmtTraffic(n.netIn)}</span></span>
            <span className="row gap-4 muted" title={t("node.uplink")}><Ic name="arrowUp" size={13} style={{ color: "var(--primary)" }} /><span className="num">{fmtTraffic(n.netOut)}</span></span>
            <span className="row gap-4 muted" title={t("node.uptime")}><Ic name="clock" size={13} /><span className="num">{fmtUptime(n.uptimeDays, lang)}</span></span>
          </div>
          <div className="row between" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <span className="faint" style={{ fontSize: 11.5 }}>{t("node.cpuTrend")}</span>
            <Sparkline data={n.spark} tone={DB.usageLevel(lastCpu)} width={130} height={28} />
          </div>
        </React.Fragment>
      ) : (
        <div style={{ padding: "18px 0 8px", textAlign: "center" }}>
          <div className="row center gap-6" style={{ color: "var(--red)", fontWeight: 540, fontSize: 13 }}>
            <Ic name="warnTri" size={15} />{t("node.offline")}
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{t("node.lastOnline", { time: n.lastSeen })}</div>
        </div>
      )}
    </div>
  );
}
