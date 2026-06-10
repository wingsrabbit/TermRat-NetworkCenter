/* ============================================================
   ONC — 应用状态：路由 / 主题 / 鉴权 / 角色 / 实时刷新
   ============================================================ */

const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

function parseHash() {
  let h = window.location.hash.replace(/^#/, "");
  if (!h) h = "/";
  const [path, query] = h.split("?");
  const parts = path.split("/").filter(Boolean); // e.g. ['admin','dashboard','t-1']
  return { path, parts, query: query || "" };
}

function navigate(to) {
  if (window.location.hash.replace(/^#/, "") === to) return;
  window.location.hash = to;
}

function AppProvider({ children }) {
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

  // —— 鉴权 + 角色 —— //
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem("onc-auth") || "null"); } catch (e) { return null; }
  });
  const login = (user) => {
    const a = { name: user.name, role: user.role };
    setAuth(a); localStorage.setItem("onc-auth", JSON.stringify(a));
  };
  const logout = () => { setAuth(null); localStorage.removeItem("onc-auth"); navigate("/admin"); };
  const setRole = (role) => {
    setAuth((a) => { const n = { ...(a || {}), role }; localStorage.setItem("onc-auth", JSON.stringify(n)); return n; });
  };
  const isAdmin = auth && auth.role === "admin";

  // —— 实时刷新 tick（最后更新计时 + 数据轻微抖动） —— //
  const [tick, setTick] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 每秒更新"最后更新 Xs 前"
    const secTimer = setInterval(() => {
      setSecondsAgo(Math.round((Date.now() - lastUpdate) / 1000));
    }, 1000);
    return () => clearInterval(secTimer);
  }, [lastUpdate]);
  useEffect(() => {
    // 每 10s 触发一次"刷新"
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

  const api = {
    route, navigate, theme, toggleTheme,
    auth, login, logout, setRole, isAdmin,
    tick, secondsAgo, clock,
  };
  return <AppCtx.Provider value={api}>{children}</AppCtx.Provider>;
}

function fmtClock() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).slice(2)}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* —— 主题切换按钮（公用） —— */
function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return (
    <button className="btn-icon" onClick={toggleTheme} aria-label="切换主题" title={theme === "light" ? "切换深色" : "切换浅色"}>
      <Ic name={theme === "light" ? "moon" : "sun"} />
    </button>
  );
}

/* —— 品牌标志（小方块 + 兔子图标 + 文字） —— */
function Brand({ compact, white }) {
  return (
    <div className="row gap-8" style={{ alignItems: "center" }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: white ? "rgba(255,255,255,0.15)" : "var(--primary)",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flex: "none",
        boxShadow: white ? "none" : "0 2px 6px rgba(47,111,237,0.35)",
      }}>
        <Ic name="rabbit" size={18} sw={1.7} />
      </div>
      {!compact && <span style={{ fontWeight: 660, fontSize: 15.5, letterSpacing: "-0.01em" }}>ONC <span style={{ color: "var(--text-3)", fontWeight: 500 }}>网络状态中心</span></span>}
    </div>
  );
}

Object.assign(window, { AppCtx, useApp, AppProvider, navigate, parseHash, ThemeToggle, Brand, fmtClock });
