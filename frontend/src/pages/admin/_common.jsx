/* ============================================================
   ONC — 管理端页面公用小组件（页头 / 行操作按钮 / 部署片段）
   ============================================================ */
import React from "react";
import { Ic } from "../../ui.jsx";

/* —— 页头 —— */
export function PageHeader({ title, desc, action }) {
  return (
    <div className="row between wrap gap-12" style={{ marginBottom: 18 }}>
      <div>
        <h2 className="h1" style={{ fontSize: 19 }}>{title}</h2>
        {desc && <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>{desc}</div>}
      </div>
      {action}
    </div>
  );
}

/* —— 行操作按钮 —— */
export function RowBtn({ icon, label, tone, onClick, disabled }) {
  return (
    <button className="btn xs ghost" onClick={onClick} title={label} disabled={disabled}
      style={{ color: tone === "danger" ? "var(--red)" : "var(--text-2)" }}>
      <Ic name={icon} size={14} /><span className="desktop-only">{label}</span>
    </button>
  );
}

/* —— 一键安装命令（curl|bash：自动装 Docker / 拉源码 / 构建 / 运行）。
   NC_SERVER 用中心的 agent 上报口 :8080（与 web 端口解耦），主机名取当前访问地址。 —— */
export function deploySnippet(token) {
  const host = (typeof window !== "undefined" && window.location.hostname) || "<中心IP或域名>";
  const server = `http://${host}:8080`;
  return `curl -fsSL https://raw.githubusercontent.com/wingsrabbit/ONC/main/deploy/install-agent.sh \\
  | sudo bash -s -- -s ${server} -t ${token}`;
}
