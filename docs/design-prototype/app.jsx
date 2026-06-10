/* ============================================================
   TermRat — 路由 + 应用根
   ============================================================ */

function Router() {
  const { route, auth, isAdmin, navigate } = useApp();
  const parts = route.parts; // e.g. ['termadmin','dashboard','t-1']

  // 公开主页
  if (parts.length === 0) return <PublicHome />;

  // 公开 — 节点详情 / 线路详情（免登录）
  if (parts[0] === "node" && parts[1]) return <NodeDetail id={parts[1]} />;
  if (parts[0] === "probe" && parts[1]) return <ProbeDetail id={parts[1]} />;

  // 管理端
  if (parts[0] === "termadmin") {
    // 登录页
    if (parts.length === 1) return <Login />;
    // 未登录 → 跳登录
    if (!auth) { return <Login />; }

    const sub = parts[1];
    let page = null;
    let needAdmin = false;

    if (sub === "dashboard") {
      if (parts[2]) page = <TaskDetail taskId={parts[2]} />;
      else page = <Dashboard />;
    } else if (sub === "nodes") { needAdmin = true; page = <NodesPage />; }
    else if (sub === "tasks") { needAdmin = true; page = <TasksPage />; }
    else if (sub === "alerts") {
      if (parts[2] === "history") page = <HistoryPage />;
      else { needAdmin = true; page = <AlertsPage />; }
    }
    else if (sub === "users") { needAdmin = true; page = <UsersPage />; }
    else if (sub === "settings") { needAdmin = true; page = <SettingsPage />; }
    else page = <Dashboard />;

    // 只读用户访问 admin 页 → 拦截
    if (needAdmin && !isAdmin) page = <NoAccess />;

    return <AdminShell>{page}</AdminShell>;
  }

  // 兜底
  return <NotFound />;
}

function NoAccess() {
  const { navigate } = useApp();
  return (
    <div className="card card-pad fade-up" style={{ textAlign: "center", padding: "56px 20px" }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><Ic name="key" size={24} style={{ color: "var(--text-3)" }} /></div>
      <h2 className="h2">无访问权限</h2>
      <p className="muted" style={{ marginTop: 6 }}>当前为只读角色，该页面仅管理员可访问。</p>
      <button className="btn primary" style={{ marginTop: 18 }} onClick={() => navigate("/termadmin/dashboard")}>返回仪表盘</button>
    </div>
  );
}

function NotFound() {
  const { navigate } = useApp();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, background: "var(--panel)" }}>
      <div className="num" style={{ fontSize: 56, fontWeight: 700, color: "var(--text-3)" }}>404</div>
      <p className="muted">页面不存在</p>
      <button className="btn primary" onClick={() => navigate("/")}>返回主页</button>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
