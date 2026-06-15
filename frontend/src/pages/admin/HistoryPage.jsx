/* ============================================================
   ONC — 告警历史（登录可见，含只读角色）
   ============================================================ */
import React, { useState, useEffect } from "react";
import { useApp } from "../../store.jsx";
import { Ic, Tag, Empty, useToast } from "../../ui.jsx";
import { PageHeader } from "./_common.jsx";
import { apiAlertHistory } from "../../api.js";

function fmtTs(ms) {
  if (!ms) return "—";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function fmtVal(metric, v) {
  if (v == null) return "—";
  if (metric === "latency") return v + " ms";
  if (metric === "loss") return v + " %";
  return String(v);
}
function fmtTh(metric, v) {
  if (v == null) return "—";
  if (metric === "latency") return "> " + v + " ms";
  if (metric === "loss") return "> " + v + " %";
  if (metric === "fail") return "≥ " + v + " 次";
  return String(v);
}

export function HistoryPage() {
  const { tick } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [evt, setEvt] = useState("全部"); // 全部 / alert / recovery

  useEffect(() => {
    let alive = true;
    apiAlertHistory(200).then((d) => {
      if (!alive) return;
      setRows(d.history || []);
    }).catch((e) => { if (alive) toast.error(e.message || "加载告警历史失败"); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [tick]);

  const filtered = rows.filter((h) => evt === "全部" || h.event_type === evt);

  return (
    <div className="fade-up">
      <PageHeader title="告警历史" desc="告警与恢复事件记录"
        action={<div className="seg">
          {[["全部", "全部"], ["告警", "alert"], ["恢复", "recovery"]].map(([label, val]) =>
            <button key={val} className={evt === val ? "active" : ""} onClick={() => setEvt(val)}>{label}</button>)}
        </div>} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>时间</th><th>任务</th><th>事件</th><th>指标</th><th>实际值</th><th>阈值</th><th>已通知</th></tr></thead>
            <tbody>
              {filtered.map((h, i) => {
                const isAlert = h.event_type === "alert";
                return (
                  <tr key={i}>
                    <td className="mono muted" style={{ fontSize: 12.5 }}>{fmtTs(h.ts)}</td>
                    <td style={{ fontWeight: 540 }}>{h.task_name || "—"}</td>
                    <td><Tag tone={isAlert ? "red" : "green"} dot>{isAlert ? "告警" : "恢复"}</Tag></td>
                    <td><span className="mono tag">{h.metric || "—"}</span></td>
                    <td className="num" style={{ fontWeight: 600, color: isAlert ? "var(--red)" : "var(--green)" }}>{fmtVal(h.metric, h.actual_value)}</td>
                    <td className="num muted">{fmtTh(h.metric, h.threshold)}</td>
                    <td>{h.notified ? <span className="row gap-4" style={{ color: "var(--green)" }}><Ic name="check" size={14} />是</span> : <span className="faint">否</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loaded && filtered.length === 0 && <Empty text="暂无告警记录" />}
        {!loaded && <div className="muted" style={{ padding: "16px 20px" }}>加载中…</div>}
      </div>
    </div>
  );
}
