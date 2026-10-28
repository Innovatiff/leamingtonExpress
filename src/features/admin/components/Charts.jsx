import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ChartBar, Table } from "@phosphor-icons/react";
import { money } from "@/lib/format";
import { compactMoney, shortDate } from "../lib";

// Validated with the dataviz palette checker (light surface #ffffff):
// brand blue, orange, aqua — CVD-safe in this order. Aqua is under 3:1,
// so every chart using it shows visible labels.
export const SERIES = ["#1f4fe6", "#eb6834", "#1baf7a"];

/* ------------------------------- Stat tile ------------------------------- */
/**
 * label · value · optional delta vs a named period (up/down arrow + sign, so
 * the meaning never rests on color alone).
 */
export function StatTile({ label, value, delta, deltaLabel, goodWhenUp = true, note, to, icon: Icon }) {
  const hasDelta = Number.isFinite(delta);
  const up = hasDelta && delta >= 0;
  const good = hasDelta && (up ? goodWhenUp : !goodWhenUp);
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  const body = (
    <>
      <span className="ad-stat__label">
        {Icon && <Icon size={16} weight="bold" aria-hidden="true" />}
        {label}
      </span>
      <strong className="ad-stat__value">{value}</strong>
      {hasDelta ? (
        <span className={`ad-stat__delta ${delta === 0 ? "" : good ? "is-good" : "is-bad"}`}>
          <Arrow size={14} weight="bold" aria-hidden="true" />
          {delta > 0 ? "+" : delta < 0 ? "−" : ""}
          {Math.abs(Math.round(delta))}% <span>{deltaLabel}</span>
        </span>
      ) : (
        <span className="ad-stat__note">{note || (deltaLabel ? "No earlier data to compare" : "")}</span>
      )}
    </>
  );
  return to ? (
    <Link className="ad-stat ad-stat--link" to={to}>
      {body}
    </Link>
  ) : (
    <div className="ad-stat">{body}</div>
  );
}

/* ---------------------------- Width observer ----------------------------- */
function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/** Column path: 4px rounded data-end (top), square at the baseline. */
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/* ---------------------------- Revenue columns ---------------------------- */
/**
 * Daily revenue as thin columns. One series → no legend (the card title names
 * it). Hover/focus shows a tooltip; a table view is one click away.
 * data = [{ date: Date, value: number, count: number }]
 */
export function ColumnChart({ data, title, valueLabel = "Revenue", countLabel = "orders", height = 220 }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(-1);
  const [asTable, setAsTable] = useState(false);

  const M = { top: 22, right: 8, bottom: 26, left: 52 };
  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = height - M.top - M.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v) => M.top + plotH - (v / max) * plotH;
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), -1);
  // Enough room between date labels at any width (~46px each)
  const needed = Math.ceil(46 / Math.max(1, slot));
  const labelEvery = [1, 2, 3, 5, 7, 10, 14, 15, 30].find((n) => n >= needed) || needed;
  const lastLabelled = (data.length - 1) % labelEvery >= labelEvery * 0.6;
  const total = data.reduce((s, d) => s + d.value, 0);
  const point = data[active];

  const onKey = (e) => {
    if (!data.length) return;
    if (e.key === "ArrowRight") setActive((i) => Math.min(data.length - 1, i < 0 ? data.length - 1 : i + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, i < 0 ? data.length - 1 : i - 1));
    else if (e.key === "Escape") setActive(-1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="ad-chart">
      <div className="ad-chart__bar">
        <div>
          <span className="ad-chart__title">{title}</span>
          <strong className="ad-chart__total">{money(total)}</strong>
        </div>
        <button type="button" className="ad-chart__toggle" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? <ChartBar size={16} weight="bold" /> : <Table size={16} weight="bold" />}
          {asTable ? "Chart" : "Table"}
        </button>
      </div>

      {asTable ? (
        <div className="ad-chart__table">
          <table className="ad-table ad-table--compact">
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">{valueLabel}</th>
                <th className="num">{countLabel[0].toUpperCase() + countLabel.slice(1)}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date.getTime()}>
                  <td>{shortDate(d.date)}</td>
                  <td className="num">{money(d.value)}</td>
                  <td className="num">{d.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ad-chart__plot" ref={wrapRef} style={{ height }}>
          {width > 0 && (
            <svg
              width={width}
              height={height}
              role="img"
              aria-label={`${title}: ${money(total)} total over ${data.length} days. Use the arrow keys to read each day, or switch to the table.`}
              tabIndex={0}
              onKeyDown={onKey}
              onBlur={() => setActive(-1)}
              onPointerLeave={() => setActive(-1)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className={t === 0 ? "ad-chart__axis" : "ad-chart__grid"} />
                  <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="ad-chart__tick">
                    {compactMoney(t)}
                  </text>
                </g>
              ))}
              {data.map((d, i) => {
                const x = M.left + i * slot + (slot - barW) / 2;
                const h = Math.max(0, y(0) - y(d.value));
                return (
                  <g key={d.date.getTime()}>
                    {h > 0 && <path d={columnPath(x, y(d.value), barW, h)} className={`ad-chart__col ${active === i ? "is-active" : ""} ${active >= 0 && active !== i ? "is-dim" : ""}`} />}
                    {(i % labelEvery === 0 || (i === data.length - 1 && lastLabelled)) && (
                      <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="ad-chart__tick">
                        {shortDate(d.date)}
                      </text>
                    )}
                    <rect x={M.left + i * slot} y={M.top} width={slot} height={plotH} fill="transparent" onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
                  </g>
                );
              })}
              {peak >= 0 && data[peak].value > 0 && active < 0 && (
                <text x={M.left + peak * slot + slot / 2} y={y(data[peak].value) - 7} textAnchor="middle" className="ad-chart__label">
                  {compactMoney(data[peak].value)}
                </text>
              )}
            </svg>
          )}
          {point && (
            <div
              className="ad-chart__tip"
              style={{
                left: Math.min(Math.max(M.left + active * slot + slot / 2, 70), width - 70),
                top: Math.max(4, y(point.value) - 64),
              }}
              role="status"
            >
              <strong>{money(point.value)}</strong>
              <span>
                {shortDate(point.date)} · {point.count} {countLabel}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Part-to-whole ----------------------------- */
/** One stacked bar + a legend that always shows the numbers. parts = [{ label, value }] */
export function SplitBar({ parts, format = (v) => v, label }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="ad-split">
      <div className="ad-split__bar" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}>
        {total > 0 ? (
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <span key={p.label} style={{ flexGrow: p.value, background: SERIES[parts.indexOf(p) % SERIES.length] }} title={`${p.label}: ${format(p.value)}`} />
            ))
        ) : (
          <span className="ad-split__empty" />
        )}
      </div>
      <ul className="ad-split__legend">
        {parts.map((p, i) => (
          <li key={p.label}>
            <span className="ad-split__swatch" style={{ background: SERIES[i % SERIES.length] }} aria-hidden="true" />
            <span className="ad-split__name">{p.label}</span>
            <strong>{format(p.value)}</strong>
            <span className="ad-split__pct">{total ? Math.round((p.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
