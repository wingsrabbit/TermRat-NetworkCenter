/* ============================================================
   ONC — 任务管理（admin）：表格 + 添加/编辑（含告警阈值）+ 删除
   ============================================================ */
import React, { useState, useEffect, useMemo } from "react";
import { Ic, Tag, Empty, Modal, Confirm, Switch, useToast } from "../../ui.jsx";
import { PageHeader, RowBtn } from "./_common.jsx";
import { apiListTasks, apiListNodes, apiCreateTask, apiUpdateTask, apiDeleteTask } from "../../api.js";

const PROTOS = ["icmp", "tcp", "udp", "http", "dns"];
const PROTO_COLORS = { ICMP: "blue", TCP: "green", UDP: "amber", HTTP: "blue", DNS: "green" };

function hasAlert(t) {
  return t.alert_latency_threshold != null || t.alert_loss_threshold != null || t.alert_fail_count != null;
}

export function TasksPage() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);   // {type:'add'} | {type:'edit', task}
  const [confirm, setConfirm] = useState(null);

  const nodeName = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.name])), [nodes]);

  const reload = async () => {
    try {
      const [td, nd] = await Promise.all([apiListTasks(), apiListNodes()]);
      setTasks(td.tasks || []);
      setNodes(nd.nodes || []);
    } catch (e) {
      toast.error(e.message || "加载任务失败");
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const toggle = async (t) => {
    try {
      await apiUpdateTask(t.id, { enabled: t.enabled ? 0 : 1 });
      setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, enabled: t.enabled ? 0 : 1 } : x));
      toast.success(t.enabled ? "已禁用任务" : "已启用任务");
    } catch (e) { toast.error(e.message || "操作失败"); }
  };

  const del = async (t) => {
    try {
      await apiDeleteTask(t.id);
      setTasks((ts) => ts.filter((x) => x.id !== t.id));
      toast.success(`已删除任务「${t.name}」`);
    } catch (e) { toast.error(e.message || "删除失败"); }
  };

  const save = async (payload, editing) => {
    if (editing) {
      await apiUpdateTask(editing.id, payload);
      toast.success("任务已更新");
    } else {
      await apiCreateTask(payload);
      toast.success("任务已创建");
    }
    await reload();
  };

  return (
    <div className="fade-up">
      <PageHeader title="任务管理" desc="配置网络质量探测任务与告警阈值"
        action={<button className="btn primary" onClick={() => setModal({ type: "add" })} disabled={nodes.length === 0} title={nodes.length === 0 ? "请先添加节点" : ""}><Ic name="plus" size={15} />添加任务</button>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>名称</th><th>协议</th><th>源节点</th><th>目标</th><th>间隔(s)</th><th>启用</th><th>告警</th><th style={{ textAlign: "right" }}>操作</th></tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const proto = (t.protocol || "").toUpperCase();
                const target = t.target_address || nodeName[t.target_node_id] || t.target_node_id || "-";
                const alerting = t.alert_status === "alerting";
                const on = hasAlert(t);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 540 }}>
                      <span className="row gap-6">{t.name}{alerting && <span className="dot red pulse" />}</span>
                    </td>
                    <td><Tag tone={PROTO_COLORS[proto] || "gray"} className="proto-tag">{proto}</Tag></td>
                    <td className="muted">{nodeName[t.source_node_id] || t.source_node_id}</td>
                    <td className="mono muted" style={{ fontSize: 12 }}>{target}{t.target_port ? ":" + t.target_port : ""}</td>
                    <td className="num">{t.interval}</td>
                    <td><Switch sm on={!!t.enabled} onChange={() => toggle(t)} /></td>
                    <td><Tag tone={on ? "blue" : "gray"} dot={on}>{on ? "开" : "关"}</Tag></td>
                    <td>
                      <div className="actions" style={{ justifyContent: "flex-end" }}>
                        <RowBtn icon="edit" label="编辑" onClick={() => setModal({ type: "edit", task: t })} />
                        <RowBtn icon="power" label={t.enabled ? "禁用" : "启用"} onClick={() => toggle(t)} />
                        <RowBtn icon="trash" label="删除" tone="danger" onClick={() => setConfirm(t)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loaded && tasks.length === 0 && <Empty text={nodes.length ? "暂无任务，点击右上角添加" : "请先在节点管理中添加节点"} />}
        {!loaded && <div className="muted" style={{ padding: "16px 20px" }}>加载中…</div>}
      </div>
      {modal && <TaskFormModal editing={modal.type === "edit" ? modal.task : null} nodes={nodes} onClose={() => setModal(null)} onSave={save} />}
      {confirm && <Confirm title="删除任务" danger confirmText="删除" message={`确认删除任务「${confirm.name}」？历史数据将一并删除。`} onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/* —— 任务 新增/编辑 弹窗 —— */
function TaskFormModal({ editing, nodes, onClose, onSave }) {
  const e = editing || {};
  const initInternal = (e.target_type || "external") === "internal";
  const [f, setF] = useState({
    name: e.name || "",
    source_node_id: e.source_node_id || (nodes[0] ? nodes[0].id : ""),
    protocol: e.protocol || "icmp",
    targetType: initInternal ? "internal" : "external",
    target_address: e.target_address || "",
    target_node_id: e.target_node_id || "",
    target_port: e.target_port != null ? String(e.target_port) : "",
    interval: e.interval != null ? e.interval : 5,
    timeout: e.timeout != null ? e.timeout : 5,
  });
  const [alertOn, setAlertOn] = useState(editing ? hasAlert(e) : false);
  const [a, setA] = useState({
    latency: e.alert_latency_threshold != null ? String(e.alert_latency_threshold) : "200",
    loss: e.alert_loss_threshold != null ? String(e.alert_loss_threshold) : "5",
    fail: e.alert_fail_count != null ? String(e.alert_fail_count) : "3",
    trigger: e.alert_trigger_count != null ? String(e.alert_trigger_count) : "3",
    recovery: e.alert_recovery_count != null ? String(e.alert_recovery_count) : "3",
    cooldown: e.alert_cooldown != null ? String(e.alert_cooldown) : "300",
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setAlert = (k, v) => setA((s) => ({ ...s, [k]: v }));
  const needPort = f.protocol === "tcp" || f.protocol === "udp";
  const internal = f.targetType === "internal";

  // 告警阈值数值（空 → null）
  const numOrNull = (v) => (v === "" || v == null ? null : Number(v));
  const intOr = (v, d) => (v === "" || v == null ? d : parseInt(v, 10));

  const alertPayload = () => alertOn ? {
    alert_latency_threshold: numOrNull(a.latency),
    alert_loss_threshold: numOrNull(a.loss),
    alert_fail_count: a.fail === "" ? null : intOr(a.fail, null),
    alert_trigger_count: intOr(a.trigger, 3),
    alert_recovery_count: intOr(a.recovery, 3),
    alert_cooldown: intOr(a.cooldown, 300),
  } : {
    // 关闭告警 → 清空三个阈值（保留触发/恢复/冷却的默认也无妨）
    alert_latency_threshold: null, alert_loss_threshold: null, alert_fail_count: null,
  };

  const submit = async () => {
    if (!f.name.trim()) { setErr("请输入任务名称"); return; }
    if (!f.source_node_id) { setErr("请选择源节点"); return; }
    if (internal && !f.target_node_id) { setErr("请选择目标节点"); return; }
    if (!internal && !f.target_address.trim()) { setErr("请填写目标地址"); return; }
    if (needPort && !f.target_port) { setErr("该协议需要填写端口"); return; }

    setBusy(true); setErr("");
    try {
      if (editing) {
        // PATCH 仅支持：name/interval/timeout + 告警字段（协议/源/目标不可改）
        await onSave({
          name: f.name.trim(),
          interval: intOr(f.interval, 5),
          timeout: intOr(f.timeout, 5),
          ...alertPayload(),
        }, editing);
      } else {
        await onSave({
          name: f.name.trim(),
          source_node_id: f.source_node_id,
          protocol: f.protocol,
          target_type: f.targetType,
          target_address: internal ? null : f.target_address.trim(),
          target_node_id: internal ? f.target_node_id : null,
          target_port: needPort ? intOr(f.target_port, null) : null,
          interval: intOr(f.interval, 5),
          timeout: intOr(f.timeout, 5),
          ...alertPayload(),
        }, null);
      }
      onClose();
    } catch (ex) {
      setErr(ex.message || "保存失败");
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? "编辑任务" : "添加任务"} onClose={onClose} wide
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "保存中…" : (editing ? "保存" : "创建")}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      {editing && <div className="field hint" style={{ marginTop: -4 }}>协议、源节点与目标创建后不可修改；如需变更请新建任务。</div>}
      <div className="field">
        <label className="req">任务名称</label>
        <input className="input" value={f.name} onChange={(ev) => set("name", ev.target.value)} placeholder="如 沪→京延迟" autoFocus />
      </div>
      <div className="row gap-12">
        <div className="field grow"><label className="req">源节点</label>
          <select className="select" value={f.source_node_id} onChange={(ev) => set("source_node_id", ev.target.value)} disabled={!!editing}>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </div>
        <div className="field grow"><label className="req">协议</label>
          <select className="select" value={f.protocol} onChange={(ev) => set("protocol", ev.target.value)} disabled={!!editing}>
            {PROTOS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        </div>
      </div>
      <div className="row gap-12">
        <div className="field grow"><label>目标类型</label>
          <select className="select" value={f.targetType} onChange={(ev) => set("targetType", ev.target.value)} disabled={!!editing}>
            <option value="external">外部目标</option>
            <option value="internal">内部节点</option>
          </select>
        </div>
        <div className="field grow"><label className="req">{internal ? "目标节点" : "目标地址"}</label>
          {internal
            ? <select className="select" value={f.target_node_id} onChange={(ev) => set("target_node_id", ev.target.value)} disabled={!!editing}>
                <option value="">请选择</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            : <input className="input" value={f.target_address} onChange={(ev) => set("target_address", ev.target.value)} disabled={!!editing} placeholder={f.protocol === "http" ? "https://example.com" : "如 8.8.8.8"} />}
        </div>
        {needPort && <div className="field" style={{ width: 110 }}><label className="req">端口</label><input className="input num" value={f.target_port} onChange={(ev) => set("target_port", ev.target.value)} disabled={!!editing} placeholder="443" /></div>}
      </div>
      <div className="row gap-12">
        <div className="field grow"><label>探测间隔（秒）</label><input className="input num" type="number" min="1" max="3600" value={f.interval} onChange={(ev) => set("interval", ev.target.value)} /></div>
        <div className="field grow"><label>超时（秒）</label><input className="input num" type="number" min="1" max="120" value={f.timeout} onChange={(ev) => set("timeout", ev.target.value)} /></div>
      </div>

      <div className="divider" />
      <div className="row between" style={{ marginBottom: alertOn ? 16 : 0 }}>
        <div><div style={{ fontWeight: 540, fontSize: 13.5 }}>告警（选填）</div><div className="hint" style={{ marginTop: 2 }}>开启后，指标连续超过阈值将通过告警通道通知</div></div>
        <Switch on={alertOn} onChange={setAlertOn} />
      </div>
      {alertOn && (
        <div className="fade-up">
          <div className="row gap-12">
            <div className="field grow"><label>延迟阈值（ms）</label><input className="input num" type="number" value={a.latency} onChange={(ev) => setAlert("latency", ev.target.value)} placeholder="留空不启用" /></div>
            <div className="field grow"><label>丢包率阈值（%）</label><input className="input num" type="number" value={a.loss} onChange={(ev) => setAlert("loss", ev.target.value)} placeholder="留空不启用" /></div>
            <div className="field grow"><label>连续失败次数</label><input className="input num" type="number" value={a.fail} onChange={(ev) => setAlert("fail", ev.target.value)} placeholder="留空不启用" /></div>
          </div>
          <div className="row gap-12">
            <div className="field grow"><label>触发次数</label><input className="input num" type="number" value={a.trigger} onChange={(ev) => setAlert("trigger", ev.target.value)} /></div>
            <div className="field grow"><label>恢复次数</label><input className="input num" type="number" value={a.recovery} onChange={(ev) => setAlert("recovery", ev.target.value)} /></div>
            <div className="field grow"><label>冷却时间（s）</label><input className="input num" type="number" value={a.cooldown} onChange={(ev) => setAlert("cooldown", ev.target.value)} /></div>
          </div>
          <div className="hint" style={{ marginTop: -4 }}>延迟 / 丢包 / 失败 三类阈值至少填一项；连续达到「触发次数」即告警，连续正常「恢复次数」即恢复。</div>
        </div>
      )}
    </Modal>
  );
}
