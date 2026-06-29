/* ============================================================
   ONC — 应用根 + 路由（公开页 + 管理端，管理路径可在安装向导自定义）
   ============================================================ */
import React, { useState, useEffect } from "react";
import { AppProvider, useApp } from "./store.jsx";
import { ToastProvider, Ic } from "./ui.jsx";
import { apiSetupStatus } from "./api.js";
import { PublicHome } from "./pages/PublicHome.jsx";
import { NodeDetail } from "./pages/NodeDetail.jsx";
import { ProbeDetail } from "./pages/ProbeDetail.jsx";
import { Login } from "./pages/admin/Login.jsx";
import { Setup } from "./pages/admin/Setup.jsx";
import { AdminShell } from "./pages/admin/AdminShell.jsx";
import { Dashboard } from "./pages/admin/Dashboard.jsx";
import { TaskDetail } from "./pages/admin/TaskDetail.jsx";
import { NodesPage } from "./pages/admin/NodesPage.jsx";
import { TasksPage } from "./pages/admin/TasksPage.jsx";
import { AlertsPage } from "./pages/admin/AlertsPage.jsx";
import { HistoryPage } from "./pages/admin/HistoryPage.jsx";
import { UsersPage } from "./pages/admin/UsersPage.jsx";
import { SettingsPage } from "./pages/admin/SettingsPage.jsx";

function NotFound() {
  const { navigate, t } = useApp();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, background: "var(--panel)" }}>
      <div className="num" style={{ fontSize: 56, fontWeight: 700, color: "var(--text-3)" }}>404</div>
      <p className="muted">{t("notFound.message")}</p>
      <button className="btn primary" onClick={() => navigate("/")}>{t("node.backHome")}</button>
    </div>
  );
}

function NoAccess() {
  const { navigate, adminPath } = useApp();
  return (
    <div className="card card-pad fade-up" style={{ textAlign: "center", padding: "56px 20px" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Ic name="key" size={24} style={{ color: "var(--text-3)" }} /></div>
      <h2 className="h2">无访问权限</h2>
      <p className="muted" style={{ marginTop: 6 }}>当前为只读角色，该页面仅管理员可访问。</p>
      <button className="btn primary" style={{ marginTop: 18 }} onClick={() => navigate(`/${adminPath}/dashboard`)}>返回仪表盘</button>
    </div>
  );
}

// 未登录入口：先看是否需要初次安装（库内无用户）→ 安装向导 / 否则登录页
function AdminEntry() {
  const [state, setState] = useState("loading"); // loading | setup | login
  useEffect(() => {
    let alive = true;
    apiSetupStatus()
      .then((d) => { if (alive) setState(d && d.needs_setup ? "setup" : "login"); })
      .catch(() => { if (alive) setState("login"); });
    return () => { alive = false; };
  }, []);
  if (state === "setup") return <Setup />;
  if (state === "login") return <Login />;
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--panel)" }}>
      <Ic name="refresh" size={22} className="spin" style={{ color: "var(--text-3)" }} />
    </div>
  );
}

function AdminRouter({ parts }) {
  const { auth, isAdmin } = useApp();
  // 管理端根路径（未带子路由）或未登录 → 安装向导 / 登录
  if (parts.length === 1 || !auth) return <AdminEntry />;

  const sub = parts[1];
  let page = null;
  let needAdmin = false;

  if (sub === "dashboard") {
    page = parts[2] ? <TaskDetail taskId={parts[2]} /> : <Dashboard />;
  } else if (sub === "nodes") { needAdmin = true; page = <NodesPage />; }
  else if (sub === "tasks") { needAdmin = true; page = <TasksPage />; }
  else if (sub === "alerts") {
    if (parts[2] === "history") page = <HistoryPage />;
    else { needAdmin = true; page = <AlertsPage />; }
  }
  else if (sub === "users") { needAdmin = true; page = <UsersPage />; }
  else if (sub === "settings") { needAdmin = true; page = <SettingsPage />; }
  else page = <Dashboard />;

  if (needAdmin && !isAdmin) page = <NoAccess />;

  return <AdminShell>{page}</AdminShell>;
}

function Router() {
  const { route, adminPath } = useApp();
  const parts = route.parts;

  if (parts.length === 0) return <PublicHome />;
  if (parts[0] === "node" && parts[1]) return <NodeDetail id={parts[1]} />;
  if (parts[0] === "probe" && parts[1]) return <ProbeDetail id={parts[1]} />;
  if (parts[0] === adminPath) return <AdminRouter parts={parts} />;
  return <NotFound />;
}

export function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AppProvider>
  );
}
