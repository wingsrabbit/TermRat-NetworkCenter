/* ============================================================
   ONC — 用户管理（admin）：账号表 + 添加 / 重置密码 / 删除
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Ic, Tag, Empty, Modal, Confirm, useToast } from "../../ui.jsx";
import { PageHeader, RowBtn } from "./_common.jsx";
import { apiListUsers, apiCreateUser, apiDeleteUser, apiResetPassword } from "../../api.js";

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState(null);   // {type:'add'} | {type:'reset', user}
  const [confirm, setConfirm] = useState(null);

  const reload = async () => {
    try {
      const d = await apiListUsers();
      setUsers(d.users || []);
    } catch (e) { toast.error(e.message || "加载用户失败"); }
    finally { setLoaded(true); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const adminCount = users.filter((u) => u.role === "admin").length;

  const del = async (u) => {
    if (u.role === "admin" && adminCount <= 1) { toast.error("至少保留一个管理员，无法删除"); return; }
    try {
      await apiDeleteUser(u.id);
      setUsers((us) => us.filter((x) => x.id !== u.id));
      toast.success(`已删除用户「${u.username}」`);
    } catch (e) { toast.error(e.message || "删除失败"); }
  };

  const add = async (data) => {
    await apiCreateUser(data);
    await reload();
    toast.success("用户已添加");
  };

  const reset = async (user, password) => {
    await apiResetPassword(user.id, password);
    toast.success(`已重置「${user.username}」的密码`);
  };

  return (
    <div className="fade-up">
      <PageHeader title="用户管理" desc="管理控制台账号与角色权限"
        action={<button className="btn primary" onClick={() => setModal({ type: "add" })}><Ic name="plus" size={15} />添加用户</button>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>用户名</th><th>角色</th><th>创建时间</th><th>创建者</th><th style={{ textAlign: "right" }}>操作</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><span className="row gap-8" style={{ fontWeight: 540 }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", background: u.role === "admin" ? "var(--primary-soft)" : "var(--panel)", color: u.role === "admin" ? "var(--primary)" : "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>{(u.username || "?").slice(0, 1).toUpperCase()}</span>
                    {u.username}</span></td>
                  <td><Tag tone={u.role === "admin" ? "blue" : "gray"}>{u.role === "admin" ? "管理员" : "只读"}</Tag></td>
                  <td className="mono muted" style={{ fontSize: 12.5 }}>{u.created_at || "—"}</td>
                  <td className="muted">{u.created_by || "—"}</td>
                  <td><div className="actions" style={{ justifyContent: "flex-end" }}>
                    <RowBtn icon="key" label="重置密码" onClick={() => setModal({ type: "reset", user: u })} />
                    <RowBtn icon="trash" label="删除" tone="danger" disabled={u.role === "admin" && adminCount <= 1} onClick={() => setConfirm(u)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loaded && users.length === 0 && <Empty text="暂无用户" />}
        {!loaded && <div className="muted" style={{ padding: "16px 20px" }}>加载中…</div>}
      </div>
      {modal && modal.type === "add" && <UserModal onClose={() => setModal(null)} onSave={add} />}
      {modal && modal.type === "reset" && <ResetModal user={modal.user} onClose={() => setModal(null)} onSave={reset} />}
      {confirm && <Confirm title="删除用户" danger confirmText="删除" message={`确认删除用户「${confirm.username}」？该账号的会话将立即失效。`} onConfirm={() => del(confirm)} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function UserModal({ onClose, onSave }) {
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("readonly");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !pwd) { setErr("请填写用户名与初始密码"); return; }
    setBusy(true); setErr("");
    try {
      await onSave({ username: username.trim(), password: pwd, role });
      onClose();
    } catch (e) { setErr(e.message || "添加失败"); setBusy(false); }
  };

  return (
    <Modal title="添加用户" onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "添加中…" : "添加"}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field"><label className="req">用户名</label><input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="off" /></div>
      <div className="field"><label className="req">初始密码</label><input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete="new-password" /></div>
      <div className="field" style={{ marginBottom: 0 }}><label>角色</label>
        <div className="seg" style={{ width: "100%" }}>
          <button type="button" className={role === "admin" ? "active" : ""} style={{ flex: 1 }} onClick={() => setRole("admin")}>管理员</button>
          <button type="button" className={role === "readonly" ? "active" : ""} style={{ flex: 1 }} onClick={() => setRole("readonly")}>只读</button>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>管理员拥有全部权限；只读仅能查看仪表盘与告警历史。</div>
      </div>
    </Modal>
  );
}

function ResetModal({ user, onClose, onSave }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pwd) { setErr("请输入新密码"); return; }
    setBusy(true); setErr("");
    try {
      await onSave(user, pwd);
      onClose();
    } catch (e) { setErr(e.message || "重置失败"); setBusy(false); }
  };

  return (
    <Modal title={`重置密码 · ${user.username}`} onClose={onClose}
      footer={<React.Fragment><button className="btn" onClick={onClose}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? "提交中…" : "确认重置"}</button></React.Fragment>}>
      {err && <div className="warn-note"><Ic name="warnTri" />{err}</div>}
      <div className="field" style={{ marginBottom: 0 }}><label className="req">新密码</label><input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus autoComplete="new-password" placeholder="请输入新密码" /></div>
    </Modal>
  );
}
