/* ============================================================
   TermRat — 应用状态：路由 / 主题 / 鉴权 / 角色 / 刷新计时（ESM）
   ============================================================ */
import React, { useState, useEffect, createContext, useContext } from "react";
import { Ic } from "./ui.jsx";
import { apiLogin, apiLogout, apiMe, apiSetup, getToken, setToken } from "./api.js";

const AppCtx = createContext(null);
export function useApp() { return useContext(AppCtx); }

export function parseHash() {
  let h = window.location.hash.replace(/^#/, "");
  if (!h) h = "/";
  const [path, query] = h.split("?");
  const parts = path.split("/").filter(Boolean); // e.g. ['termadmin','dashboard','t-1']
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
  const [theme, setTheme] = useState(() => localStorage.getItem("termrat-theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("termrat-theme", theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  // —— 鉴权 + 角色（真实后端会话 token）—— //
  // auth: { username, role } | null。本地缓存仅为首屏即时渲染，token 才是凭据。
  const [auth, setAuth] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem("termrat-auth") || "null");
      // 缓存了用户但 token 已丢失（如手动清理）→ 视为未登录
      return a && getToken() ? a : null;
    } catch (e) { return null; }
  });
  const persistAuth = (a) => {
    if (a) localStorage.setItem("termrat-auth", JSON.stringify(a));
    else localStorage.removeItem("termrat-auth");
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
    navigate("/termadmin");
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

  const ctx = {
    route, navigate, theme, toggleTheme,
    auth, login, setup, logout, isAdmin,
    tick, secondsAgo, clock,
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
  const { theme, toggleTheme } = useApp();
  return (
    <button className="btn-icon" onClick={toggleTheme} aria-label="切换主题" title={theme === "light" ? "切换深色" : "切换浅色"}>
      <Ic name={theme === "light" ? "moon" : "sun"} />
    </button>
  );
}

/* —— 品牌标志（小方块 + TR 字母标 + 文字） —— */
export function Brand({ compact, white }) {
  return (
    <div className="row gap-8" style={{ alignItems: "center" }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: white ? "rgba(255,255,255,0.15)" : "var(--primary)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flex: "none",
        boxShadow: white ? "none" : "0 2px 6px rgba(47,111,237,0.35)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.04em" }}>TR</span>
      </div>
      {!compact && <span style={{ fontWeight: 660, fontSize: 15.5, letterSpacing: "-0.01em" }}>TermRat <span style={{ color: "var(--text-3)", fontWeight: 500 }}>网络状态中心</span></span>}
    </div>
  );
}
