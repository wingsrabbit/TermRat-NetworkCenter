/* ============================================================
   ONC — 系统设置（admin）：分组表单 → PUT /api/settings
   keys: site_title, site_subtitle, data_retention_days,
         global_alert_cooldown, default_probe_interval, default_probe_timeout
   ============================================================ */
import React, { useState, useEffect } from "react";
import { Ic, Tag, useToast } from "../../ui.jsx";
import { useApp } from "../../store.jsx";
import { PageHeader } from "./_common.jsx";
import { apiGetSettings, apiPutSettings, apiGetWebConfig, apiSetWebConfig, apiSetWebCert } from "../../api.js";

const DEFAULTS = {
  site_title: "网络状态中心",
  site_subtitle: "实时服务器资源监控 · 网络质量探测",
  brand_mark: "NC",
  brand_logo: "",
  data_retention_days: 3,
  global_alert_cooldown: 300,
  default_probe_interval: 5,
  default_probe_timeout: 5,
};

export function SettingsPage() {
  const toast = useToast();
  const { refreshBrand } = useApp();
  const [f, setF] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGetSettings().then((d) => {
      if (!alive) return;
      setF({ ...DEFAULTS, ...(d.settings || {}) });
    }).catch((e) => { if (alive) toast.error(e.message || "加载设置失败"); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const onLogoFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 256 * 1024) { toast.error("图片过大，请用 ≤256KB 的 PNG / SVG"); return; }
    const reader = new FileReader();
    reader.onload = () => set("brand_logo", reader.result);   // data URL（base64）
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        site_title: f.site_title,
        site_subtitle: f.site_subtitle,
        brand_mark: (f.brand_mark || "NC").slice(0, 3),
        brand_logo: f.brand_logo || "",
        data_retention_days: Number(f.data_retention_days),
        global_alert_cooldown: Number(f.global_alert_cooldown),
        default_probe_interval: Number(f.default_probe_interval),
        default_probe_timeout: Number(f.default_probe_timeout),
      };
      const d = await apiPutSettings(payload);
      setF({ ...DEFAULTS, ...(d.settings || payload) });
      if (refreshBrand) refreshBrand();   // 即时刷新侧栏 / 标题等品牌显示
      toast.success("保存成功");
    } catch (e) {
      toast.error(e.message || "保存失败");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return <div className="fade-up" style={{ maxWidth: 820 }}><PageHeader title="系统设置" desc="站点、探测默认值与数据保留策略" /><div className="card card-pad"><div className="muted">加载中…</div></div></div>;
  }

  return (
    <div className="fade-up" style={{ maxWidth: 820 }}>
      <PageHeader title="系统设置" desc="站点、探测默认值与数据保留策略" />
      <div className="col gap-16">
        <SettingsGroup title="品牌 / 外观" icon="globe">
          <SField label="品牌名称" hint="显示在侧栏 / 登录 / 公开页 / 浏览器标题"><input className="input" value={f.site_title} onChange={(e) => set("site_title", e.target.value)} /></SField>
          <SField label="副标题"><input className="input" value={f.site_subtitle} onChange={(e) => set("site_subtitle", e.target.value)} /></SField>
          <SField label="Logo 字母标" hint="无图片时显示，1–3 个字符"><input className="input" value={f.brand_mark} maxLength={3} onChange={(e) => set("brand_mark", e.target.value)} placeholder="NC" /></SField>
          <SField label="Logo 图片" hint="留空用字母标；≤256KB 的 PNG / SVG">
            <div className="row gap-10" style={{ alignItems: "center" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, flex: "none", overflow: "hidden", background: f.brand_logo ? "transparent" : "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                {f.brand_logo ? <img src={f.brand_logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.04em" }}>{(f.brand_mark || "NC").slice(0, 3)}</span>}
              </div>
              <label className="btn sm" style={{ cursor: "pointer", marginBottom: 0 }}><Ic name="arrowUp" size={14} />上传<input type="file" accept="image/*" style={{ display: "none" }} onChange={onLogoFile} /></label>
              {f.brand_logo && <button className="btn sm" type="button" onClick={() => set("brand_logo", "")}>移除</button>}
            </div>
          </SField>
        </SettingsGroup>

        <SettingsGroup title="探测默认值" icon="signal">
          <SField label="默认探测间隔（秒）" hint="新建任务的默认值"><NumIn v={f.default_probe_interval} min={1} max={3600} on={(v) => set("default_probe_interval", v)} /></SField>
          <SField label="默认探测超时（秒）" hint="新建任务的默认值"><NumIn v={f.default_probe_timeout} min={1} max={120} on={(v) => set("default_probe_timeout", v)} /></SField>
        </SettingsGroup>

        <SettingsGroup title="数据与告警" icon="history">
          <SField label="数据保留天数" hint="时序数据超期自动清理"><NumIn v={f.data_retention_days} min={1} max={365} on={(v) => set("data_retention_days", v)} /></SField>
          <SField label="全局告警冷却（秒）" hint="同一任务两次告警的最小间隔"><NumIn v={f.global_alert_cooldown} min={0} max={86400} on={(v) => set("global_alert_cooldown", v)} /></SField>
        </SettingsGroup>

        <WebHttpsPanel />

        <div className="row end" style={{ position: "sticky", bottom: 0, paddingTop: 4 }}>
          <button className="btn primary lg" onClick={save} disabled={busy}><Ic name="check" size={16} />{busy ? "保存中…" : "保存设置"}</button>
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
  return <input className="input num" type="number" min={min} max={max} value={v} onChange={(e) => on(e.target.value)} />;
}

/* —— Web 访问 / HTTPS（内嵌 Caddy；独立的应用按钮，切换即热重载）—— */
const WEB_MODES = [
  { k: "http", t: "HTTP（默认）", d: "纯 HTTP，监听 80 端口" },
  { k: "https-le", t: "HTTPS · Let's Encrypt", d: "自动签发，需域名解析到本机" },
  { k: "https-custom", t: "HTTPS · 上传证书", d: "使用你上传的证书 / 私钥" },
  { k: "https-selfsigned", t: "HTTPS · 自签名", d: "内部 CA 自签，适合纯 IP" },
];
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function WebHttpsPanel() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [mode, setMode] = useState("http");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [httpPort, setHttpPort] = useState(80);
  const [httpsPort, setHttpsPort] = useState(443);
  const [certText, setCertText] = useState("");
  const [keyText, setKeyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const load = () =>
    apiGetWebConfig().then((d) => {
      setCfg(d);
      setMode(d.web_mode || "http");
      setDomain(d.web_domain || "");
      setEmail(d.web_email || "");
      setHttpPort(d.web_http_port ?? 80);
      setHttpsPort(d.web_https_port ?? 443);
    }).catch((e) => toast.error(e.message || "加载 Web 配置失败"));

  useEffect(() => { load(); }, []); // eslint-disable-line

  const uploadCert = async () => {
    if (!certText.trim() || !keyText.trim()) { toast.error("请粘贴证书与私钥（PEM）"); return; }
    setBusy(true);
    try {
      await apiSetWebCert({ cert: certText, key: keyText });
      toast.success("证书已保存");
      setCertText(""); setKeyText("");
      await load();
    } catch (e) { toast.error(e.message || "上传失败"); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await apiSetWebConfig({
        web_mode: mode, web_domain: domain.trim(), web_email: email.trim(),
        web_http_port: Number(httpPort), web_https_port: Number(httpsPort),
      });
      setCfg(r);
      const ok = r.applied !== false;
      setResult({ ok, message: r.message || (ok ? "已应用并热重载 Caddy" : "应用失败") });
      if (ok) toast.success("已应用 Web 配置"); else toast.error("应用失败");
    } catch (e) {
      setResult({ ok: false, message: e.message || "应用失败" });
      toast.error(e.message || "应用失败");
    } finally { setBusy(false); }
  };

  if (!cfg) return <div className="card card-pad"><div className="muted">加载 Web 配置…</div></div>;
  const isHttps = mode !== "http";

  return (
    <div className="card card-pad">
      <div className="row gap-8" style={{ marginBottom: 6 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Ic name="globe" size={16} /></span>
        <h3 className="h3" style={{ fontSize: 14.5 }}>Web 访问 / HTTPS</h3>
      </div>
      <div className="hint" style={{ marginTop: 0, marginBottom: 14 }}>浏览器访问由内嵌 Caddy 前置；切换后即时热重载（配置非法会保持原配置不中断）。agent 上报与兜底访问始终走独立端口 <span style={{ fontFamily: MONO }}>:{cfg.agent_port}</span>，不受影响。</div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, marginBottom: 14 }}>
        {WEB_MODES.map((m) => (
          <button key={m.k} type="button" onClick={() => setMode(m.k)}
            style={{ padding: "11px 13px", textAlign: "left", cursor: "pointer", borderRadius: 10,
                     border: mode === m.k ? "1.5px solid var(--primary)" : "1px solid var(--border)",
                     background: mode === m.k ? "var(--primary-soft)" : "var(--bg)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3, color: mode === m.k ? "var(--primary)" : "var(--text)" }}>{m.t}</div>
            <div className="hint" style={{ margin: 0 }}>{m.d}</div>
          </button>
        ))}
      </div>

      {isHttps && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label className={mode === "https-le" ? "req" : ""}>域名{mode === "https-le" ? "" : "（可选）"}</label>
          <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="status.example.com" />
          {mode === "https-le" && <div className="hint">需把该域名 A 记录解析到本机公网 IP，且 80 / 443 可达，Caddy 才能签发。</div>}
        </div>
      )}

      {mode === "https-le" && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label>通知邮箱（可选）</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
      )}

      {mode === "https-custom" && (
        <div className="field" style={{ marginBottom: 12 }}>
          <label>上传证书 {cfg.has_custom_cert ? <Tag tone="green">已存在证书</Tag> : <Tag tone="red">未上传</Tag>}</label>
          <textarea className="input" rows={3} value={certText} onChange={(e) => setCertText(e.target.value)} placeholder="-----BEGIN CERTIFICATE-----（含完整证书链）" style={{ fontFamily: MONO, fontSize: 12, marginBottom: 8 }} />
          <textarea className="input" rows={3} value={keyText} onChange={(e) => setKeyText(e.target.value)} placeholder="-----BEGIN PRIVATE KEY-----" style={{ fontFamily: MONO, fontSize: 12 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" type="button" onClick={uploadCert} disabled={busy}><Ic name="check" size={14} />保存证书</button>
          </div>
        </div>
      )}

      <div className="row gap-12" style={{ marginBottom: 12 }}>
        <div className="field grow" style={{ marginBottom: 0 }}><label>HTTP 端口</label><input className="input num" type="number" value={httpPort} onChange={(e) => setHttpPort(e.target.value)} /></div>
        <div className="field grow" style={{ marginBottom: 0 }}><label>HTTPS 端口</label><input className="input num" type="number" value={httpsPort} onChange={(e) => setHttpsPort(e.target.value)} disabled={!isHttps} /></div>
      </div>

      {mode === "https-selfsigned" && <div className="warn-note"><Ic name="warnTri" />自签名证书浏览器会提示「不安全 / 证书无效」，属正常现象，点继续访问即可。</div>}

      <div className="hint" style={{ marginBottom: 4 }}>当前建议访问：<b>{(cfg.access_urls || []).join("  /  ") || "—"}</b></div>
      <div className="hint" style={{ marginBottom: 12 }}>部署须发布端口：<span style={{ fontFamily: MONO }}>-p {httpPort}:{httpPort} -p {httpsPort}:{httpsPort} -p {cfg.agent_port}:{cfg.agent_port}</span></div>

      {result && (result.ok
        ? <div className="hint" style={{ color: "var(--green)", marginBottom: 12, fontWeight: 600 }}>✓ {result.message}</div>
        : <div className="warn-note"><Ic name="warnTri" />{result.message}</div>)}

      <div className="row end">
        <button className="btn primary" onClick={apply} disabled={busy}><Ic name="check" size={15} />{busy ? "应用中…" : "应用并重载"}</button>
      </div>
    </div>
  );
}
