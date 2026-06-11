/* ============================================================
   ONC — ECharts 时序图封装（ESM）
   注：迷你 sparkline（自绘 SVG）在 sparkline.jsx，与本文件分离，
   使公开主页打包体积不含 echarts。
   ============================================================ */
import { useEffect, useRef } from "react";
import * as echarts from "echarts";

/* —— 读取当前主题下的图表用色 —— */
export function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  return {
    green: cs.getPropertyValue("--green").trim() || "#18a058",
    red: cs.getPropertyValue("--red").trim() || "#d03050",
    amber: cs.getPropertyValue("--amber").trim() || "#f0a020",
    primary: cs.getPropertyValue("--primary").trim() || "#2f6fed",
    text2: cs.getPropertyValue("--text-2").trim() || "#6b7280",
    border: cs.getPropertyValue("--border").trim() || "#e8ebf0",
    bg: cs.getPropertyValue("--bg").trim() || "#fff",
    isDark,
  };
}
export function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// 统一数值格式化：固定 2 位小数（图表 tooltip 用，避免显示长浮点）
const fmt2 = (v) => (v == null || v === "" ? "-" : (+v).toFixed(2));

/* —— 通用 ECharts 容器：传入 option 构建器，处理 init/resize/主题重绘/销毁 —— */
export function EChart({ build, deps, height }) {
  const elRef = useRef();
  const chartRef = useRef();
  const render = () => {
    if (!echarts || !elRef.current) return;
    if (!chartRef.current) chartRef.current = echarts.init(elRef.current, null, { renderer: "canvas" });
    chartRef.current.setOption(build(chartColors(), reduceMotion()), true);
  };
  useEffect(() => {
    const raf = requestAnimationFrame(render);
    const onResize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener("resize", onResize);
    const obs = new MutationObserver(() => render());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); obs.disconnect(); };
  }, deps || []);
  useEffect(() => () => { chartRef.current && chartRef.current.dispose(); chartRef.current = null; }, []);
  return <div ref={elRef} style={{ width: "100%", height: height || 280 }} />;
}

/* —— ECharts 时序图（延迟线 + 丢包柱 + 抖动虚线，后台带 dataZoom） —— */
export function TimeChart({ data, range }) {
  const elRef = useRef();
  const chartRef = useRef();
  const themeRef = useRef();

  const getColors = chartColors;

  const build = () => {
    if (!echarts || !elRef.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(elRef.current, null, { renderer: "canvas" });
    }
    const c = getColors();
    const ts = data.map((d) => d.ts);
    const lat = data.map((d) => [d.ts, d.latency]);
    const loss = data.map((d) => [d.ts, d.loss]);
    const jit = data.map((d) => [d.ts, d.jitter]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    chartRef.current.setOption({
      animation: !reduce,
      animationDuration: 700,
      animationEasing: "cubicOut",
      grid: { left: 52, right: 52, top: 44, bottom: 64 },
      legend: {
        top: 8, right: 8, icon: "roundRect", itemWidth: 14, itemHeight: 8, itemGap: 16,
        textStyle: { color: c.text2, fontSize: 12 },
        data: ["延迟 (ms)", "丢包 (%)", "抖动 (ms)"],
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: c.bg,
        borderColor: c.border,
        borderWidth: 1,
        textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;",
        axisPointer: { type: "line", lineStyle: { color: c.border } },
        valueFormatter: fmt2,
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: c.border } },
        axisLabel: { color: c.text2, fontSize: 11, hideOverlap: true },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value", name: "ms", position: "left",
          nameTextStyle: { color: c.text2, fontSize: 11 },
          axisLabel: { color: c.text2, fontSize: 11 },
          splitLine: { lineStyle: { color: c.border, type: "dashed" } },
          axisLine: { show: false }, axisTick: { show: false },
        },
        {
          type: "value", name: "%", position: "right", min: 0, max: 20,
          nameTextStyle: { color: c.text2, fontSize: 11 },
          axisLabel: { color: c.text2, fontSize: 11 },
          splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
        },
      ],
      dataZoom: [
        { type: "inside", throttle: 50 },
        { type: "slider", height: 22, bottom: 14, borderColor: c.border, fillerColor: "rgba(47,111,237,0.10)",
          handleStyle: { color: c.bg, borderColor: "#2f6fed" }, textStyle: { color: c.text2, fontSize: 10 },
          dataBackground: { lineStyle: { color: c.border }, areaStyle: { color: c.border } },
          moveHandleStyle: { color: "#2f6fed" } },
      ],
      series: [
        {
          name: "丢包 (%)", type: "bar", yAxisIndex: 1, data: loss,
          itemStyle: { color: c.red, borderRadius: [2, 2, 0, 0] }, barMaxWidth: 6, z: 1,
        },
        {
          name: "抖动 (ms)", type: "line", yAxisIndex: 0, data: jit, smooth: true,
          showSymbol: false, lineStyle: { color: c.amber, width: 1.4, type: "dashed" }, z: 2,
        },
        {
          name: "延迟 (ms)", type: "line", yAxisIndex: 0, data: lat, smooth: true,
          showSymbol: false, lineStyle: { color: c.green, width: 2 }, z: 3,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(24,160,88,0.28)" },
              { offset: 1, color: "rgba(24,160,88,0.01)" },
            ]),
          },
        },
      ],
    }, true);
  };

  useEffect(() => {
    let raf = requestAnimationFrame(build);
    const onResize = () => chartRef.current && chartRef.current.resize();
    window.addEventListener("resize", onResize);
    // 主题切换重绘
    const obs = new MutationObserver(() => build());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    themeRef.current = obs;
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); obs.disconnect(); };
  }, [data]);

  useEffect(() => () => { chartRef.current && chartRef.current.dispose(); chartRef.current = null; }, []);

  return <div ref={elRef} style={{ width: "100%", height: 360 }} />;
}

/* —— 公开版：固定 30 分钟 延迟曲线（绿面积 + 可选丢包红 / 抖动琥珀虚线，无 dataZoom） —— */
export function ProbeMiniChart({ data, height }) {
  const hasLoss = data.some((d) => d.loss > 0);
  const build = (c, reduce) => ({
    animation: !reduce, animationDuration: 650, animationEasing: "cubicOut",
    grid: { left: 48, right: hasLoss ? 46 : 18, top: 30, bottom: 28 },
    legend: { top: 4, right: 6, icon: "roundRect", itemWidth: 13, itemHeight: 7, itemGap: 14, textStyle: { color: c.text2, fontSize: 11.5 } },
    tooltip: { trigger: "axis", backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;", axisPointer: { lineStyle: { color: c.border } }, valueFormatter: fmt2 },
    xAxis: { type: "time", axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.text2, fontSize: 11, hideOverlap: true }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: [
      { type: "value", name: "ms", nameTextStyle: { color: c.text2, fontSize: 11 }, axisLabel: { color: c.text2, fontSize: 11 }, splitLine: { lineStyle: { color: c.border, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
      { type: "value", name: "%", position: "right", min: 0, max: 20, show: hasLoss, nameTextStyle: { color: c.text2, fontSize: 11 }, axisLabel: { color: c.text2, fontSize: 11 }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
    ],
    series: [
      hasLoss && { name: "丢包 (%)", type: "bar", yAxisIndex: 1, data: data.map((d) => [d.ts, d.loss]), itemStyle: { color: c.red, borderRadius: [2, 2, 0, 0] }, barMaxWidth: 5, z: 1 },
      { name: "抖动 (ms)", type: "line", yAxisIndex: 0, data: data.map((d) => [d.ts, d.jitter]), smooth: true, showSymbol: false, lineStyle: { color: c.amber, width: 1.2, type: "dashed" }, z: 2 },
      {
        name: "延迟 (ms)", type: "line", yAxisIndex: 0, data: data.map((d) => [d.ts, d.latency]), smooth: true, showSymbol: false,
        lineStyle: { color: hasLoss ? c.red : c.green, width: 2 }, z: 3,
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hasLoss ? "rgba(208,48,80,0.26)" : "rgba(24,160,88,0.26)" }, { offset: 1, color: "rgba(0,0,0,0.01)" }]) },
      },
    ].filter(Boolean),
  });
  return <EChart build={build} deps={[data]} height={height || 300} />;
}

/* —— 公开版：节点资源使用率曲线（CPU/内存/磁盘 %，固定 30 分钟） —— */
export function ResourceChart({ data, height }) {
  const build = (c, reduce) => ({
    animation: !reduce, animationDuration: 650, animationEasing: "cubicOut",
    color: [c.primary, c.green, c.amber],
    grid: { left: 44, right: 18, top: 30, bottom: 28 },
    legend: { top: 4, right: 6, icon: "roundRect", itemWidth: 13, itemHeight: 7, itemGap: 14, textStyle: { color: c.text2, fontSize: 11.5 } },
    tooltip: { trigger: "axis", backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;", valueFormatter: (v) => fmt2(v) + " %" },
    xAxis: { type: "time", axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.text2, fontSize: 11, hideOverlap: true }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: { type: "value", name: "%", min: 0, max: 100, nameTextStyle: { color: c.text2, fontSize: 11 }, axisLabel: { color: c.text2, fontSize: 11 }, splitLine: { lineStyle: { color: c.border, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: "CPU", type: "line", data: data.map((d) => [d.ts, d.cpu]), smooth: true, showSymbol: false, lineStyle: { width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(47,111,237,0.20)" }, { offset: 1, color: "rgba(47,111,237,0.01)" }]) } },
      { name: "内存", type: "line", data: data.map((d) => [d.ts, d.mem]), smooth: true, showSymbol: false, lineStyle: { width: 2 } },
      { name: "磁盘", type: "line", data: data.map((d) => [d.ts, d.disk]), smooth: true, showSymbol: false, lineStyle: { width: 2 } },
    ],
  });
  return <EChart build={build} deps={[data]} height={height || 260} />;
}

/* —— 公开版：节点流量曲线（↓in 绿 / ↑out 蓝，固定 30 分钟） —— */
export function TrafficChart({ data, height }) {
  // 按峰值自适应单位：MB/s · KB/s · B/s（避免空闲机的 KB 级流量显示成 0）
  const peak = Math.max(0, ...data.map((d) => Math.max(d.netIn || 0, d.netOut || 0)));
  let unit = "MB/s", scale = 1;
  if (peak < 1 / 1024) { unit = "B/s"; scale = 1024 * 1024; }
  else if (peak < 1) { unit = "KB/s"; scale = 1024; }
  const sv = (v) => Math.round((v || 0) * scale * 100) / 100;
  const build = (c, reduce) => ({
    animation: !reduce, animationDuration: 650, animationEasing: "cubicOut",
    color: [c.green, c.primary],
    grid: { left: 52, right: 18, top: 30, bottom: 28 },
    legend: { top: 4, right: 6, icon: "roundRect", itemWidth: 13, itemHeight: 7, itemGap: 14, textStyle: { color: c.text2, fontSize: 11.5 } },
    tooltip: { trigger: "axis", backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;", valueFormatter: (v) => fmt2(v) + " " + unit },
    xAxis: { type: "time", axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.text2, fontSize: 11, hideOverlap: true }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: { type: "value", name: unit, nameTextStyle: { color: c.text2, fontSize: 11 }, axisLabel: { color: c.text2, fontSize: 11 }, splitLine: { lineStyle: { color: c.border, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: "↓ 下行", type: "line", data: data.map((d) => [d.ts, sv(d.netIn)]), smooth: true, showSymbol: false, lineStyle: { width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(24,160,88,0.22)" }, { offset: 1, color: "rgba(24,160,88,0.01)" }]) } },
      { name: "↑ 上行", type: "line", data: data.map((d) => [d.ts, sv(d.netOut)]), smooth: true, showSymbol: false, lineStyle: { width: 2 } },
    ],
  });
  return <EChart build={build} deps={[data]} height={height || 220} />;
}
