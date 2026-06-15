/* ============================================================
   ONC — 管理端外壳：折叠侧栏 + 顶栏 + 底栏 + 内容槽
   ============================================================ */
import React, { useState, useEffect } from "react";
import { useApp, ThemeToggle, BrandMark } from "../../store.jsx";
import { Ic, useClickOutside } from "../../ui.jsx";
import { apiVersion } from "../../api.js";

/* ---------------- 菜单定义 ---------------- */
export const MENU = [
  { key: "dashboard", path: "/termadmin/dashboard", label: "仪表盘", icon: "dashboard", admin: false },
  { key: "nodes", path: "/termadmin/nodes", label: "节点管理", icon: "nodes", admin: true },
  { key: "tasks", path: "/termadmin/tasks", label: "任务管理", icon: "tasks", admin: true },
  { key: "alerts", path: "/termadmin/alerts", label: "告警通道", icon: "alert", admin: true },
  { key: "history", path: "/termadmin/alerts/history", label: "告警历史", icon: "history", admin: false },
  { key: "users", path: "/termadmin/users", label: "用户管理", icon: "users", admin: true },
  { key: "settings", path: "/termadmin/settings", label: "系统设置", icon: "settings", admin: true },
];

export function activeKeyFromPath(p) {
  if (p.startsWith("/termadmin/alerts/history")) return "history";
  const m = MENU.slice().reverse().find((x) => p.startsWith(x.path));
  return m ? m.key : "dashboard";
}

/* 版本标：运行版本 + 与 GitHub 最新对比（最新=绿/有新版=橙） */
function VersionBadge() {
  const [v, setV] = useState(null);
  useEffect(() => {
    let alive = true;
    apiVersion().then((d) => { if (alive) setV(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!v || !v.running) return null;
  const behind = v.latest && v.latest !== v.running;
  return (
    <span style={{ fontSize: 11, marginTop: 1, whiteSpace: "nowrap" }}
      title={behind ? `有新版本 v${v.latest}，在中心服务器执行 update.sh 即可更新` : (v.latest ? "已是最新版本" : "")}>
      <span className="mono" style={{ color: "var(--text-3)" }}>v{v.running}</span>
      {v.latest && (behind
        ? <span style={{ color: "#e0901b", fontWeight: 600 }}> · 有新版 v{v.latest}</span>
        : <span style={{ color: "var(--green)" }}> · 最新</span>)}
    </span>
  );
}

export function AdminShell({ children }) {
  const { auth, logout, route, navigate, isAdmin, clock, secondsAgo, brand } = useApp();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("onc-collapse") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const userRef = useClickOutside(() => setUserMenu(false));

  useEffect(() => { localStorage.setItem("onc-collapse", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => { if (!auth) navigate("/termadmin"); }, [auth]);
  if (!auth) return null;

  const activeKey = activeKeyFromPath(route.path);
  const visibleMenu = MENU.filter((m) => !m.admin || isAdmin);
  const w = collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)";

  const Sidebar = (
    <aside style={{
      width: w, flex: "none", background: "var(--bg)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", transition: "width var(--dur) var(--ease)",
      position: "sticky", top: 0, height: "100vh", zIndex: 20,
    }}>
      <div className="row between" style={{ height: 56, padding: collapsed ? "0" : "0 16px", justifyContent: collapsed ? "center" : "space-between", borderBottom: "1px solid var(--border)" }}>
        {collapsed
          ? <BrandMark size={30} />
          : <div className="row gap-8" style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
              <BrandMark size={30} />
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, overflow: "hidden" }}>
                <span style={{ fontWeight: 660, fontSize: 14.5 }}>{brand.name}</span>
                <VersionBadge />
              </div>
            </div>}
      </div>

      <nav style={{ padding: "10px 10px", flex: 1, overflowY: "auto" }}>
        {visibleMenu.map((m) => {
          const active = activeKey === m.key;
          return (
            <button key={m.key} onClick={() => { navigate(m.path); setMobileOpen(false); }}
              title={collapsed ? m.label : ""}
              style={{
                display: "flex", alignItems: "center", gap: 11, width: "100%",
                padding: collapsed ? "10px 0" : "10px 12px", justifyContent: collapsed ? "center" : "flex-start",
                marginBottom: 3, border: "none", borderRadius: 8, cursor: "pointer",
                background: active ? "var(--primary-soft)" : "transparent",
                color: active ? "var(--primary)" : "var(--text-2)",
                fontWeight: active ? 600 : 500, fontSize: 13.5, fontFamily: "var(--font)",
                transition: "background var(--dur) var(--ease), color var(--dur) var(--ease)",
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--panel)"; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}>
              <Ic name={m.icon} size={18} />
              {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{m.label}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 10, borderTop: "1px solid var(--border)" }}>
        <button className="btn ghost block sm" onClick={() => setCollapsed((c) => !c)} style={{ justifyContent: collapsed ? "center" : "flex-start", color: "var(--text-2)" }}>
          <Ic name={collapsed ? "chevRight" : "chevLeft"} size={16} />{!collapsed && "收起侧栏"}
        </button>
      </div>
    </aside>
  );

  const uname = auth.username || "用户";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--panel)" }}>
      {/* 桌面侧栏 */}
      <div className="desktop-only" style={{ display: "flex" }}>{Sidebar}</div>
      {/* 移动侧栏 */}
      {mobileOpen && <React.Fragment>
        <div className="overlay mobile-only" onClick={() => setMobileOpen(false)} />
        <div className="mobile-only" style={{ position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 101 }}>{Sidebar}</div>
      </React.Fragment>}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* 顶栏 */}
        <header style={{
          height: 56, flex: "none", background: "var(--bg)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px",
          position: "sticky", top: 0, zIndex: 18,
        }}>
          <div className="row gap-8">
            <button className="btn-icon mobile-only" onClick={() => setMobileOpen(true)}><Ic name="menu" /></button>
            <Breadcrumb activeKey={activeKey} />
          </div>
          <div className="row gap-6">
            <button className="btn ghost sm" onClick={() => navigate("/")} title="查看公开主页"><Ic name="globe" size={15} /><span className="desktop-only">公开主页</span></button>
            <ThemeToggle />
            <div className="vr" style={{ height: 24 }} />
            <div style={{ position: "relative" }} ref={userRef}>
              <button className="btn ghost sm" onClick={() => setUserMenu((v) => !v)} style={{ gap: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>{uname.slice(0, 1).toUpperCase()}</span>
                <span className="desktop-only">{uname} <span className="faint">({isAdmin ? "管理员" : "只读"})</span></span>
                <Ic name="chevDown" size={14} />
              </button>
              {userMenu && (
                <div className="menu" style={{ right: 0, top: 42, minWidth: 200 }}>
                  <div style={{ padding: "6px 10px 8px" }}>
                    <div style={{ fontWeight: 600 }}>{uname}</div>
                    <div className="faint" style={{ fontSize: 12 }}>{isAdmin ? "管理员 · 全部权限" : "只读 · 仅查看"}</div>
                  </div>
                  <div className="divider" style={{ margin: "4px 0" }} />
                  <div className="menu-item danger" onClick={logout}><Ic name="logout" size={15} />退出登录</div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* 内容 */}
        <main style={{ flex: 1, padding: "22px 24px", minWidth: 0 }}>
          {!isAdmin && <ReadonlyNote activeKey={activeKey} />}
          {children}
        </main>

        {/* 底栏 */}
        <footer style={{ height: 36, flex: "none", borderTop: "1px solid var(--border)", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 11.5, color: "var(--text-3)", padding: "0 16px", textAlign: "center" }}>
          <span className="row gap-6" style={{ flexWrap: "wrap", justifyContent: "center" }}>
            <span><b style={{ color: "var(--text-2)" }}>{brand.name}</b></span>
            <span className="faint">·</span>
            <span>现在时间（GMT+8）：<span className="num">{clock}</span></span>
            <span className="faint">·</span>
            <span className="row gap-4"><span className="dot green" style={{ width: 5, height: 5 }} />最后更新：{secondsAgo < 10 ? secondsAgo + " 秒内" : secondsAgo + " 秒前"}</span>
          </span>
        </footer>
      </div>
    </div>
  );
}

function Breadcrumb({ activeKey }) {
  const m = MENU.find((x) => x.key === activeKey);
  return (
    <div className="row gap-6" style={{ fontSize: 14, fontWeight: 600 }}>
      <Ic name={m ? m.icon : "dashboard"} size={17} style={{ color: "var(--text-2)" }} />
      <span>{m ? m.label : "仪表盘"}</span>
    </div>
  );
}

function ReadonlyNote({ activeKey }) {
  if (!["dashboard", "history"].includes(activeKey)) return null;
  return (
    <div className="card card-pad fade-up" style={{ background: "var(--panel-2)", borderStyle: "dashed", marginBottom: 16, display: "flex", gap: 10, alignItems: "center", padding: "12px 16px" }}>
      <Ic name="eye" size={16} style={{ color: "var(--text-2)" }} />
      <span className="muted" style={{ fontSize: 13 }}>当前为 <b>只读角色</b>：仅可查看「仪表盘」与「告警历史」，其余菜单与所有写操作已隐藏。</span>
    </div>
  );
}
