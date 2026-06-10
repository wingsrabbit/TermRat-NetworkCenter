/* ============================================================
   ONC — 告警通道 / 告警历史 / 用户管理 / 系统设置
   ============================================================ */

/* ==================== 告警通道（admin） ==================== */
function AlertsPage() {
  const toast = useToast();
  const [channels, setChannels] = useState(() => window.DB.channels.map((c) => ({ ...c })));
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const toggle = (id) => setChannels((cs) => cs.map((c) => c.id === id ? { ...c, enabled: !c.enabled } : c));
  const del = (c) => { setChannels((cs) => cs.filter((x) => x.id !== c.id)); toast.success(`已删除通道「${c.name}」`); };
  const test = (c) => toast.success(`已向「${c.name}」发送测试消息`);
  const save = (data, editing) => {
    if (editing) { setChannels((cs) => cs.map((c) => c.id === editing.id ? { ...c, ...data } : c)); toast.success("通道已更新"); }
    else { setChannels((cs) => [...cs, { id: "c-" + Math.random().toString(36).slice(2, 6), type: "webhook", created: window.fmtClock().replace(/\//g, "-"), enabled: true, ...data }]); toast.success("通道已添加"); }
    setModal(null);
  };

  return (
    <div className="fade-up">
      <PageHeader title="告警通道" desc="配置 Webhook 接收告警与恢复通知"
        action={<button className="btn primary" onClick={() => setModal({ type: "add" })}><Ic name="plus" size={15} />添加通道</button>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>名称</th><th>类型</th><th>URL</th><th>启用</th><th>创建时间</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 540 }}><span className="row gap-8"><Ic name="send" size={15} style={{ color: "var(--primary)" }} />{c.name}</span></td>
                  <td><Tag tone="blue">{c.type}</Tag></td>
                  <td className="mono muted" style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.url}</td>
                  <td><Switch sm on={c.enabled} onChange={() => toggle(c.id)} /></td>
                  <td className="muted num" style={{ fontSize: 12.5 }}>{c.created}</td>
                  <td><div className="actions" style={{ justifyContent: "flex-end" }}>
                    <RowBtn icon="edit" label="编辑" onClick={() => setModal({ type: "edit", ch: c })} />
                    <RowBtn icon="send" label="测试发送" onClick={() => test(c)} />
                    <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(c)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {channels.length === 0 && <Empty text="暂无告警通道" />}
      </div>
      {modal && <ChannelModal editing={modal.type === "edit" ? modal.ch : null} onClose={() => setModal(null)} onSave={save} />}
      {confirm && <Confirm title="删除通道" danger confirmText="删除" message={`确认删除告警通道「${confirm.name}」？`} onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function ChannelModal({ editing, onClose, onSave }) {
  const [name, setName] = useState(editing ? editing.name : "");
  const [url, setUrl] = useState(editing ? editing.url : "");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!name.trim() || !url.trim()) { setErr("请填写名称与 Webhook URL"); return; }
    onSave({ name: name.trim(), url: url.trim() }, editing);
  };
  return (
    <Modal title={editing ? "编辑通道" : "添加通道"} onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit}>{editing ? "保存" : "添加"}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field"><label className="req">通道名称</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 企业微信-运维群" autoFocus /></div>
      <div className="field"><label>类型</label><input className="input" value="webhook" disabled /></div>
      <div className="field" style={{ marginBottom: 0 }}><label className="req">Webhook URL</label><textarea className="input" rows={2} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
    </Modal>
  );
}

/* ==================== 告警历史 ==================== */
function HistoryPage() {
  const db = window.DB;
  const [evt, setEvt] = useState("全部");
  const rows = db.alertHistory.filter((h) => evt === "全部" || h.event === evt);
  return (
    <div className="fade-up">
      <PageHeader title="告警历史" desc="告警与恢复事件记录"
        action={<div className="seg">{["全部", "告警", "恢复"].map((s) => <button key={s} className={evt === s ? "active" : ""} onClick={() => setEvt(s)}>{s}</button>)}</div>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>时间</th><th>任务</th><th>事件</th><th>指标</th><th>实际值</th><th>阈值</th><th>已通知</th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.id}>
                  <td className="mono muted" style={{ fontSize: 12.5 }}>{h.time}</td>
                  <td style={{ fontWeight: 540 }}>{h.task}</td>
                  <td><Tag tone={h.event === "告警" ? "red" : "green"} dot>{h.event}</Tag></td>
                  <td><span className="mono tag">{h.metric}</span></td>
                  <td className="num" style={{ fontWeight: 600, color: h.event === "告警" ? "var(--red)" : "var(--green)" }}>{h.value}</td>
                  <td className="num muted">{h.threshold}</td>
                  <td>{h.notified ? <span className="row gap-4" style={{ color: "var(--green)" }}><Ic name="check" size={14} />是</span> : <span className="faint">否</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <Empty text="暂无记录" />}
      </div>
    </div>
  );
}

/* ==================== 用户管理（admin） ==================== */
function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState(() => window.DB.users.map((u) => ({ ...u })));
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const adminCount = users.filter((u) => u.role === "admin").length;

  const del = (u) => {
    if (u.role === "admin" && adminCount <= 1) { toast.error("至少保留一个管理员，无法删除"); return; }
    setUsers((us) => us.filter((x) => x.id !== u.id)); toast.success(`已删除用户「${u.name}」`);
  };
  const reset = (u) => toast.success(`已为「${u.name}」重置密码，新密码已通过通道发送`);
  const add = (data) => {
    setUsers((us) => [...us, { id: "u-" + Math.random().toString(36).slice(2, 6), created: window.fmtClock().replace(/\//g, "-"), creator: "admin", ...data }]);
    toast.success("用户已添加"); setModal(false);
  };

  return (
    <div className="fade-up">
      <PageHeader title="用户管理" desc="管理控制台账号与角色权限"
        action={<button className="btn primary" onClick={() => setModal(true)}><Ic name="plus" size={15} />添加用户</button>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>用户名</th><th>角色</th><th>创建时间</th><th>创建者</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><span className="row gap-8" style={{ fontWeight: 540 }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: u.role === "admin" ? "var(--primary-soft)" : "var(--panel)", color: u.role === "admin" ? "var(--primary)" : "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>{u.name.slice(0, 1).toUpperCase()}</span>
                    {u.name}</span></td>
                  <td><Tag tone={u.role === "admin" ? "blue" : ""}>{u.role === "admin" ? "管理员" : "只读"}</Tag></td>
                  <td className="mono muted" style={{ fontSize: 12.5 }}>{u.created}</td>
                  <td className="muted">{u.creator}</td>
                  <td><div className="actions" style={{ justifyContent: "flex-end" }}>
                    <RowBtn icon="key" label="重置密码" onClick={() => reset(u)} />
                    <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(u)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && <UserModal onClose={() => setModal(false)} onSave={add} />}
      {confirm && <Confirm title="删除用户" danger confirmText="删除" message={`确认删除用户「${confirm.name}」？`} onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function UserModal({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("readonly");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const submit = () => { if (!name.trim() || !pwd.trim()) { setErr("请填写用户名与初始密码"); return; } onSave({ name: name.trim(), role }); };
  return (
    <Modal title="添加用户" onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit}>添加</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field"><label className="req">用户名</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="field"><label className="req">初始密码</label><input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
      <div className="field" style={{ marginBottom: 0 }}><label>角色</label>
        <div className="seg" style={{ width: "100%" }}>
          <button className={role === "admin" ? "active" : ""} style={{ flex: 1 }} onClick={() => setRole("admin")}>管理员</button>
          <button className={role === "readonly" ? "active" : ""} style={{ flex: 1 }} onClick={() => setRole("readonly")}>只读</button>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>管理员拥有全部权限；只读仅能查看仪表盘与告警历史。</div>
      </div>
    </Modal>
  );
}

/* ==================== 系统设置（admin） ==================== */
function SettingsPage() {
  const toast = useToast();
  const [f, setF] = useState({
    title: "ONC 网络状态中心", subtitle: "实时服务器资源监控 · 网络质量探测",
    hbWindow: 90, offlineThresh: 3, hbInterval: 5, snapshotInterval: 2,
    probeInterval: 5, probeTimeout: 3,
    rawDays: 3, minuteDays: 7, hourDays: 30,
    cooldown: 300,
  });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  return (
    <div className="fade-up" style={{ maxWidth: 820 }}>
      <PageHeader title="系统设置" desc="站点、心跳、探测默认值与数据保留策略" />
      <div className="col gap-16">
        <SettingsGroup title="站点信息" icon="globe">
          <SField label="站点标题"><input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} /></SField>
          <SField label="站点副标题"><input className="input" value={f.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></SField>
        </SettingsGroup>

        <SettingsGroup title="心跳与离线判定" icon="activity">
          <SField label="心跳窗口（秒）" hint="30 – 600"><NumIn v={f.hbWindow} min={30} max={600} on={(v) => set("hbWindow", v)} /></SField>
          <SField label="离线阈值（次）" hint="1 – 100"><NumIn v={f.offlineThresh} min={1} max={100} on={(v) => set("offlineThresh", v)} /></SField>
          <SField label="心跳检测间隔（秒）" hint="1 – 60"><NumIn v={f.hbInterval} min={1} max={60} on={(v) => set("hbInterval", v)} /></SField>
          <SField label="快照推送间隔（秒）" hint="1 – 10"><NumIn v={f.snapshotInterval} min={1} max={10} on={(v) => set("snapshotInterval", v)} /></SField>
        </SettingsGroup>

        <SettingsGroup title="探测默认值" icon="signal">
          <SField label="默认探测间隔（秒）" hint="1 – 60"><NumIn v={f.probeInterval} min={1} max={60} on={(v) => set("probeInterval", v)} /></SField>
          <SField label="默认探测超时（秒）" hint="1 – 30"><NumIn v={f.probeTimeout} min={1} max={30} on={(v) => set("probeTimeout", v)} /></SField>
        </SettingsGroup>

        <SettingsGroup title="数据保留" icon="history">
          <SField label="原始数据（天）" hint="默认 3"><NumIn v={f.rawDays} min={1} max={90} on={(v) => set("rawDays", v)} /></SField>
          <SField label="分钟聚合（天）" hint="默认 7"><NumIn v={f.minuteDays} min={1} max={180} on={(v) => set("minuteDays", v)} /></SField>
          <SField label="小时聚合（天）" hint="默认 30"><NumIn v={f.hourDays} min={1} max={365} on={(v) => set("hourDays", v)} /></SField>
        </SettingsGroup>

        <SettingsGroup title="告警" icon="bell">
          <SField label="全局冷却（秒）" hint="默认 300"><NumIn v={f.cooldown} min={0} max={3600} on={(v) => set("cooldown", v)} /></SField>
        </SettingsGroup>

        <div className="row end" style={{ position: "sticky", bottom: 0, paddingTop: 4 }}>
          <button className="btn primary lg" onClick={() => toast.success("保存成功")}><Ic name="check" size={16} />保存设置</button>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({ title, icon, children }) {
  return (
    <div className="card card-pad">
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic name={icon} size={16} /></span>
        <h3 className="h3" style={{ fontSize: 14.5 }}>{title}</h3>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "14px 24px" }}>{children}</div>
    </div>
  );
}
function SField({ label, hint, children }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
function NumIn({ v, min, max, on }) {
  return <input className="input num" type="number" min={min} max={max} value={v} onChange={(e) => on(Number(e.target.value))} />;
}

Object.assign(window, { AlertsPage, HistoryPage, UsersPage, SettingsPage });
