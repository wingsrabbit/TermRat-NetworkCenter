/* ============================================================
   TermRat — 仪表盘 + 任务详情
   ============================================================ */

function Dashboard() {
  const { navigate, tick } = useApp();
  const db = window.DB;
  const [q, setQ] = useState("");
  const [proto, setProto] = useState("全部");

  const protos = ["全部", "ICMP", "TCP", "UDP", "HTTP", "DNS"];
  const tasks = db.tasks.filter((t) => {
    if (proto !== "全部" && t.proto !== proto) return false;
    if (q) {
      const s = (t.name + t.source + t.target).toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="col gap-24">
      {/* KPI */}
      <div className="grid kpi">
        <StatCard label="节点数" icon="nodes" value={db.kpi.nodesTotal} delay={0} />
        <StatCard label="任务数" icon="tasks" value={db.kpi.tasksTotal} delay={40} />
        <StatCard label="在线节点" icon="checkCircle" value={db.kpi.online} tone="var(--green)" sub={`离线 ${db.kpi.offline}`} delay={80} />
        <StatCard label="活跃告警" icon="bell" value={db.kpi.alerts} tone={db.kpi.alerts ? "var(--red)" : "var(--green)"} delay={120} />
      </div>

      {/* 筛选条 */}
      <div className="card card-pad fade-up" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search grow" style={{ minWidth: 220, maxWidth: 360 }}><Ic name="search" /><input className="input" placeholder="搜索任务 / 目标 / 节点" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row gap-6">
          <span className="label">协议</span>
          <select className="select" style={{ width: 120 }} value={proto} onChange={(e) => setProto(e.target.value)}>
            {protos.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* 任务卡片网格 */}
      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 className="h2">探测任务 <span className="faint" style={{ fontWeight: 400 }}>{tasks.length}</span></h2>
        </div>
        {tasks.length === 0 ? <div className="card"><Empty text="暂无数据" /></div> : (
          <div className="grid cards-4">
            {tasks.map((t, i) => <TaskCard key={t.id} task={t} delay={i * 50} onClick={() => navigate("/termadmin/dashboard/" + t.id)} />)}
          </div>
        )}
      </section>

      {/* 节点资源迷你卡（体现融合监控） */}
      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 className="h2">节点资源 <span className="faint" style={{ fontWeight: 400 }}>实时</span></h2>
          <span className="label">服务器监控 · 网络探测 融合视图</span>
        </div>
        <div className="grid mini">
          {db.nodes.map((n, i) => <ResourceMini key={n.id} node={n} delay={i * 40} />)}
        </div>
      </section>
    </div>
  );
}

/* —— 任务卡片 —— */
function TaskCard({ task, delay, onClick }) {
  const t = task;
  const db = window.DB;
  return (
    <div className="card card-pad card-hover fade-up" style={{ animationDelay: (delay || 0) + "ms", position: "relative" }} onClick={onClick}>
      {t.alerting && <span className="dot red pulse" style={{ position: "absolute", top: 14, right: 14 }} />}
      <div className="row gap-8" style={{ marginBottom: 10 }}>
        <Tag tone={db.protoColors[t.proto]} className="proto-tag">{t.proto}</Tag>
        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{t.name}</span>
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
          <span className="num" style={{ fontWeight: 600, color: t.loss > 0 ? "var(--red)" : "var(--text)" }}>{t.loss}%</span>
        </div>
        {t.proto === "HTTP" && (
          <div className="col gap-2" style={{ textAlign: "center" }}>
            <span className="faint" style={{ fontSize: 11 }}>状态码</span>
            <span className="num" style={{ fontWeight: 600, color: t.code === 200 ? "var(--green)" : "var(--amber)" }}>{t.code}</span>
          </div>
        )}
        <Sparkline data={t.spark} tone={t.alerting ? "red" : window.DB.latencyLevel(t.latency)} width={72} height={26} />
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
        <span className="faint" style={{ fontSize: 11 }}>{online ? "load " + n.load : "离线"}</span>
      </div>
      {online ? (
        <div className="col gap-6">
          <Bar label="CPU" value={n.cpu} />
          <Bar label="内存" value={n.mem} />
          <Bar label="磁盘" value={n.disk} />
          <div className="row between faint" style={{ fontSize: 11, marginTop: 2 }}>
            <span>↓ <span className="num">{n.netIn}</span> MB/s</span>
            <span>↑ <span className="num">{n.netOut}</span> MB/s</span>
          </div>
        </div>
      ) : <div className="faint" style={{ fontSize: 12, padding: "8px 0" }}>最后在线 {n.lastSeen}</div>}
    </div>
  );
}

/* ---------------- 任务详情 (/termadmin/dashboard/:taskId) ---------------- */
const RANGES = [
  { k: "30m", label: "30 分钟", points: 60 },
  { k: "1h", label: "1 小时", points: 60 },
  { k: "6h", label: "6 小时", points: 72 },
  { k: "24h", label: "24 小时", points: 96 },
  { k: "3d", label: "3 天", points: 108 },
  { k: "7d", label: "7 天", points: 112 },
  { k: "14d", label: "14 天", points: 112 },
  { k: "30d", label: "30 天", points: 120 },
];

function TaskDetail({ taskId }) {
  const { navigate, tick } = useApp();
  const db = window.DB;
  const task = db.tasks.find((t) => t.id === taskId);
  const [range, setRange] = useState("1h");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);
    const r = RANGES.find((x) => x.k === range) || RANGES[1];
    const tm = setTimeout(() => {
      setData(db.detailSeries(taskId, r.points));
      setLoading(false);
    }, 280);
    return () => clearTimeout(tm);
  }, [range, taskId, tick]);

  if (!task) return <div className="card"><Empty text="任务不存在" /></div>;

  const stats = useMemo(() => {
    if (!data.length) return null;
    const lat = data.map((d) => d.latency);
    const sorted = [...lat].sort((a, b) => a - b);
    const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const jit = data.map((d) => d.jitter).reduce((a, b) => a + b, 0) / data.length;
    const loss = data.map((d) => d.loss).reduce((a, b) => a + b, 0) / data.length;
    return { avg, p95, jit, loss, points: task.points };
  }, [data]);

  return (
    <div className="col gap-20 fade-up">
      {/* 顶部返回 + 范围 */}
      <div className="row between wrap gap-12">
        <div className="row gap-12">
          <button className="btn sm" onClick={() => navigate("/termadmin/dashboard")}><Ic name="chevLeft" size={15} />返回</button>
          <div>
            <div className="row gap-8">
              <Tag tone={db.protoColors[task.proto]} className="proto-tag">{task.proto}</Tag>
              <h2 className="h1" style={{ fontSize: 19 }}>{task.name}</h2>
              {task.alerting && <Tag tone="red" dot>告警中</Tag>}
            </div>
            <div className="muted mono" style={{ fontSize: 12.5, marginTop: 4 }}>{task.source} → {task.target}{task.port ? ":" + task.port : ""} · 间隔 {task.interval}s</div>
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
            <StatCard label="平均延迟" icon="activity" value={Math.round(stats.avg * 10) / 10} decimals={1} suffix=" ms" tone={stats.avg >= 200 ? "var(--red)" : stats.avg >= 50 ? "var(--amber)" : "var(--green)"} />
            <StatCard label="P95 延迟" icon="signal" value={Math.round(stats.p95 * 10) / 10} decimals={1} suffix=" ms" />
            <StatCard label="窗口抖动" icon="activity" value={Math.round(stats.jit * 10) / 10} decimals={1} suffix=" ms" tone="var(--amber)" />
            <StatCard label="平均丢包" icon="warnTri" value={Math.round(stats.loss * 10) / 10} decimals={1} suffix=" %" tone={stats.loss > 0 ? "var(--red)" : "var(--green)"} />
            <StatCard label="数据点数" icon="dashboard" value={stats.points} />
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
        {loading ? <div className="skel" style={{ height: 360, borderRadius: 8 }} /> : <TimeChart data={data} range={range} />}
      </div>
    </div>
  );
}

Object.assign(window, { Dashboard, TaskCard, ResourceMini, TaskDetail, RANGES });
