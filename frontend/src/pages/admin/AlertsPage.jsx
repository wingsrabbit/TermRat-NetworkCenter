/* ============================================================
   ONC — 告警通道（admin）：Webhook 渠道表 + 添加/编辑/删除
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Ic, Tag, Empty, Modal, Confirm, Switch, useToast } from "../../ui.jsx";
import { PageHeader, RowBtn } from "./_common.jsx";
import { apiListChannels, apiCreateChannel, apiUpdateChannel, apiDeleteChannel } from "../../api.js";

export function AlertsPage() {
  const toast = useToast();
  const [channels, setChannels] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);   // {type:'add'} | {type:'edit', ch}
  const [confirm, setConfirm] = useState(null);

  const reload = async () => {
    try {
      const d = await apiListChannels();
      setChannels(d.channels || []);
    } catch (e) { toast.error(e.message || "加载通道失败"); }
    finally { setLoaded(true); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const toggle = async (c) => {
    try {
      await apiUpdateChannel(c.id, { enabled: c.enabled ? 0 : 1 });
      setChannels((cs) => cs.map((x) => x.id === c.id ? { ...x, enabled: c.enabled ? 0 : 1 } : x));
    } catch (e) { toast.error(e.message || "操作失败"); }
  };

  const del = async (c) => {
    try {
      await apiDeleteChannel(c.id);
      setChannels((cs) => cs.filter((x) => x.id !== c.id));
      toast.success(`已删除通道「${c.name}」`);
    } catch (e) { toast.error(e.message || "删除失败"); }
  };

  const save = async (data, editing) => {
    if (editing) {
      await apiUpdateChannel(editing.id, { name: data.name, url: data.url });
      toast.success("通道已更新");
    } else {
      await apiCreateChannel(data);
      toast.success("通道已添加");
    }
    await reload();
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
                  <td><Tag tone="blue">{c.type || "webhook"}</Tag></td>
                  <td className="mono muted" style={{ fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.url}</td>
                  <td><Switch sm on={!!c.enabled} onChange={() => toggle(c)} /></td>
                  <td className="muted num" style={{ fontSize: 12.5 }}>{c.created_at || "—"}</td>
                  <td><div className="actions" style={{ justifyContent: "flex-end" }}>
                    <RowBtn icon="edit" label="编辑" onClick={() => setModal({ type: "edit", ch: c })} />
                    <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(c)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && channels.length === 0 && <Empty text="暂无告警通道，点击右上角添加" />}
        {!loaded && <div className="muted" style={{ padding: "16px 20px" }}>加载中…</div>}
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
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !url.trim()) { setErr("请填写名称与 Webhook URL"); return; }
    setBusy(true); setErr("");
    try {
      await onSave({ name: name.trim(), url: url.trim() }, editing);
      onClose();
    } catch (e) { setErr(e.message || "保存失败"); setBusy(false); }
  };

  return (
    <Modal title={editing ? "编辑通道" : "添加通道"} onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "保存中…" : (editing ? "保存" : "添加")}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field"><label className="req">通道名称</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 企业微信-运维群" autoFocus /></div>
      <div className="field"><label>类型</label><input className="input" value="webhook" disabled /></div>
      <div className="field" style={{ marginBottom: 0 }}><label className="req">Webhook URL</label><textarea className="input" rows={2} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
    </Modal>
  );
}
