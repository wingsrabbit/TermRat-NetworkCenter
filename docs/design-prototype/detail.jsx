/* ============================================================
   ONC — 公开版 节点详情 / 线路详情（对客简版）
   ============================================================ */

/* —— 公开页通用外壳：顶栏 + 容器 —— */
function PublicShell({ children }) {
  const { navigate } = useApp();
  return (
    <div style={{ minHeight: "100%", background: "var(--bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, background: "color-mix(in srgb, var(--bg) 88%, transparent)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
        <div className="container row between" style={{ height: 60 }}>
          <div className="row gap-12">
            <div style={{ cursor: "pointer" }} onClick={() => navigate("/")}><Brand /></div>
          </div>
          <div className="row gap-8">
            <ThemeToggle />
            <button className="btn soft sm" onClick={() => navigate("/admin")}><Ic name="logout" size={14} />管理登录</button>
          </div>
        </div>
      </header>
      <div className="container" style={{ padding: "24px 24px 64px" }}>{children}</div>
      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--panel-2)" }}>
        <div className="container" style={{ padding: "20px 24px", fontSize: 12.5, color: "var(--text-3)" }}>© 2026 ONC 网络状态中心 · 数据每 10 秒刷新</div>
      </footer>
    </div>
  );
}

/* —— 即时值小卡 —— */
function MiniStat({ label, value, suffix, icon, tone, level }) {
  let color = tone;
  if (level) color = level === "green" ? "var(--green)" : level === "amber" ? "var(--amber)" : level === "red" ? "var(--red)" : undefined;
  return (
    <div className="card card-pad" style={{ padding: "13px 16px" }}>
      <div className="faint row gap-4" style={{ fontSize: 11.5 }}>{icon && <Ic name={icon} size={12} style={{ color }} />}{label}</div>
      <div className="num" style={{ fontSize: 21, fontWeight: 640, marginTop: 4, color }}>{value}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-3)" }}>{suffix ? " " + suffix : ""}</span></div>
    </div>
  );
}

/* ==================== 节点详情 (/node/:id) ==================== */
function NodeDetail({ id }) {
  const { navigate, tick } = useApp();
  const db = window.DB;
  const node = db.nodes.find((n) => n.id === id);
  const [hist, setHist] = useState([]);

  useEffect(() => {
    if (node) setHist(db.nodeHistory(node));
  }, [id, tick]);

  if (!node) return <PublicShell><div className="card"><Empty text="节点不存在" /></div></PublicShell>;
  const online = node.status === "online";
  const probes = db.tasks.filter((t) => t.source === node.name);

  return (
    <PublicShell>
      <button className="btn sm" style={{ marginBottom: 16 }} onClick={() => navigate("/")}><Ic name="chevLeft" size={15} />返回主页</button>

      {/* 头部 */}
      <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
        <div className="row between wrap gap-12">
          <div className="row gap-10" style={{ alignItems: "center" }}>
            <StatusDot status={node.status} pulse={!online} />
            <h1 className="h1" style={{ fontSize: 20 }}>{node.name}</h1>
            <Tag tone={online ? "green" : "red"} dot>{online ? "在线" : "离线"}</Tag>
          </div>
          <div className="row gap-6 wrap">{node.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
        </div>
        <div className="row gap-24 wrap" style={{ marginTop: 14, fontSize: 13 }}>
          <span className="muted">IP <span className="mono" style={{ color: "var(--text)" }}>{node.ip}</span></span>
          <span className="muted">版本 <span className="mono" style={{ color: "var(--text)" }}>{node.version}</span></span>
          <span className="muted">在线时长 <span className="num" style={{ color: "var(--text)" }}>{online ? node.uptimeDays + " 天" : "—"}</span></span>
          {!online && <span style={{ color: "var(--red)" }}>最后在线 {node.lastSeen}</span>}
        </div>
      </div>

      {!online ? (
        <div className="card"><Empty text="节点离线，暂无资源数据" /></div>
      ) : (
        <React.Fragment>
          {/* 即时值小卡 */}
          <div className="grid mini fade-up" style={{ marginBottom: 18 }}>
            <MiniStat label="CPU 使用率" value={node.cpu} suffix="%" icon="cpu" level={db.usageLevel(node.cpu)} />
            <MiniStat label="内存使用率" value={node.mem} suffix="%" icon="activity" level={db.usageLevel(node.mem)} />
            <MiniStat label="磁盘使用率" value={node.disk} suffix="%" icon="dashboard" level={db.usageLevel(node.disk)} />
            <MiniStat label="系统负载" value={node.load} icon="signal" />
            <MiniStat label="下行流量" value={node.netIn} suffix="MB/s" icon="arrowDown" tone="var(--green)" />
            <MiniStat label="上行流量" value={node.netOut} suffix="MB/s" icon="arrowUp" tone="var(--primary)" />
          </div>

          {/* 资源历史 */}
          <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
            <div className="card-head"><div><h3 className="h3">资源使用率 · 近 30 分钟</h3><span className="faint" style={{ fontSize: 12 }}>CPU / 内存 / 磁盘</span></div></div>
            {hist.length ? <ResourceChart data={hist} /> : <div className="skel" style={{ height: 260, borderRadius: 8 }} />}
          </div>
          <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
            <div className="card-head"><div><h3 className="h3">网络流量 · 近 30 分钟</h3><span className="faint" style={{ fontSize: 12 }}>↓ 下行 / ↑ 上行</span></div></div>
            {hist.length ? <TrafficChart data={hist} /> : <div className="skel" style={{ height: 220, borderRadius: 8 }} />}
          </div>
        </React.Fragment>
      )}

      {/* 该节点的探测线路 */}
      <section>
        <h2 className="h2" style={{ marginBottom: 12 }}>该节点的探测线路 <span className="faint" style={{ fontWeight: 400 }}>{probes.length}</span></h2>
        <div className="card fade-up">
          {probes.length === 0 ? <Empty text="该节点暂未配置探测任务" /> : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>线路</th><th>协议</th><th>延迟</th><th>丢包</th><th>状态</th></tr></thead>
                <tbody>
                  {probes.map((t) => (
                    <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => navigate("/probe/" + t.id)}>
                      <td>
                        <div style={{ fontWeight: 540 }}>{t.name}</div>
                        <div className="muted mono" style={{ fontSize: 12 }}>{t.target}{t.port ? ":" + t.port : ""}</div>
                      </td>
                      <td><Tag tone={db.protoColors[t.proto]} className="proto-tag">{t.proto}</Tag></td>
                      <td><Latency ms={t.latency} /></td>
                      <td className="num" style={{ color: t.loss > 0 ? "var(--red)" : "var(--text-2)", fontWeight: t.loss > 0 ? 600 : 400 }}>{t.loss}%</td>
                      <td>{t.alerting ? <span className="row gap-6"><StatusDot status="offline" pulse /><span style={{ color: "var(--red)", fontWeight: 540 }}>告警中</span></span> : <span className="row gap-6"><StatusDot status="online" /><span className="muted">正常</span></span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  );
}

/* ==================== 线路详情 (/probe/:id) ==================== */
function ProbeDetail({ id }) {
  const { navigate, tick } = useApp();
  const db = window.DB;
  const task = db.tasks.find((t) => t.id === id);
  const [hist, setHist] = useState([]);

  useEffect(() => {
    if (task) setHist(db.probeHistory(task));
  }, [id, tick]);

  if (!task) return <PublicShell><div className="card"><Empty text="线路不存在" /></div></PublicShell>;

  const stats = useMemo(() => {
    if (!hist.length) return null;
    const lat = hist.map((d) => d.latency);
    const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
    const loss = hist.map((d) => d.loss).reduce((a, b) => a + b, 0) / hist.length;
    const ok = hist.filter((d) => d.loss < 100).length / hist.length * 100;
    return { avg: Math.round(avg * 10) / 10, loss: Math.round(loss * 10) / 10, avail: Math.round((100 - loss * 0.6) * 10) / 10 };
  }, [hist]);

  return (
    <PublicShell>
      <button className="btn sm" style={{ marginBottom: 16 }} onClick={() => navigate("/")}><Ic name="chevLeft" size={15} />返回主页</button>

      <div className="card card-pad fade-up" style={{ marginBottom: 18 }}>
        <div className="row between wrap gap-12">
          <div className="row gap-10" style={{ alignItems: "center" }}>
            <Tag tone={db.protoColors[task.proto]} className="proto-tag">{task.proto}</Tag>
            <h1 className="h1" style={{ fontSize: 20 }}>{task.name}</h1>
            {task.alerting
              ? <Tag tone="red" dot>告警中</Tag>
              : <Tag tone="green" dot>正常</Tag>}
          </div>
        </div>
        <div className="muted mono" style={{ fontSize: 13, marginTop: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ whiteSpace: "nowrap" }}>{task.source}</span><Ic name="arrowRight" size={13} /><span style={{ whiteSpace: "nowrap" }}>{task.target}{task.port ? ":" + task.port : ""}</span>
          <span className="faint" style={{ whiteSpace: "nowrap" }}>· 探测间隔 {task.interval}s</span>
        </div>
      </div>

      {/* 统计小卡 */}
      <div className="grid mini fade-up" style={{ marginBottom: 18 }}>
        <MiniStat label="当前延迟" value={task.latency} suffix="ms" icon="activity" level={db.latencyLevel(task.latency)} />
        <MiniStat label="平均延迟" value={stats ? stats.avg : "—"} suffix="ms" icon="signal" level={stats ? db.latencyLevel(stats.avg) : null} />
        <MiniStat label="丢包率" value={task.loss} suffix="%" icon="warnTri" tone={task.loss > 0 ? "var(--red)" : "var(--green)"} />
        <MiniStat label="可用率" value={stats ? stats.avail : "—"} suffix="%" icon="checkCircle" tone="var(--green)" />
        {task.proto === "HTTP" && <MiniStat label="状态码" value={task.code} icon="globe" tone={task.code === 200 ? "var(--green)" : "var(--amber)"} />}
      </div>

      {/* 历史曲线 */}
      <div className="card card-pad fade-up">
        <div className="card-head">
          <div>
            <h3 className="h3">延迟 / 丢包 / 抖动 · 近 30 分钟</h3>
            <span className="faint" style={{ fontSize: 12 }}>{task.alerting ? "红线=延迟(告警) · 红柱=丢包 · 琥珀虚线=抖动" : "绿线=延迟 · 琥珀虚线=抖动"}</span>
          </div>
        </div>
        {hist.length ? <ProbeMiniChart data={hist} /> : <div className="skel" style={{ height: 300, borderRadius: 8 }} />}
        <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>· 对客简版，固定展示近 30 分钟数据，数据每 10 秒自动刷新。</div>
      </div>
    </PublicShell>
  );
}

Object.assign(window, { PublicShell, MiniStat, NodeDetail, ProbeDetail });
