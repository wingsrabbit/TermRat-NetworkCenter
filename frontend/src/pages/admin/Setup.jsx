/* ============================================================
   ONC — 初次安装向导 (/admin，库内无用户时显示)
   设置首个管理员 + 站点信息 → 创建并直接登录
   ============================================================ */
import React, { useState } from "react";
import { useApp, ThemeToggle, Brand } from "../../store.jsx";
import { Ic } from "../../ui.jsx";

export function Setup() {
  const { setup, navigate } = useApp();
  const [name, setName] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("ONC 网络状态中心");
  const [subtitle, setSubtitle] = useState("实时服务器资源监控 · 网络质量探测");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (name.trim().length < 3) { setErr("用户名至少 3 个字符"); return; }
    if (pwd.length < 8) { setErr("密码至少 8 个字符"); return; }
    if (pwd !== pwd2) { setErr("两次输入的密码不一致"); return; }
    setLoading(true);
    try {
      await setup({
        username: name.trim(),
        password: pwd,
        site_title: title.trim(),
        site_subtitle: subtitle.trim(),
      });
      navigate("/admin/dashboard");
    } catch (ex) {
      setErr(ex.message || "初始化失败，请重试");
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

      <div className="fade-up" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "inline-flex", marginBottom: 14 }}><Brand compact /></div>
          <h1 className="h1" style={{ fontSize: 21 }}>初次安装</h1>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>创建管理员账号，开始使用 ONC 网络状态中心</p>
        </div>

        <form onSubmit={submit} className="card card-pad" style={{ padding: "24px 26px 22px" }}>
          {err && <div className="warn-note" style={{ marginBottom: 16 }}><Ic name="warnTri" />{err}</div>}

          <div className="section-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 10, letterSpacing: "0.02em" }}>管理员账号</div>
          <div className="field">
            <label className="req">用户名</label>
            <input className={"input" + (err && name.trim().length < 3 ? " error" : "")} value={name}
              onChange={(e) => setName(e.target.value)} placeholder="设置管理员用户名" autoFocus autoComplete="username" />
          </div>
          <div className="field">
            <label className="req">密码</label>
            <div className="input-affix">
              <input className={"input" + (err && pwd.length < 8 ? " error" : "")} type={show ? "text" : "password"}
                value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="至少 8 个字符"
                autoComplete="new-password" style={{ paddingRight: 38 }} />
              <button type="button" className="btn-icon eye" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="显示密码">
                <Ic name={show ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
          </div>
          <div className="field">
            <label className="req">确认密码</label>
            <input className={"input" + (err && pwd !== pwd2 ? " error" : "")} type={show ? "text" : "password"}
              value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder="再次输入密码" autoComplete="new-password" />
          </div>

          <div className="section-label" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", margin: "6px 0 10px", letterSpacing: "0.02em" }}>站点信息（可改）</div>
          <div className="field">
            <label>站点标题</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="公开页 / 后台标题" />
          </div>
          <div className="field">
            <label>站点副标题</label>
            <input className="input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="副标题" />
          </div>

          <button className="btn primary block lg" disabled={loading} type="submit" style={{ marginTop: 6 }}>
            {loading ? <Ic name="refresh" size={16} className="spin" /> : <Ic name="check" size={16} />}
            {loading ? "创建中…" : "完成安装并进入"}
          </button>
          <div className="faint" style={{ fontSize: 12, textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
            进入后可在「节点管理」添加被监控机、「系统设置」配置 HTTPS。
          </div>
        </form>
      </div>
    </div>
  );
}
