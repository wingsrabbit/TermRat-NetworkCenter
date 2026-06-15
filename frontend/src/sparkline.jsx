/* ============================================================
   ONC — 迷你 sparkline（自绘 SVG，渐进绘制，无第三方依赖）
   注：ECharts 时序大图在 charts.jsx（后续增量引入），与本文件分离，
   使公开主页打包体积不含 echarts。
   ============================================================ */
import { useState, useEffect, useRef } from "react";

export function Sparkline({ data, tone, width = 88, height = 26 }) {
  const ref = useRef();
  const [len, setLen] = useState(0);

  const hasData = data && data.length >= 2;
  const min = hasData ? Math.min(...data) : 0;
  const max = hasData ? Math.max(...data) : 1;
  const span = max - min || 1;
  const stepX = hasData ? width / (data.length - 1) : 0;
  const pts = hasData
    ? data.map((v, i) => [i * stepX, height - 2 - ((v - min) / span) * (height - 4)])
    : [];
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = hasData ? line + ` L ${width} ${height} L 0 ${height} Z` : "";
  const stroke = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : "var(--green)";
  const fill = tone === "red" ? "rgba(208,48,80,0.12)" : tone === "amber" ? "rgba(240,160,32,0.12)" : "rgba(24,160,88,0.12)";

  useEffect(() => {
    if (ref.current) setLen(ref.current.getTotalLength());
  }, [data]);

  if (!hasData) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <path d={area} fill={fill} stroke="none" />
      <path ref={ref} d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        style={reduce || !len ? {} : { strokeDasharray: len, strokeDashoffset: len, animation: "draw 900ms var(--ease) forwards" }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill={stroke} />
    </svg>
  );
}

/* 注入一次绘制动画关键帧 */
if (typeof document !== "undefined" && !document.getElementById("__spark_kf")) {
  const s = document.createElement("style");
  s.id = "__spark_kf";
  s.textContent = "@keyframes draw { to { stroke-dashoffset: 0; } }";
  document.head.appendChild(s);
}
