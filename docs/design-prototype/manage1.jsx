/* ============================================================
   TermRat — 节点管理 + 任务管理（admin）
   ============================================================ */

/* —— 页头 —— */
function PageHeader({ title, desc, action }) {
  return (
    <div className="row between wrap gap-12" style={{ marginBottom: 18 }}>
      <div>
        <h2 className="h1" style={{ fontSize: 19 }}>{title}</h2>
        {desc && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{desc}</div>}
      </div>
      {action}
    </div>
  );
}

/* —— 行操作按钮 —— */
function RowBtn({ icon, label, tone, onClick }) {
  return (
    <button className="btn xs ghost" onClick={onClick} title={label} style={{ color: tone === "danger" ? "var(--red)" : "var(--text-2)" }}>
      <Ic name={icon} size={14} /><span className="desktop-only">{label}</span>
    </button>
  );
}

/* ==================== 节点管理 ==================== */
function NodesPage() {
  const toast = useToast();
  const [nodes, setNodes] = useState(() => window.DB.nodes.map((n) => ({ ...n })));
  const [expand, setExpand] = useState(null);
  const [modal, setModal] = useState(null); // {type:'add'|'edit'|'token'|'deploy', node}
  const [confirm, setConfirm] = useState(null);

  const toggle = (id) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, enabled: !n.enabled } : n));
    toast.success("已更新节点启用状态");
  };
  const del = (n) => {
    setNodes((ns) => ns.filter((x) => x.id !== n.id));
    toast.success(`已删除节点「${n.name}」`);
  };
  const save = (data, editing) => {
    if (editing) {
      setNodes((ns) => ns.map((n) => n.id === editing.id ? { ...n, name: data.name, tags: data.tags.filter(Boolean) } : n));
      toast.success("节点已更新");
    } else {
      const id = "n-" + Math.random().toString(36).slice(2, 7);
      setNodes((ns) => [...ns, {
        id, name: data.name, region: data.tags[0] || "—", tags: data.tags.filter(Boolean),
        status: "offline", enabled: true, version: "—", ip: "待部署",
        cpu: 0, mem: 0, disk: 0, load: 0, netIn: 0, netOut: 0, uptimeDays: 0, lastSeen: "从未", spark: [],
      }]);
      toast.success("节点已添加，请部署探针");
      setModal({ type: "token", node: { name: data.name } });
      return;
    }
    setModal(null);
  };

  return (
    <div className="fade-up">
      <PageHeader title="节点管理" desc="管理探针节点，节点同时上报服务器资源指标"
        action={<button className="btn primary" onClick={() => setModal({ type: "add" })}><Ic name="plus" size={15} />添加节点</button>} />

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>ID</th><th>名称</th><th>状态</th><th>启用</th>
                <th>标签 1</th><th>标签 2</th><th>标签 3</th><th>版本</th><th>IP</th>
                <th style={{ textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <React.Fragment key={n.id}>
                  <tr>
                    <td>
                      <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => setExpand(expand === n.id ? null : n.id)}>
                        <Ic name="chevRight" size={14} style={{ transform: expand === n.id ? "rotate(90deg)" : "none", transition: "transform var(--dur)" }} />
                      </button>
                    </td>
                    <td className="mono faint" style={{ fontSize: 12 }}>{n.id}</td>
                    <td style={{ fontWeight: 540 }}>{n.name}</td>
                    <td><Tag tone={n.status === "online" ? "green" : "red"} dot>{n.status === "online" ? "在线" : "离线"}</Tag></td>
                    <td><Tag tone={n.enabled ? "blue" : "gray"} dot>{n.enabled ? "启用" : "禁用"}</Tag></td>
                    {[0, 1, 2].map((i) => <td key={i} className="muted">{n.tags[i] || "—"}</td>)}
                    <td className="mono faint" style={{ fontSize: 12 }}>{n.version}</td>
                    <td className="mono faint" style={{ fontSize: 12 }}>{n.ip}</td>
                    <td>
                      <div className="actions" style={{ justifyContent: "flex-end" }}>
                        <RowBtn icon="edit" label="编辑" onClick={() => setModal({ type: "edit", node: n })} />
                        <RowBtn icon="power" label={n.enabled ? "禁用" : "启用"} onClick={() => toggle(n.id)} />
                        <RowBtn icon="deploy" label="部署" onClick={() => setModal({ type: "deploy", node: n })} />
                        <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(n)} />
                      </div>
                    </td>
                  </tr>
                  {expand === n.id && (
                    <tr>
                      <td colSpan={11} style={{ background: "var(--panel-2)", padding: 0 }}>
                        <NodeResourcePanel node={n} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {nodes.length === 0 && <Empty text="暂无节点，点击右上角添加" />}
      </div>

      {modal && (modal.type === "add" || modal.type === "edit") &&
        <NodeFormModal editing={modal.type === "edit" ? modal.node : null} onClose={() => setModal(null)} onSave={save} />}
      {modal && modal.type === "token" && <TokenModal node={modal.node} onClose={() => setModal(null)} />}
      {modal && modal.type === "deploy" && <DeployModal node={modal.node} onClose={() => setModal(null)} />}
      {confirm && <Confirm title="删除节点" danger confirmText="删除"
        message={`确认删除节点「${confirm.name}」？该操作不可恢复，关联探测任务将一并失效。`}
        onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function NodeResourcePanel({ node: n }) {
  const online = n.status === "online";
  if (!online) return <div className="muted" style={{ padding: "16px 20px", fontSize: 13 }}>节点离线，最后在线 {n.lastSeen}，暂无资源数据。</div>;
  return (
    <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 20, alignItems: "center" }}>
      <div className="col gap-8" style={{ maxWidth: 280 }}>
        <Bar label="CPU" value={n.cpu} /><Bar label="内存" value={n.mem} /><Bar label="磁盘" value={n.disk} />
      </div>
      <ResStat label="系统负载" value={n.load} />
      <ResStat label="下行流量" value={n.netIn + " MB/s"} icon="arrowDown" tone="var(--green)" />
      <ResStat label="上行流量" value={n.netOut + " MB/s"} icon="arrowUp" tone="var(--primary)" />
      <ResStat label="在线时长" value={n.uptimeDays + " 天"} icon="clock" />
    </div>
  );
}
function ResStat({ label, value, icon, tone }) {
  return (
    <div>
      <div className="faint row gap-4" style={{ fontSize: 11.5 }}>{icon && <Ic name={icon} size={12} style={{ color: tone }} />}{label}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 620, marginTop: 2 }}>{value}</div>
    </div>
  );
}

/* —— 节点 新增/编辑 弹窗 —— */
function NodeFormModal({ editing, onClose, onSave }) {
  const [name, setName] = useState(editing ? editing.name : "");
  const [tags, setTags] = useState(editing ? [editing.tags[0] || "", editing.tags[1] || "", editing.tags[2] || ""] : ["", "", ""]);
  const [err, setErr] = useState("");
  const submit = () => {
    if (!name.trim()) { setErr("请输入节点名称"); return; }
    onSave({ name: name.trim(), tags: tags.map((t) => t.trim()) }, editing);
  };
  return (
    <Modal title={editing ? "编辑节点" : "添加节点"} onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit}>{editing ? "保存" : "添加"}</button></React.Fragment>}>
      <div className="field">
        <label className="req">节点名称</label>
        <input className={"input" + (err ? " error" : "")} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="如 香港-CN2-02" autoFocus />
        {err && <div className="field-err">{err}</div>}
      </div>
      <div className="row gap-12">
        {["标签 1", "标签 2", "标签 3"].map((l, i) => (
          <div className="field grow" key={i} style={{ marginBottom: 0 }}>
            <label>{l}</label>
            <input className="input" value={tags[i]} onChange={(e) => setTags((t) => t.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? "地区" : i === 1 ? "线路" : "可选"} />
          </div>
        ))}
      </div>
      <div className="hint" style={{ marginTop: 12 }}>标签用于在公开主页和仪表盘中归类筛选，例如「香港 / CN2 GIA / BGP」。</div>
    </Modal>
  );
}

/* —— Token 弹窗 —— */
function TokenModal({ node, onClose }) {
  const token = useMemo(() => "trt_" + Array.from({ length: 40 }, () => "abcdef0123456789"[Math.floor(Math.random() * 16)]).join(""), []);
  return (
    <Modal title="节点接入 Token" onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>我已保存</button>}>
      <div className="warn-note"><Ic name="warnTri" />⚠️ 请妥善保存，该 Token 只显示一次，关闭后无法再次查看。</div>
      <div className="field"><label>节点</label><div style={{ fontWeight: 540 }}>{node.name}</div></div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>接入 Token</label>
        <CodeBlock>{token}</CodeBlock>
      </div>
      <div className="hint" style={{ marginTop: 10 }}>下一步：在目标服务器上使用「部署」中的安装命令并填入该 Token。</div>
    </Modal>
  );
}

/* —— 部署命令 弹窗 —— */
function DeployModal({ node, onClose }) {
  const script = `curl -fsSL https://get.termrat.io/agent.sh | bash -s -- \\
  --server wss://hub.termrat.io \\
  --token trt_xxxxxxxxxxxxxxxxxxxxxxxx \\
  --name "${node.name}"`;
  const docker = `docker run -d --name termrat-agent \\
  --restart=always --net=host \\
  -e TRT_SERVER=wss://hub.termrat.io \\
  -e TRT_TOKEN=trt_xxxxxxxxxxxxxxxxxxxxxxxx \\
  -e TRT_NAME="${node.name}" \\
  termrat/agent:1.2.0`;
  const [tab, setTab] = useState("script");
  return (
    <Modal title={`部署探针 · ${node.name}`} onClose={onClose} wide
      footer={<button className="btn primary" onClick={onClose}>完成</button>}>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={tab === "script" ? "active" : ""} onClick={() => setTab("script")}>脚本安装</button>
        <button className={tab === "docker" ? "active" : ""} onClick={() => setTab("docker")}>Docker 安装</button>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{tab === "script" ? "在目标服务器执行（Linux）" : "使用 Docker 运行"}</label>
        <CodeBlock>{tab === "script" ? script : docker}</CodeBlock>
      </div>
      <div className="hint" style={{ marginTop: 10 }}>请将命令中的 <span className="mono">--token</span> 替换为该节点的真实接入 Token。探针启动后将自动上报资源指标并接收探测任务。</div>
    </Modal>
  );
}

/* ==================== 任务管理 ==================== */
function TasksPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState(() => window.DB.tasks.map((t) => ({ ...t })));
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const db = window.DB;

  const toggle = (id, field) => {
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, [field]: !t[field] } : t));
    toast.success("已更新");
  };
  const del = (t) => { setTasks((ts) => ts.filter((x) => x.id !== t.id)); toast.success(`已删除任务「${t.name}」`); };
  const save = (data, editing) => {
    if (editing) {
      setTasks((ts) => ts.map((t) => t.id === editing.id ? { ...t, ...data } : t));
      toast.success("任务已更新");
    } else {
      const id = "t-" + Math.random().toString(36).slice(2, 7);
      setTasks((ts) => [...ts, { id, latency: null, loss: 0, jitter: 0, code: null, alerting: false, spark: [], points: 0, ...data }]);
      toast.success("任务已创建");
    }
    setModal(null);
  };

  return (
    <div className="fade-up">
      <PageHeader title="任务管理" desc="配置网络质量探测任务与告警阈值"
        action={<button className="btn primary" onClick={() => setModal({ type: "add" })}><Ic name="plus" size={15} />添加任务</button>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>ID</th><th>名称</th><th>协议</th><th>源节点</th><th>目标</th><th>间隔(s)</th><th>启用</th><th>告警</th><th style={{ textAlign: "right" }}>操作</th></tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="mono faint" style={{ fontSize: 12 }}>{t.id}</td>
                  <td style={{ fontWeight: 540 }}>
                    <span className="row gap-6">{t.name}{t.alerting && <span className="dot red pulse" />}</span>
                  </td>
                  <td><Tag tone={db.protoColors[t.proto]} className="proto-tag">{t.proto}</Tag></td>
                  <td className="muted">{t.source}</td>
                  <td className="mono muted" style={{ fontSize: 12 }}>{t.target}{t.port ? ":" + t.port : ""}</td>
                  <td className="num">{t.interval}</td>
                  <td><Switch sm on={t.enabled} onChange={() => toggle(t.id, "enabled")} /></td>
                  <td><Tag tone={t.alertOn ? "blue" : "gray"} dot={t.alertOn}>{t.alertOn ? "开" : "关"}</Tag></td>
                  <td>
                    <div className="actions" style={{ justifyContent: "flex-end" }}>
                      <RowBtn icon="edit" label="编辑" onClick={() => setModal({ type: "edit", task: t })} />
                      <RowBtn icon="power" label={t.enabled ? "禁用" : "启用"} onClick={() => toggle(t.id, "enabled")} />
                      <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(t)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tasks.length === 0 && <Empty text="暂无任务" />}
      </div>
      {modal && <TaskFormModal editing={modal.type === "edit" ? modal.task : null} onClose={() => setModal(null)} onSave={save} />}
      {confirm && <Confirm title="删除任务" danger confirmText="删除" message={`确认删除任务「${confirm.name}」？历史数据将保留但停止采集。`} onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/* —— 任务 新增/编辑 弹窗 —— */
function TaskFormModal({ editing, onClose, onSave }) {
  const db = window.DB;
  const e = editing || {};
  const [f, setF] = useState({
    name: e.name || "", source: e.source || db.sourceLabels[0], proto: e.proto || "ICMP",
    targetType: e.targetType || "外部目标", target: e.target || "", port: e.port || "",
    interval: e.interval || 5, timeout: e.timeout || 3, alertOn: e.alertOn || false,
    alert: e.alert || { latency: 200, loss: 5, fails: 3, window: 60, trigger: 3, recover: 3, cooldown: 300 },
  });
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setA = (k, v) => setF((s) => ({ ...s, alert: { ...s.alert, [k]: v } }));
  const needPort = f.proto === "TCP" || f.proto === "UDP";
  const internal = f.targetType === "内部节点";

  const submit = () => {
    if (!f.name.trim()) { setErr("请输入任务名称"); return; }
    if (!f.target) { setErr("请填写目标"); return; }
    onSave({
      name: f.name.trim(), source: f.source, proto: f.proto, targetType: f.targetType,
      target: f.target, port: needPort ? Number(f.port) || null : null,
      interval: Number(f.interval), timeout: Number(f.timeout), alertOn: f.alertOn,
      alert: f.alertOn ? f.alert : null,
    }, editing);
  };

  return (
    <Modal title={editing ? "编辑任务" : "添加任务"} onClose={onClose} wide
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit}>{editing ? "保存" : "创建"}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field">
        <label className="req">任务名称</label>
        <input className="input" value={f.name} onChange={(ev) => set("name", ev.target.value)} placeholder="如 沪→京延迟" autoFocus />
      </div>
      <div className="row gap-12">
        <div className="field grow"><label className="req">源节点</label>
          <select className="select" value={f.source} onChange={(ev) => set("source", ev.target.value)}>{db.sourceLabels.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="field grow"><label className="req">协议</label>
          <select className="select" value={f.proto} onChange={(ev) => set("proto", ev.target.value)}>{["ICMP", "TCP", "UDP", "HTTP", "DNS"].map((p) => <option key={p}>{p}</option>)}</select>
        </div>
      </div>
      <div className="row gap-12">
        <div className="field grow"><label>目标类型</label>
          <select className="select" value={f.targetType} onChange={(ev) => set("targetType", ev.target.value)}>{["外部目标", "内部节点"].map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <div className="field grow"><label className="req">{internal ? "目标节点" : "目标地址"}</label>
          {internal
            ? <select className="select" value={f.target} onChange={(ev) => set("target", ev.target.value)}><option value="">请选择</option>{db.nodes.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}</select>
            : <input className="input" value={f.target} onChange={(ev) => set("target", ev.target.value)} placeholder={f.proto === "HTTP" ? "https://example.com" : "如 8.8.8.8"} />}
        </div>
        {needPort && <div className="field" style={{ width: 110 }}><label className="req">端口</label><input className="input" value={f.port} onChange={(ev) => set("port", ev.target.value)} placeholder="443" /></div>}
      </div>
      <div className="row gap-12">
        <div className="field grow"><label>探测间隔（秒）</label><input className="input num" type="number" min="1" max="60" value={f.interval} onChange={(ev) => set("interval", ev.target.value)} /></div>
        <div className="field grow"><label>超时（秒）</label><input className="input num" type="number" min="1" max="30" value={f.timeout} onChange={(ev) => set("timeout", ev.target.value)} /></div>
      </div>

      <div className="divider" />
      <div className="row between" style={{ marginBottom: f.alertOn ? 16 : 0 }}>
        <div><div style={{ fontWeight: 540, fontSize: 13.5 }}>告警（选填）</div><div className="hint" style={{ marginTop: 2 }}>开启后，指标超过阈值将通过告警通道通知</div></div>
        <Switch on={f.alertOn} onChange={(v) => set("alertOn", v)} />
      </div>
      {f.alertOn && (
        <div className="fade-up">
          <div className="row gap-12">
            <div className="field grow"><label>延迟阈值（ms）</label><input className="input num" type="number" value={f.alert.latency} onChange={(ev) => setA("latency", ev.target.value)} /></div>
            <div className="field grow"><label>丢包率阈值（%）</label><input className="input num" type="number" value={f.alert.loss} onChange={(ev) => setA("loss", ev.target.value)} /></div>
            <div className="field grow"><label>连续失败次数</label><input className="input num" type="number" value={f.alert.fails} onChange={(ev) => setA("fails", ev.target.value)} /></div>
          </div>
          <div className="row gap-12">
            <div className="field grow"><label>评估窗口（s）</label><input className="input num" type="number" value={f.alert.window} onChange={(ev) => setA("window", ev.target.value)} /></div>
            <div className="field grow"><label>触发次数</label><input className="input num" type="number" value={f.alert.trigger} onChange={(ev) => setA("trigger", ev.target.value)} /></div>
            <div className="field grow"><label>恢复次数</label><input className="input num" type="number" value={f.alert.recover} onChange={(ev) => setA("recover", ev.target.value)} /></div>
            <div className="field grow"><label>冷却时间（s）</label><input className="input num" type="number" value={f.alert.cooldown} onChange={(ev) => setA("cooldown", ev.target.value)} /></div>
          </div>
        </div>
      )}
    </Modal>
  );
}

Object.assign(window, { PageHeader, RowBtn, NodesPage, TasksPage });
