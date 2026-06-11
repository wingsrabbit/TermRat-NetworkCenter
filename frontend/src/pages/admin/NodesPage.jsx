/* ============================================================
   ONC — 节点管理（admin）：表格 + 添加/部署/删除 + 一次性 token
   ============================================================ */
import React, { useState, useEffect, useMemo } from "react";
import { Ic, Tag, Empty, Modal, Confirm, CodeBlock, Switch, useToast } from "../../ui.jsx";
import { PageHeader, RowBtn, deploySnippet } from "./_common.jsx";
import { apiListNodes, apiCreateNode, apiDeleteNode, apiUpdateNode, apiRegenNodeToken } from "../../api.js";

function relAgo(ms) {
  if (!ms) return "从未上报";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return s + " 秒前";
  if (s < 3600) return Math.floor(s / 60) + " 分钟前";
  if (s < 86400) return Math.floor(s / 3600) + " 小时前";
  return Math.floor(s / 86400) + " 天前";
}

function normNode(n) {
  return {
    id: n.id, name: n.name,
    label_1: n.label_1 || "", label_2: n.label_2 || "", label_3: n.label_3 || "",
    enabled: !!n.enabled, status: n.status, last_seen: n.last_seen,
    public_hidden: !!n.public_hidden,
    version: n.agent_version || "—", ip: n.public_ip || "—",
  };
}

export function NodesPage() {
  const toast = useToast();
  const [nodes, setNodes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);   // {type:'add'} | {type:'token', node:{name,token}}
  const [confirm, setConfirm] = useState(null);
  const [regen, setRegen] = useState(null);   // 待确认「重置 Token」的节点
  const [edit, setEdit] = useState(null);     // 正在编辑的节点

  const reload = async () => {
    try {
      const d = await apiListNodes();
      setNodes((d.nodes || []).map(normNode));
    } catch (e) {
      toast.error(e.message || "加载节点失败");
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const toggle = async (n) => {
    try {
      await apiUpdateNode(n.id, { enabled: n.enabled ? 0 : 1 });
      setNodes((ns) => ns.map((x) => x.id === n.id ? { ...x, enabled: !x.enabled } : x));
      toast.success(n.enabled ? "已禁用节点" : "已启用节点");
    } catch (e) { toast.error(e.message || "操作失败"); }
  };

  const del = async (n) => {
    try {
      await apiDeleteNode(n.id);
      setNodes((ns) => ns.filter((x) => x.id !== n.id));
      toast.success(`已删除节点「${n.name}」`);
    } catch (e) { toast.error(e.message || "删除失败"); }
  };

  const create = async (data) => {
    const res = await apiCreateNode(data); // {id,name,token}
    await reload();
    setModal({ type: "token", node: { name: res.name || data.name, token: res.token } });
    toast.success("节点已添加，请部署探针");
  };

  const saveEdit = async (n, data) => {
    await apiUpdateNode(n.id, data);   // 失败抛出，由弹窗捕获
    await reload();
    toast.success(`已更新节点「${data.name || n.name}」`);
  };

  const doRegen = async (n) => {
    try {
      const res = await apiRegenNodeToken(n.id); // {token}
      setModal({ type: "token", node: { name: n.name, token: res.token } });
      toast.success("已生成新的接入 Token");
    } catch (e) { toast.error(e.message || "生成 Token 失败"); }
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
                <th>ID</th><th>名称</th><th>状态</th><th>启用</th>
                <th>标签 1</th><th>标签 2</th><th>标签 3</th><th>版本</th><th>IP</th>
                <th style={{ textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id}>
                  <td className="mono faint" style={{ fontSize: 12 }}>{n.id}</td>
                  <td style={{ fontWeight: 540 }}>{n.name}</td>
                  <td>
                    <Tag tone={n.status === "online" ? "green" : "red"} dot>{n.status === "online" ? "在线" : "离线"}</Tag>
                    {n.status !== "online" && (
                      <div className="faint" style={{ fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 3, cursor: "help" }}
                        title="排查方向：① 目标服务器上 docker ps 看 nc-agent 是否在运行/反复重启；② 是否点过本行「部署」(会重置 Token，旧探针随即失效、需用新命令重新部署)；③ 探针到 center(:8080) 的网络 / 防火墙。">
                        <Ic name="warnTri" size={11} />最后上报 {relAgo(n.last_seen)}
                      </div>
                    )}
                  </td>
                  <td><Tag tone={n.enabled ? "blue" : "gray"} dot>{n.enabled ? "启用" : "禁用"}</Tag></td>
                  <td className="muted">{n.label_1 || "—"}</td>
                  <td className="muted">{n.label_2 || "—"}</td>
                  <td className="muted">{n.label_3 || "—"}</td>
                  <td className="mono faint" style={{ fontSize: 12 }}>{n.version}</td>
                  <td className="mono faint" style={{ fontSize: 12 }}>{n.ip}</td>
                  <td>
                    <div className="actions" style={{ justifyContent: "flex-end" }}>
                      <RowBtn icon="power" label={n.enabled ? "禁用" : "启用"} onClick={() => toggle(n)} />
                      <RowBtn icon="edit" label="编辑" onClick={() => setEdit(n)} />
                      <RowBtn icon="deploy" label="部署" onClick={() => setRegen(n)} />
                      <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(n)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && nodes.length === 0 && <Empty text="暂无节点，点击右上角添加" />}
        {!loaded && <div className="muted" style={{ padding: "16px 20px" }}>加载中…</div>}
      </div>

      {edit && <NodeEditModal node={edit} onClose={() => setEdit(null)} onSave={(data) => saveEdit(edit, data)} />}
      {modal && modal.type === "add" && <NodeFormModal onClose={() => setModal(null)} onCreate={create} />}
      {modal && modal.type === "token" && <TokenModal node={modal.node} onClose={() => setModal(null)} />}
      {confirm && <Confirm title="删除节点" danger confirmText="删除"
        message={`确认删除节点「${confirm.name}」？该操作不可恢复，关联探测任务与历史数据将一并删除。`}
        onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
      {regen && <Confirm title="生成新接入 Token（部署 / 重新部署）" confirmText="生成新 Token"
        message={`将为节点「${regen.name}」生成新的接入 Token 与部署命令。⚠️ 若该节点已有运行中的探针，旧 Token 会立即失效、节点随即离线，需用新命令在目标服务器重新部署。仅在首次部署或更换探针时使用。`}
        onConfirm={() => doRegen(regen)} onClose={() => setRegen(null)} />}
    </div>
  );
}

/* —— 节点 新增 弹窗 —— */
function NodeFormModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [labels, setLabels] = useState(["", "", ""]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setErr("请输入节点名称"); return; }
    setBusy(true); setErr("");
    try {
      await onCreate({ name: name.trim(), label_1: labels[0].trim(), label_2: labels[1].trim(), label_3: labels[2].trim() });
      onClose();
    } catch (e) {
      setErr(e.message || "添加失败");
      setBusy(false);
    }
  };

  return (
    <Modal title="添加节点" onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "添加中…" : "添加"}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field">
        <label className="req">节点名称</label>
        <input className={"input" + (err && !name ? " error" : "")} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} placeholder="如 香港-CN2-02" autoFocus />
      </div>
      <div className="row gap-12">
        {["标签 1", "标签 2", "标签 3"].map((l, i) => (
          <div className="field grow" key={i} style={{ marginBottom: 0 }}>
            <label>{l}</label>
            <input className="input" value={labels[i]} onChange={(e) => setLabels((t) => t.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? "地区" : i === 1 ? "线路" : "可选"} />
          </div>
        ))}
      </div>
      <div className="field hint" style={{ marginTop: 12, marginBottom: 0 }}>标签用于在公开主页和仪表盘中归类筛选，例如「香港 / CN2 GIA / BGP」。</div>
    </Modal>
  );
}

/* —— 节点 编辑 弹窗（名称 / 标签 / 公开脱敏） —— */
function NodeEditModal({ node, onClose, onSave }) {
  const [name, setName] = useState(node.name || "");
  const [labels, setLabels] = useState([node.label_1 || "", node.label_2 || "", node.label_3 || ""]);
  const [hidden, setHidden] = useState(!!node.public_hidden);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { setErr("请输入节点名称"); return; }
    setBusy(true); setErr("");
    try {
      await onSave({ name: name.trim(), label_1: labels[0].trim(), label_2: labels[1].trim(), label_3: labels[2].trim(), public_hidden: hidden ? 1 : 0 });
      onClose();
    } catch (e) { setErr(e.message || "保存失败"); setBusy(false); }
  };

  return (
    <Modal title="编辑节点" onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "保存中…" : "保存"}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field">
        <label className="req">节点名称</label>
        <input className={"input" + (err && !name ? " error" : "")} value={name} onChange={(e) => { setName(e.target.value); setErr(""); }} autoFocus />
      </div>
      <div className="row gap-12">
        {["标签 1", "标签 2", "标签 3"].map((l, i) => (
          <div className="field grow" key={i} style={{ marginBottom: 0 }}>
            <label>{l}</label>
            <input className="input" value={labels[i]} onChange={(e) => setLabels((t) => t.map((x, j) => j === i ? e.target.value : x))} placeholder={i === 0 ? "地区" : i === 1 ? "线路" : "可选"} />
          </div>
        ))}
      </div>
      <div className="field" style={{ marginTop: 16, marginBottom: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ marginBottom: 3 }}>公开页隐藏本节点敏感信息</label>
          <div className="hint" style={{ margin: 0 }}>开启后：公开主页 / 详情屏蔽本节点公网 IP；其它节点指向本节点的探测目标用「节点名」替换（对外公共目标不受影响）。</div>
        </div>
        <Switch on={hidden} onChange={setHidden} />
      </div>
    </Modal>
  );
}

/* —— 一次性 Token + 部署命令 弹窗 —— */
function TokenModal({ node, onClose }) {
  const snippet = useMemo(() => deploySnippet(node.token), [node.token]);
  return (
    <Modal title="节点接入 Token 与部署命令" onClose={onClose} wide
      footer={<button className="btn primary" onClick={onClose}>我已保存</button>}>
      <div className="warn-note"><Ic name="warnTri" />请妥善保存，该 Token 只显示一次，关闭后无法再次查看（如遗失可重新「部署」生成新 Token）。</div>
      <div className="field"><label>节点</label><div style={{ fontWeight: 540 }}>{node.name}</div></div>
      <div className="field">
        <label>接入 Token</label>
        <CodeBlock>{node.token}</CodeBlock>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>在目标服务器上使用 Docker 部署</label>
        <CodeBlock>{snippet}</CodeBlock>
      </div>
      <div className="field hint" style={{ marginTop: 10, marginBottom: 0 }}>探针启动后将自动上报资源指标并接收探测任务。ICMP 探测需 <span className="mono">--cap-add=NET_RAW</span>。</div>
    </Modal>
  );
}
