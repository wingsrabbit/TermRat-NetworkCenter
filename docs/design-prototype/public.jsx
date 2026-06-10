/* ============================================================
   TermRat — 公开主页 (/)
   ============================================================ */

function PublicHome() {
  const { navigate, secondsAgo, tick } = useApp();
  const db = window.DB;
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("全部");
  const [status, setStatus] = useState("全部");

  const regions = ["全部", ...Array.from(new Set(db.nodes.map((n) => n.region)))];
  const hasIssue = db.kpi.offline > 0 || db.kpi.alerts > 0;
  const issueCount = db.kpi.offline + db.tasks.filter((t) => t.alerting).length;

  const filtered = db.nodes.filter((n) => {
    if (region !== "全部" && n.region !== region) return false;
    if (status === "在线" && n.status !== "online") return false;
    if (status === "离线" && n.status !== "offline") return false;
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
            <ThemeToggle />
            <button className="btn soft sm" onClick={() => navigate("/termadmin")}><Ic name="logout" size={14} />管理登录</button>
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
              {hasIssue ? `⚠ ${issueCount} 个节点 / 线路异常` : "✓ 所有系统运行正常"}
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {hasIssue ? "部分线路出现延迟或丢包，团队正在处理；其余服务正常。" : "全部节点在线，探测线路指标均在阈值内。"}
            </div>
          </div>
        </div>

        {/* 节点状态 */}
        <section style={{ marginTop: 30 }}>
          <div className="row between wrap gap-12" style={{ marginBottom: 16 }}>
            <div>
              <div className="eyebrow">Server Status</div>
              <h2 className="h1" style={{ marginTop: 4 }}>节点状态</h2>
            </div>
            <div className="row gap-8 wrap">
              <div className="search"><Ic name="search" /><input className="input" style={{ width: 200 }} placeholder="搜索节点 / 标签" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <select className="select" style={{ width: 130 }} value={region} onChange={(e) => setRegion(e.target.value)}>
                {regions.map((r) => <option key={r}>{r}</option>)}
              </select>
              <div className="seg">
                {["全部", "在线", "离线"].map((s) => <button key={s} className={status === s ? "active" : ""} onClick={() => setStatus(s)}>{s}</button>)}
              </div>
            </div>
          </div>
          <div className="grid nodes">
            {filtered.map((n, i) => <NodeCard key={n.id} node={n} delay={i * 50} onClick={() => navigate("/node/" + n.id)} />)}
          </div>
          {filtered.length === 0 && <Empty text="没有符合条件的节点" />}
        </section>

        {/* 网络质量 */}
        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Network Quality</div>
          <h2 className="h1" style={{ marginTop: 4, marginBottom: 16 }}>网络质量探测</h2>
          <div className="card fade-up">
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>探测线路</th><th>协议</th><th>延迟</th><th>丢包率</th><th style={{ width: 140 }}>可用率趋势</th><th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {db.tasks.map((t) => (
                    <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => navigate("/probe/" + t.id)}>
                      <td>
                        <div style={{ fontWeight: 540 }}>{t.name}</div>
                        <div className="muted mono" style={{ fontSize: 12 }}>{t.source} <Ic name="arrowRight" size={11} style={{ verticalAlign: "-1px", margin: "0 2px" }} /> {t.target}{t.port ? ":" + t.port : ""}</div>
                      </td>
                      <td><Tag tone={db.protoColors[t.proto]} className="proto-tag">{t.proto}</Tag></td>
                      <td><Latency ms={t.latency} /></td>
                      <td className="num" style={{ color: t.loss > 0 ? "var(--red)" : "var(--text-2)", fontWeight: t.loss > 0 ? 600 : 400 }}>{t.loss}%</td>
                      <td><Sparkline data={t.spark} tone={t.alerting ? "red" : "green"} width={120} /></td>
                      <td>
                        {t.alerting
                          ? <span className="row gap-6"><StatusDot status="offline" pulse /><span style={{ color: "var(--red)", fontWeight: 540 }}>告警中</span></span>
                          : <span className="row gap-6"><StatusDot status="online" /><span className="muted">正常</span></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 事件 / 公告时间线 */}
        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Incidents</div>
          <h2 className="h1" style={{ marginTop: 4, marginBottom: 16 }}>事件与公告</h2>
          <div className="card card-pad fade-up">
            <div className="timeline">
              {db.incidents.map((it) => (
                <div key={it.id} className="tl-item">
                  <div className="tl-rail"><span className={"tl-dot " + it.level} /></div>
                  <div className="tl-content">
                    <div className="tl-head">
                      <span className="h3 tl-title">{it.title}</span>
                      <Tag tone={it.level === "blue" ? "blue" : it.level} dot>{it.status}</Tag>
                      <span className="grow" />
                      <span className="faint mono tl-time">{it.time}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{it.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* 页脚 + 最后更新 */}
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--panel-2)" }}>
        <div className="container row between wrap gap-12" style={{ padding: "20px 24px", fontSize: 12.5, color: "var(--text-3)" }}>
          <span>© 2026 TermRat 网络状态中心 · 数据每 10 秒刷新</span>
          <span className="row gap-6"><span className="dot green" style={{ width: 6, height: 6 }} />最后更新：{secondsAgo} 秒前</span>
        </div>
      </footer>
    </div>
  );
}

/* —— 节点卡片 —— */
function NodeCard({ node, delay, onClick }) {
  const n = node;
  const online = n.status === "online";
  return (
    <div className="card card-pad card-hover fade-up" style={{ animationDelay: (delay || 0) + "ms" }} onClick={onClick}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="row gap-8">
          <StatusDot status={n.status} pulse={!online} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5 }}>{n.name}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{n.ip} · v{n.version}</div>
          </div>
        </div>
        <Tag tone={online ? "green" : "red"}>{online ? "在线" : "离线"}</Tag>
      </div>

      <div className="row gap-6 wrap" style={{ marginBottom: 14 }}>
        {n.tags.map((t) => <Tag key={t}>{t}</Tag>)}
      </div>

      {online ? (
        <React.Fragment>
          <div className="col gap-8">
            <Bar label="CPU" value={n.cpu} />
            <Bar label="内存" value={n.mem} />
            <Bar label="磁盘" value={n.disk} />
          </div>
          <div className="divider" style={{ margin: "14px 0" }} />
          <div className="row between" style={{ fontSize: 12.5 }}>
            <span className="row gap-4 muted"><Ic name="arrowDown" size={13} style={{ color: "var(--green)" }} /><span className="num">{n.netIn}</span> <span className="faint">↓ MB/s</span></span>
            <span className="row gap-4 muted"><Ic name="arrowUp" size={13} style={{ color: "var(--primary)" }} /><span className="num">{n.netOut}</span> <span className="faint">↑ MB/s</span></span>
            <span className="row gap-4 muted"><Ic name="clock" size={13} /><span className="num">{n.uptimeDays}d</span></span>
          </div>
          <div className="row between" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <span className="faint" style={{ fontSize: 11.5 }}>延迟趋势 (1h)</span>
            <Sparkline data={n.spark} tone={window.DB.latencyLevel(n.spark[n.spark.length - 1])} width={130} height={28} />
          </div>
        </React.Fragment>
      ) : (
        <div style={{ padding: "18px 0 8px", textAlign: "center" }}>
          <div className="row center gap-6" style={{ color: "var(--red)", fontWeight: 540, fontSize: 13 }}>
            <Ic name="warnTri" size={15} />节点离线
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>最后在线 {n.lastSeen}</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { PublicHome, NodeCard });
