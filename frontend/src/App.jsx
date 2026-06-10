/* ============================================================
   ONC — 应用根 + 路由（v0.1：公开主页可用，其余路由占位）
   ============================================================ */
import React from "react";
import { AppProvider, useApp } from "./store.jsx";
import { ToastProvider, Ic } from "./ui.jsx";
import { PublicHome } from "./pages/PublicHome.jsx";

/* 后续增量（v0.2/v0.3）落地的占位页 */
function Placeholder({ title, hint }) {
  const { navigate } = useApp();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, background: "var(--panel)", padding: 24 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Ic name="activity" size={24} style={{ color: "var(--primary)" }} />
      </div>
      <h2 className="h2">{title}</h2>
      <p className="muted" style={{ textAlign: "center", maxWidth: 360 }}>{hint || "该页面将在后续版本增量实现。"}</p>
      <button className="btn primary" onClick={() => navigate("/")}>返回公开主页</button>
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

function Router() {
  const { route } = useApp();
  const parts = route.parts;

  if (parts.length === 0) return <PublicHome />;
  if (parts[0] === "node" && parts[1]) return <Placeholder title="节点详情" hint="点击节点查看 30 分钟资源/延迟历史曲线 —— v0.2 落地。" />;
  if (parts[0] === "probe" && parts[1]) return <Placeholder title="线路详情" hint="点击线路查看 30 分钟延迟/丢包历史曲线 —— v0.2 落地。" />;
  if (parts[0] === "admin") return <Placeholder title="管理端" hint="登录 + 仪表盘 + 节点/任务/告警/用户/设置 —— v0.3 起逐步落地。" />;
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
