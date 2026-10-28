// Rides on the dashboard: how many were done, what they brought in, where people
// go, who drove them, and what's happening right now.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Car, Coins, MapPin, PhoneCall, Receipt } from "@phosphor-icons/react";
import { RIDE_ACTIVE, rideIsOpen } from "@/lib/dispatch";
import { money, toDate } from "@/lib/format";
import { normalize } from "@/lib/text";
import { Card, Pill } from "../components/AdminUI";
import { ColumnChart, SplitBar, StatTile } from "../components/Charts";
import { Avatar } from "../components/Staff";
import { cityOf, compactMoney, pctChange, recordDate, useCollection } from "../lib";
import { RIDE_PAYMENT, RIDE_STATUS, rideWhen, statusInfo } from "./shared";

const DAY = 86400000;

/** Final price, or the middle of the website's estimate when no price was set. */
function fareOf(r) {
  const fare = r.fare === "" || r.fare == null ? NaN : Number(r.fare);
  if (Number.isFinite(fare)) return { value: fare, estimated: false };
  if (r.estimate) return { value: (Number(r.estimate.low) + Number(r.estimate.high)) / 2 || 0, estimated: true };
  return { value: 0, estimated: true };
}

const doneAt = (r) => toDate(r.completedAt) || rideWhen(r);
const cancelledAt = (r) => toDate(r.cancelledAt) || recordDate(r);
const placeKey = (r) => r.dropoff?.presetId || normalize(r.dropoff?.address || "") || "—";

// What's going on now, in the order a ride moves
const LIVE = [
  { key: "requested", filter: "waiting" },
  { key: "confirmed", filter: "waiting" },
  { key: "assigned", filter: "road" },
  { key: "arrived", filter: "road" },
  { key: "in_progress", filter: "road" },
];

export default function DashboardRides({ city, range, now }) {
  const { data } = useCollection("rides");

  const m = useMemo(() => {
    const start = new Date(now - (range - 1) * DAY);
    start.setHours(0, 0, 0, 0);
    const from = start.getTime();
    const prevFrom = from - range * DAY;
    const t = (d) => d?.getTime() || 0;
    const rides = data.filter((r) => cityOf(r) === city);

    const done = rides.filter((r) => r.status === "completed").map((r) => ({ r, at: t(doneAt(r)), fare: fareOf(r) }));
    const doneNow = done.filter((x) => x.at >= from);
    const donePrev = done.filter((x) => x.at >= prevFrom && x.at < from);
    const sum = (list) => list.reduce((s, x) => s + x.fare.value, 0);
    const income = sum(doneNow);
    const prevIncome = sum(donePrev);

    const requested = rides.filter((r) => t(recordDate(r)) >= from);
    const requestedPrev = rides.filter((r) => t(recordDate(r)) >= prevFrom && t(recordDate(r)) < from);
    const cancelled = rides.filter((r) => r.status === "cancelled" && t(cancelledAt(r)) >= from).length;

    // one column per day: income, and the number of rides in the tooltip
    const days = Array.from({ length: range }, (_, i) => ({ date: new Date(from + i * DAY), value: 0, count: 0 }));
    for (const x of doneNow) {
      const day = days[Math.floor((x.at - from) / DAY)];
      if (day) {
        day.value += x.fare.value;
        day.count += 1;
      }
    }

    const byPayment = { cash: 0, card: 0, etransfer: 0 };
    for (const x of doneNow) byPayment[x.r.payment in byPayment ? x.r.payment : "cash"] += 1;

    // where people go (every request in the period that wasn't cancelled)
    const places = new Map();
    for (const r of requested) {
      if (r.status === "cancelled") continue;
      const key = placeKey(r);
      const p = places.get(key) || { key, name: r.dropoff?.address || "—", km: Number(r.dropoff?.km) || 0, count: 0, income: 0 };
      p.count += 1;
      if (r.status === "completed") p.income += fareOf(r).value;
      places.set(key, p);
    }

    // who drove the finished rides
    const drivers = new Map();
    for (const x of doneNow) {
      const key = x.r.driverUid || x.r.driver?.name || "";
      const d = drivers.get(key) || { key, uid: x.r.driverUid || "", name: x.r.driver?.name || "", photo: x.r.driver?.photo || "", count: 0, income: 0 };
      d.count += 1;
      d.income += x.fare.value;
      drivers.set(key, d);
    }

    const live = LIVE.map((s) => ({ ...s, ...statusInfo(RIDE_STATUS, s.key), count: rides.filter((r) => r.status === s.key).length }));
    const scheduled = rides.filter((r) => r.schedule?.type === "later" && LIVE.some((s) => s.key === r.status) && t(rideWhen(r)) > now).length;

    return {
      completed: doneNow.length,
      completedDelta: pctChange(doneNow.length, donePrev.length),
      income,
      incomeDelta: pctChange(income, prevIncome),
      estimated: doneNow.filter((x) => x.fare.estimated).length,
      avg: doneNow.length ? income / doneNow.length : 0,
      avgDelta: pctChange(doneNow.length ? income / doneNow.length : 0, donePrev.length ? prevIncome / donePrev.length : 0),
      requests: requested.length,
      requestsDelta: pctChange(requested.length, requestedPrev.length),
      cancelled,
      days,
      byPayment,
      places: [...places.values()].sort((a, b) => b.count - a.count || b.income - a.income).slice(0, 5),
      drivers: [...drivers.values()].sort((a, b) => b.count - a.count || b.income - a.income).slice(0, 5),
      live,
      waiting: rides.filter(rideIsOpen).length,
      onRoad: rides.filter((r) => RIDE_ACTIVE.includes(r.status)).length,
      scheduled,
    };
  }, [data, city, range, now]);

  const vs = `vs previous ${range} days`;
  const doneShare = m.requests ? Math.round((Math.min(m.completed, m.requests) / m.requests) * 100) : 0;

  return (
    <section className="ad-section" aria-labelledby="dash-rides">
      <div className="ad-sechead">
        <h2 id="dash-rides">
          <Car size={20} weight="duotone" aria-hidden="true" /> Rides <span>· last {range} days</span>
        </h2>
        <Link to="/admin/rides" className="ad-link">
          All rides <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div className="ad-stats">
        <StatTile icon={Car} label="Rides completed" value={m.completed.toLocaleString("en-CA")} delta={m.completedDelta} deltaLabel={vs} to="/admin/rides?f=completed" />
        <StatTile
          icon={Coins}
          label="Ride income"
          value={compactMoney(m.income)}
          delta={m.incomeDelta}
          deltaLabel={vs}
          foot={m.estimated ? `${m.estimated} without a final price — website estimate used` : null}
        />
        <StatTile icon={Receipt} label="Average fare" value={money(m.avg, { whole: true })} delta={m.avgDelta} deltaLabel={vs} />
        <StatTile
          icon={PhoneCall}
          label="Ride requests"
          value={m.requests.toLocaleString("en-CA")}
          delta={m.requestsDelta}
          deltaLabel={vs}
          foot={m.requests ? `${doneShare}% completed · ${m.cancelled} cancelled` : null}
        />
      </div>

      <div className="ad-grid ad-grid--main">
        <Card className="ad-card--chart">
          <ColumnChart data={m.days} title="Ride income per day" valueLabel="Income" countLabel="rides" />
        </Card>
        <div className="ad-stack">
          <Card title="Rides right now" actions={<span className="ad-card__hint">{m.scheduled ? `${m.scheduled} scheduled ahead` : ""}</span>}>
            <ul className="ad-pipeline">
              {m.live.map((s) => (
                <li key={s.key}>
                  <Link to={`/admin/rides?f=${s.filter}`} className="ad-pipeline__link">
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </Link>
                  <strong>{s.count}</strong>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="How riders paid">
            <SplitBar
              label="Completed rides by payment method"
              parts={[
                { label: RIDE_PAYMENT.cash, value: m.byPayment.cash },
                { label: RIDE_PAYMENT.card, value: m.byPayment.card },
                { label: RIDE_PAYMENT.etransfer, value: m.byPayment.etransfer },
              ]}
              format={(v) => `${v} ${v === 1 ? "ride" : "rides"}`}
            />
          </Card>
        </div>
      </div>

      <div className="ad-grid">
        <Card title="Top destinations" flush>
          {m.places.length ? (
            <ul className="ad-list">
              {m.places.map((p, i) => (
                <li key={p.key} className="ad-list__row">
                  <span className="ad-rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="ad-list__main">
                    <strong>{p.name}</strong>
                    <span className="ad-list__meta">
                      <MapPin size={12} weight="fill" aria-hidden="true" />
                      {p.km ? `≈${p.km} km` : "In town"}
                      {p.income ? ` · ${money(p.income, { whole: true })} earned` : ""}
                    </span>
                  </div>
                  <strong className="ad-list__amount">
                    {p.count} {p.count === 1 ? "ride" : "rides"}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-card__empty">No ride requests in this period.</p>
          )}
        </Card>

        <Card
          title="Drivers"
          flush
          actions={
            <Link to="/admin/empleados?f=rides" className="ad-link">
              Employees <ArrowRight size={14} weight="bold" />
            </Link>
          }
        >
          {m.drivers.length ? (
            <ul className="ad-list">
              {m.drivers.map((d) => {
                const row = (
                  <>
                    <Avatar staff={{ name: d.name || "?", photo: d.photo }} size={36} />
                    <div className="ad-list__main">
                      <strong>{d.name || "Done without the app"}</strong>
                      <span>{money(d.income, { whole: true })} in fares</span>
                    </div>
                    <strong className="ad-list__amount">
                      {d.count} {d.count === 1 ? "ride" : "rides"}
                    </strong>
                  </>
                );
                return (
                  <li key={d.key || "none"}>
                    {d.uid ? (
                      <Link to={`/admin/empleados?id=${encodeURIComponent(d.uid)}`} className="ad-list__row">
                        {row}
                      </Link>
                    ) : (
                      <div className="ad-list__row">{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ad-card__empty">No finished rides in this period.</p>
          )}
        </Card>
      </div>
    </section>
  );
}
