/* ============================================================
   ONC — 图表
   Sparkline（自绘 SVG，渐进绘制）+ ECharts 时序图封装
   ============================================================ */

/* —— 迷你延迟 sparkline —— */
function Sparkline({ data, tone, width = 88, height = 26 }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true"><line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="3 3" /></svg>;
  }
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, height - 2 - ((v - min) / span) * (height - 4)]);
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${width} ${height} L 0 ${height} Z`;
  const stroke = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : "var(--green)";
  const fill = tone === "red" ? "rgba(208,48,80,0.12)" : tone === "amber" ? "rgba(240,160,32,0.12)" : "rgba(24,160,88,0.12)";
  const ref = useRef();
  const [len, setLen] = useState(0);
  useEffect(() => {
    if (ref.current) {
      const l = ref.current.getTotalLength();
      setLen(l);
    }
  }, [data]);
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
(function injectDraw() {
  if (document.getElementById("__spark_kf")) return;
  const s = document.createElement("style");
  s.id = "__spark_kf";
  s.textContent = "@keyframes draw { to { stroke-dashoffset: 0; } }";
  document.head.appendChild(s);
})();

/* —— 读取当前主题下的图表用色 —— */
function chartColors() {
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
function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* —— 通用 ECharts 容器：传入 option 构建器，处理 init/resize/主题重绘/销毁 —— */
function EChart({ build, deps, height }) {
  const elRef = useRef();
  const chartRef = useRef();
  const render = () => {
    if (!window.echarts || !elRef.current) return;
    if (!chartRef.current) chartRef.current = window.echarts.init(elRef.current, null, { renderer: "canvas" });
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
function TimeChart({ data, range }) {
  const elRef = useRef();
  const chartRef = useRef();
  const themeRef = useRef();

  const getColors = chartColors;

  const build = () => {
    if (!window.echarts || !elRef.current) return;
    if (!chartRef.current) {
      chartRef.current = window.echarts.init(elRef.current, null, { renderer: "canvas" });
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
            color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
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
function ProbeMiniChart({ data, height }) {
  const hasLoss = data.some((d) => d.loss > 0);
  const build = (c, reduce) => ({
    animation: !reduce, animationDuration: 650, animationEasing: "cubicOut",
    grid: { left: 48, right: hasLoss ? 46 : 18, top: 30, bottom: 28 },
    legend: { top: 4, right: 6, icon: "roundRect", itemWidth: 13, itemHeight: 7, itemGap: 14, textStyle: { color: c.text2, fontSize: 11.5 } },
    tooltip: { trigger: "axis", backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;", axisPointer: { lineStyle: { color: c.border } } },
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
        areaStyle: { color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hasLoss ? "rgba(208,48,80,0.26)" : "rgba(24,160,88,0.26)" }, { offset: 1, color: "rgba(0,0,0,0.01)" }]) },
      },
    ].filter(Boolean),
  });
  return <EChart build={build} deps={[data]} height={height || 300} />;
}

/* —— 公开版：节点资源使用率曲线（CPU/内存/磁盘 %，固定 30 分钟） —— */
function ResourceChart({ data, height }) {
  const build = (c, reduce) => ({
    animation: !reduce, animationDuration: 650, animationEasing: "cubicOut",
    color: [c.primary, c.green, c.amber],
    grid: { left: 44, right: 18, top: 30, bottom: 28 },
    legend: { top: 4, right: 6, icon: "roundRect", itemWidth: 13, itemHeight: 7, itemGap: 14, textStyle: { color: c.text2, fontSize: 11.5 } },
    tooltip: { trigger: "axis", backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;", valueFormatter: (v) => v + " %" },
    xAxis: { type: "time", axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.text2, fontSize: 11, hideOverlap: true }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: { type: "value", name: "%", min: 0, max: 100, nameTextStyle: { color: c.text2, fontSize: 11 }, axisLabel: { color: c.text2, fontSize: 11 }, splitLine: { lineStyle: { color: c.border, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: "CPU", type: "line", data: data.map((d) => [d.ts, d.cpu]), smooth: true, showSymbol: false, lineStyle: { width: 2 }, areaStyle: { color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(47,111,237,0.20)" }, { offset: 1, color: "rgba(47,111,237,0.01)" }]) } },
      { name: "内存", type: "line", data: data.map((d) => [d.ts, d.mem]), smooth: true, showSymbol: false, lineStyle: { width: 2 } },
      { name: "磁盘", type: "line", data: data.map((d) => [d.ts, d.disk]), smooth: true, showSymbol: false, lineStyle: { width: 2 } },
    ],
  });
  return <EChart build={build} deps={[data]} height={height || 260} />;
}

/* —— 公开版：节点流量曲线（↓in 绿 / ↑out 蓝，固定 30 分钟） —— */
function TrafficChart({ data, height }) {
  const peak = Math.max(...data.map((d) => Math.max(d.netIn, d.netOut)));
  const build = (c, reduce) => ({
    animation: !reduce, animationDuration: 650, animationEasing: "cubicOut",
    color: [c.green, c.primary],
    grid: { left: 52, right: 18, top: 30, bottom: 28 },
    legend: { top: 4, right: 6, icon: "roundRect", itemWidth: 13, itemHeight: 7, itemGap: 14, textStyle: { color: c.text2, fontSize: 11.5 } },
    tooltip: { trigger: "axis", backgroundColor: c.bg, borderColor: c.border, borderWidth: 1, textStyle: { color: c.isDark ? "#e6e8ec" : "#1f2329", fontSize: 12 }, extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;", valueFormatter: (v) => v + " MB/s" },
    xAxis: { type: "time", axisLine: { lineStyle: { color: c.border } }, axisLabel: { color: c.text2, fontSize: 11, hideOverlap: true }, axisTick: { show: false }, splitLine: { show: false } },
    yAxis: { type: "value", name: "MB/s", nameTextStyle: { color: c.text2, fontSize: 11 }, axisLabel: { color: c.text2, fontSize: 11 }, splitLine: { lineStyle: { color: c.border, type: "dashed" } }, axisLine: { show: false }, axisTick: { show: false } },
    series: [
      { name: "↓ 下行", type: "line", data: data.map((d) => [d.ts, d.netIn]), smooth: true, showSymbol: false, lineStyle: { width: 2 }, areaStyle: { color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(24,160,88,0.22)" }, { offset: 1, color: "rgba(24,160,88,0.01)" }]) } },
      { name: "↑ 上行", type: "line", data: data.map((d) => [d.ts, d.netOut]), smooth: true, showSymbol: false, lineStyle: { width: 2 } },
    ],
  });
  return <EChart build={build} deps={[data]} height={height || 220} />;
}

Object.assign(window, { Sparkline, TimeChart, EChart, chartColors, ProbeMiniChart, ResourceChart, TrafficChart });
