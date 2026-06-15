/* ============================================================
   TermRat — 共享 UI 原语 + 图标（ESM）
   ============================================================ */
import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { DB, fmtLatency } from "./data.js";

/* ---------------- 图标（线性，24 viewBox 统一 stroke） ---------------- */
export function Icon({ d, paths, size, fill, sw, children, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size || 18} height={size || 18}
      fill={fill || "none"} stroke={fill ? "none" : "currentColor"}
      strokeWidth={sw || 1.8} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d && <path d={d} />}
      {paths && paths.map((p, i) => <path key={i} d={p} />)}
      {children}
    </svg>
  );
}
const ICONS = {
  dashboard: ["M3 13h8V3H3zM13 21h8v-8h-8zM3 21h8v-6H3zM13 11h8V3h-8z"],
  nodes: ["M5 7h14M5 7a2 2 0 100-4 2 2 0 000 4zM5 7v10M5 17a2 2 0 100 4 2 2 0 000-4z", "M19 5v14M19 5a2 2 0 100-4 2 2 0 000 4zM19 19a2 2 0 100 4 2 2 0 000-4z"],
  tasks: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"],
  alert: ["M10.3 3.6L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.6a2 2 0 00-3.4 0z", "M12 9v4M12 17h.01"],
  history: ["M3 3v5h5", "M3.05 13A9 9 0 106 5.3L3 8", "M12 7v5l4 2"],
  users: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M9 11a4 4 0 100-8 4 4 0 000 8z", "M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"],
  settings: ["M12 15a3 3 0 100-6 3 3 0 000 6z", "M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"],
  search: ["M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"],
  chevDown: ["M6 9l6 6 6-6"],
  chevRight: ["M9 18l6-6-6-6"],
  chevLeft: ["M15 18l-6-6 6-6"],
  sun: ["M12 17a5 5 0 100-10 5 5 0 000 10z", "M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"],
  moon: ["M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z"],
  logout: ["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4", "M16 17l5-5-5-5M21 12H9"],
  plus: ["M12 5v14M5 12h14"],
  edit: ["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7", "M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"],
  trash: ["M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"],
  deploy: ["M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z", "M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"],
  power: ["M18.36 6.64a9 9 0 11-12.73 0", "M12 2v10"],
  key: ["M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"],
  copy: ["M9 9h10a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2z", "M5 15H4a2 2 0 01-2-2V3a2 2 0 012-2h10a2 2 0 012 2v1"],
  check: ["M20 6L9 17l-5-5"],
  checkCircle: ["M22 11.08V12a10 10 0 11-5.93-9.14", "M22 4L12 14.01l-3-3"],
  x: ["M18 6L6 18M6 6l12 12"],
  warnTri: ["M10.3 3.6L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.6a2 2 0 00-3.4 0z", "M12 9v4M12 17h.01"],
  inbox: ["M22 12h-6l-2 3h-4l-2-3H2", "M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"],
  arrowDown: ["M12 5v14M19 12l-7 7-7-7"],
  arrowUp: ["M12 19V5M5 12l7-7 7 7"],
  arrowRight: ["M5 12h14M12 5l7 7-7 7"],
  clock: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M12 6v6l4 2"],
  cpu: ["M4 4h16v16H4z", "M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"],
  globe: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M2 12h20", "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  signal: ["M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 20V4"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 15a3 3 0 100-6 3 3 0 000 6z"],
  eyeOff: ["M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24", "M1 1l22 22"],
  bell: ["M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 01-3.46 0"],
  send: ["M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"],
  refresh: ["M23 4v6h-6M1 20v-6h6", "M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"],
  menu: ["M3 12h18M3 6h18M3 18h18"],
};
export function Ic({ name, size, ...rest }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return <Icon paths={paths} size={size} {...rest} />;
}

/* ---------------- 基础组件 ---------------- */
export function Tag({ tone, dot, children, className }) {
  return <span className={"tag " + (tone || "") + (dot ? " t-dot" : "") + (className ? " " + className : "")}>{children}</span>;
}

export function StatusDot({ status, pulse }) {
  const tone = status === "online" ? "green" : status === "offline" ? "red" : status;
  return <span className={"dot " + tone + (pulse ? " pulse" : "")} />;
}

export function Bar({ value, label, level }) {
  const lv = level || DB.usageLevel(value);
  return (
    <div className="metric-line">
      <span className="label">{label}</span>
      <span className="bar"><span className={lv} style={{ width: Math.min(100, value) + "%" }} /></span>
      <span className="val num">{value}%</span>
    </div>
  );
}

/* —— count-up 数字 —— */
export function CountUp({ value, decimals = 0, duration = 900, suffix = "", className }) {
  const [v, setV] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setV(value); return; }
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (value - from) * e);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return <span className={"num " + (className || "")}>{v.toFixed(decimals)}{suffix}</span>;
}

/* —— KPI 卡 —— */
export function StatCard({ label, icon, value, decimals, suffix, tone, sub, delay }) {
  return (
    <div className="card card-pad fade-up" style={{ animationDelay: (delay || 0) + "ms" }}>
      <div className="stat-label">{icon && <Ic name={icon} size={15} />}{label}</div>
      <div className="stat-val" style={{ color: tone, marginTop: 8 }}>
        <CountUp value={value} decimals={decimals || 0} suffix={suffix || ""} />
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* —— 复选框 —— */
export function Checkbox({ checked, onChange, children }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange && onChange(e.target.checked)} />
      <span className="box"><Ic name="check" size={11} /></span>
      {children}
    </label>
  );
}

/* —— 开关 —— */
export function Switch({ on, onChange, sm }) {
  return <span className={"switch" + (sm ? " sm" : "") + (on ? " on" : "")} onClick={() => onChange && onChange(!on)} role="switch" aria-checked={on} />;
}

/* —— 模态 —— */
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <React.Fragment>
      <div className="overlay" onClick={onClose} />
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 className="h2">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="关闭"><Ic name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </React.Fragment>
  );
}

/* —— 抽屉 —— */
export function Drawer({ title, onClose, children }) {
  return (
    <React.Fragment>
      <div className="overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-head">
          <h3 className="h2">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="关闭"><Ic name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </React.Fragment>
  );
}

/* —— 确认弹窗 —— */
export function Confirm({ title, message, danger, confirmText, onConfirm, onClose }) {
  return (
    <Modal title={title || "确认操作"} onClose={onClose}
      footer={<React.Fragment>
        <button className="btn" onClick={onClose}>取消</button>
        <button className={"btn " + (danger ? "danger" : "primary")} onClick={() => { onConfirm(); onClose(); }}>{confirmText || "确认"}</button>
      </React.Fragment>}>
      <p style={{ margin: 0, color: "var(--text-2)" }}>{message}</p>
    </Modal>
  );
}

/* —— Toast 系统 —— */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((type, msg) => {
    const id = Math.random().toString(36).slice(2);
    setList((l) => [...l, { id, type, msg }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2600);
  }, []);
  const api = {
    success: (m) => push("success", m), error: (m) => push("error", m), info: (m) => push("info", m),
  };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap">
        {list.map((t) => (
          <div key={t.id} className={"toast " + t.type}>
            <Ic name={t.type === "success" ? "checkCircle" : t.type === "error" ? "warnTri" : "bell"} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() { return useContext(ToastCtx) || { success() {}, error() {}, info() {} }; }

/* —— 代码块（带复制） —— */
export function CodeBlock({ children }) {
  const toast = useToast();
  const copy = () => {
    navigator.clipboard && navigator.clipboard.writeText(children);
    toast.success("已复制到剪贴板");
  };
  return (
    <div className="code">
      <button className="btn xs copy" onClick={copy}><Ic name="copy" size={12} />复制</button>
      {children}
    </div>
  );
}

/* —— 空态 —— */
export function Empty({ text }) {
  return <div className="empty"><Ic name="inbox" /><div>{text || "暂无数据"}</div></div>;
}

/* —— 下拉菜单（点击外部关闭） —— */
export function useClickOutside(onOut) {
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOut]);
  return ref;
}

/* —— 延迟值（按阈值配色） —— */
export function Latency({ ms, big }) {
  if (ms == null) return <span className="muted">—</span>;
  const lv = DB.latencyLevel(ms);
  const color = lv === "green" ? "var(--green)" : lv === "amber" ? "var(--amber)" : lv === "red" ? "var(--red)" : "var(--text-2)";
  return <span className="num" style={{ color, fontWeight: 600, fontSize: big ? 18 : "inherit" }}>{fmtLatency(ms)}<span style={{ fontSize: "0.75em", fontWeight: 400 }}> ms</span></span>;
}
