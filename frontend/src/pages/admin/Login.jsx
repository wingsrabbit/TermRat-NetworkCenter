/* ============================================================
   ONC — 管理端登录页（WHMCS 风格居中卡片）
   ============================================================ */
import React, { useState, useEffect } from "react";
import { useApp, ThemeToggle, Brand } from "../../store.jsx";
import { Ic, Checkbox } from "../../ui.jsx";

const REMEMBER_KEY = "onc-remember-user";

export function Login() {
  const { login, navigate, auth, brand, adminPath } = useApp();
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) || ""; } catch (e) { return ""; }
  });
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // 已登录 → 直接进仪表盘
  useEffect(() => { if (auth) navigate(`/${adminPath}/dashboard`); }, [auth]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !pwd) { setErr("请输入用户名与密码"); return; }
    setLoading(true);
    try {
      await login(name.trim(), pwd);
      try {
        if (remember) localStorage.setItem(REMEMBER_KEY, name.trim());
        else localStorage.removeItem(REMEMBER_KEY);
      } catch (_) { /* noop */ }
      navigate(`/${adminPath}/dashboard`);
    } catch (ex) {
      setErr(ex.message || "登录失败，请重试");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "var(--panel)", padding: 24, position: "relative",
      backgroundImage: "radial-gradient(var(--border) 0.6px, transparent 0.6px)", backgroundSize: "22px 22px",
    }}>
      <div style={{ position: "absolute", top: 20, right: 24 }}><ThemeToggle /></div>

      <div className="fade-up" style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "inline-flex", marginBottom: 14 }}><Brand compact /></div>
          <h1 className="h1" style={{ fontSize: 21 }}>管理登录</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{brand.name} · 控制台</p>
        </div>

        <form onSubmit={submit} className="card card-pad" style={{ padding: "26px 26px 22px" }}>
          {err && <div className="warn-note" style={{ marginBottom: 16 }}><Ic name="warnTri" />{err}</div>}
          <div className="field">
            <label className="req">用户名</label>
            <input className={"input" + (err && !name ? " error" : "")} value={name}
              onChange={(e) => setName(e.target.value)} placeholder="请输入用户名" autoFocus autoComplete="username" />
          </div>
          <div className="field">
            <label className="req">密码</label>
            <div className="input-affix">
              <input className={"input" + (err && !pwd ? " error" : "")} type={show ? "text" : "password"}
                value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="请输入密码"
                autoComplete="current-password" style={{ paddingRight: 38 }} />
              <button type="button" className="btn-icon eye" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="显示密码">
                <Ic name={show ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
          </div>
          <div className="row between" style={{ marginBottom: 18 }}>
            <Checkbox checked={remember} onChange={setRemember}>记住我</Checkbox>
          </div>
          <button className="btn primary block lg" disabled={loading} type="submit">
            {loading ? <Ic name="refresh" size={16} className="spin" /> : null}
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button className="btn-link" onClick={() => navigate("/")}>
            <Ic name="chevLeft" size={13} style={{ verticalAlign: "-2px" }} /> 返回公开主页
          </button>
        </div>
      </div>
    </div>
  );
}
