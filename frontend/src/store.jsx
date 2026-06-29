/* ============================================================
   ONC — 应用状态：路由 / 主题 / 鉴权 / 角色 / 刷新计时（ESM）
   ============================================================ */
import React, { useState, useEffect, useMemo, useCallback, createContext, useContext } from "react";
import { Ic } from "./ui.jsx";
import { apiLogin, apiLogout, apiMe, apiSetup, apiBranding, getToken, setToken } from "./api.js";
import { localizeBrand, normalizeLang, persistLang, resolveInitialLang, translate, writeLangToUrl } from "./i18n.js";

const AppCtx = createContext(null);
export function useApp() { return useContext(AppCtx); }

export function parseHash() {
  let h = window.location.hash.replace(/^#/, "");
  if (!h) h = "/";
  const [path, query] = h.split("?");
  const parts = path.split("/").filter(Boolean); // e.g. ['admin','dashboard','t-1']
  return { path, parts, query: query || "" };
}

export function navigate(to) {
  if (window.location.hash.replace(/^#/, "") === to) return;
  window.location.hash = to;
}

export function AppProvider({ children }) {
  // —— 路由 —— //
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const h = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  // —— 主题 —— //
  const [theme, setTheme] = useState(() => localStorage.getItem("onc-theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("onc-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // —— 语言（URL lang > localStorage > navigator.language > zh） —— //
  const [lang, setLangState] = useState(() => resolveInitialLang());
  useEffect(() => { persistLang(lang); }, [lang]);
  const setLang = useCallback((next) => {
    const normalized = normalizeLang(next) || "zh";
    setLangState(normalized);
    persistLang(normalized);
    writeLangToUrl(normalized);
  }, []);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  // —— 鉴权 + 角色（真实后端会话 token）—— //
  // auth: { username, role } | null。本地缓存仅为首屏即时渲染，token 才是凭据。
  const [auth, setAuth] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem("onc-auth") || "null");
      // 缓存了用户但 token 已丢失（如手动清理）→ 视为未登录
      return a && getToken() ? a : null;
    } catch (e) { return null; }
  });
  const persistAuth = (a) => {
    if (a) localStorage.setItem("onc-auth", JSON.stringify(a));
    else localStorage.removeItem("onc-auth");
  };
  const applyAuth = (user) => {
    const a = { username: user.username, role: user.role };
    setAuth(a); persistAuth(a);
    return a;
  };
  /** 登录：调用后端，存 token + 用户。成功 resolve 用户，失败抛 error（页面捕获展示）。 */
  const login = async (username, password) => {
    const user = await apiLogin(username, password); // 失败抛出
    return applyAuth(user);
  };
  /** 初次安装：创建首个管理员并直接登录。 */
  const setup = async (payload) => {
    const user = await apiSetup(payload); // 失败抛出
    return applyAuth(user);
  };
  const logout = () => {
    apiLogout();            // best-effort 通知后端 + 清 token
    setAuth(null); persistAuth(null);
    navigate("/" + adminPath);
  };
  const isAdmin = !!(auth && auth.role === "admin");

  // 有 token 时启动校验一次：若 token 失效/角色变化 → 同步本地状态。
  useEffect(() => {
    let alive = true;
    if (getToken()) {
      apiMe()
        .then((d) => { if (alive && d && d.user) applyAuth(d.user); })
        .catch(() => { if (alive) { setToken(""); setAuth(null); persistAuth(null); } });
    }
    // 仅启动时执行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 刷新计时（"最后更新 Xs 前"） —— //
  const [tick, setTick] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const secTimer = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(secTimer);
  }, [lastUpdate]);
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      setTick((t) => t + 1);
      setLastUpdate(Date.now());
      setSecondsAgo(0);
    }, 10000);
    return () => clearInterval(refreshTimer);
  }, []);

  // —— 当前时间（GMT+8） —— //
  const [clock, setClock] = useState(() => fmtClock());
  useEffect(() => {
    const t = setInterval(() => setClock(fmtClock()), 1000);
    return () => clearInterval(t);
  }, []);

  // —— 品牌（名称 / 字母标 / Logo，公开取，可在系统设置自定义）—— //
  const [rawBrand, setRawBrand] = useState({ name: "", subtitle: "", mark: "NC", logo: "" });
  const brand = useMemo(() => localizeBrand(rawBrand, lang), [rawBrand, lang]);
  const [adminPath, setAdminPath] = useState("admin"); // 管理后台路径段 /<adminPath>（公开 branding 提供，安装向导可改）
  const refreshBrand = () => apiBranding().then((b) => {
    if (!b) return;
    const nb = { name: b.name || "", subtitle: b.subtitle || "", mark: b.mark || "NC", logo: b.logo || "" };
    setRawBrand(nb);
    setAdminPath(b.admin_path || "admin");
  }).catch(() => {});
  useEffect(() => { refreshBrand(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    if (brand.name) document.title = brand.name;
  }, [brand.name]);

  const ctx = {
    route, navigate, theme, toggleTheme,
    lang, setLang, t,
    auth, login, setup, logout, isAdmin,
    tick, secondsAgo, clock, brand, refreshBrand, adminPath,
  };
  return <AppCtx.Provider value={ctx}>{children}</AppCtx.Provider>;
}

function fmtClock() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* —— 主题切换按钮（公用） —— */
export function ThemeToggle() {
  const { theme, toggleTheme, t } = useApp();
  return (
    <button className="btn-icon" onClick={toggleTheme} aria-label={t("theme.toggle")} title={theme === "light" ? t("theme.toDark") : t("theme.toLight")}>
      <Ic name={theme === "light" ? "moon" : "sun"} />
    </button>
  );
}

/* —— 公开页语言切换 —— */
export function LanguageSwitch() {
  const { lang, setLang, t } = useApp();
  return (
    <div className="seg lang-switch" role="group" aria-label={t("lang.switch")}>
      <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>{t("lang.english")}</button>
      <button type="button" className={lang === "zh" ? "active" : ""} onClick={() => setLang("zh")}>{t("lang.chinese")}</button>
    </div>
  );
}

/* —— Logo 方块（自定义图片 或 字母标，读 store.brand） —— */
export function BrandMark({ size = 30 }) {
  const { brand } = useApp();
  const logo = brand && brand.logo;
  const mark = ((brand && brand.mark) || "NC").slice(0, 3);
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, flex: "none", overflow: "hidden",
      background: logo ? "transparent" : "var(--primary)",
      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
      boxShadow: logo ? "none" : "0 2px 6px rgba(47,111,237,0.35)",
    }}>
      {logo
        ? <img src={logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : <span style={{ fontSize: size * 0.42, fontWeight: 800, letterSpacing: "-0.04em" }}>{mark}</span>}
    </div>
  );
}

/* —— 品牌标志（Logo + 名称，读 store.brand） —— */
export function Brand({ compact }) {
  const { brand } = useApp();
  return (
    <div className="row gap-8" style={{ alignItems: "center" }}>
      <BrandMark size={30} />
      {!compact && <span className="brand-name" style={{ fontWeight: 660, fontSize: 15.5, letterSpacing: 0 }}>{(brand && brand.name) || "网络状态中心"}</span>}
    </div>
  );
}
