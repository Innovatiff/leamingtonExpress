import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AirplaneTilt, ArrowRight, Car, ChatsCircle, ClipboardText, Coins, IdentificationBadge, Lightning, Package, Receipt, ShoppingBag, Warning } from "@phosphor-icons/react";
import InstallApp from "@/components/InstallApp";
import { CITIES } from "@/config/cities";
import { bookingIsOpen, deliveryIsOpen, departureKey, RIDE_ACTIVE, RIDE_WAITING, rideIsOpen } from "@/lib/dispatch";
import { money } from "@/lib/format";
import { normalizeProduct } from "@/lib/products";
import { orderTotal, paymentKey } from "@/lib/orders";
import { Card, ErrorNote, PageHead, Pill, Segmented, useAdminCity } from "../components/AdminUI";
import { ColumnChart, SplitBar, StatTile } from "../components/Charts";
import { Avatar, lastSeenText, useStaffList, useTeamWork } from "../components/Staff";
import { cityOf, compactMoney, customerName, dateTime, isCancelledOrder, orderNumber, pctChange, recordDate, timeAgo, useCollection, useNow } from "../lib";
import DashboardRides from "./DashboardRides";
import { fulfilmentTone, RIDE_STATUS, rideWhen, statusInfo } from "./shared";

const DAY = 86400000;
const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

export default function Dashboard() {
  const { city } = useAdminCity();
  const now = useNow();
  const [range, setRange] = useState(30);
  const orders = useCollection("orders");
  const rides = useCollection("rides");
  const bookings = useCollection("bookings");
  const messages = useCollection("messages");
  const products = useCollection("products");

  const m = useMemo(() => {
    const here = (r) => cityOf(r) === city;
    const start = new Date(now - (range - 1) * DAY);
    start.setHours(0, 0, 0, 0);
    const from = start.getTime();
    const prevFrom = from - range * DAY;

    const cityOrders = orders.data.filter(here).map((o) => ({ o, t: recordDate(o)?.getTime() || 0 }));
    const live = cityOrders.filter(({ o }) => !isCancelledOrder(o));
    const inRange = live.filter(({ t }) => t >= from);
    const inPrev = live.filter(({ t }) => t >= prevFrom && t < from);
    const sum = (list) => list.reduce((s, { o }) => s + orderTotal(o), 0);
    const sales = sum(inRange);
    const prevSales = sum(inPrev);

    // one column per day
    const days = Array.from({ length: range }, (_, i) => ({ date: new Date(from + i * DAY), value: 0, count: 0 }));
    for (const { o, t } of inRange) {
      const idx = Math.floor((t - from) / DAY);
      if (days[idx]) {
        days[idx].value += orderTotal(o);
        days[idx].count += 1;
      }
    }

    const byMethod = { cash: 0, etransfer: 0, card: 0 };
    for (const { o } of inRange) byMethod[paymentKey(o)] = (byMethod[paymentKey(o)] || 0) + orderTotal(o);

    const open = live.filter(({ o }) => o.status !== "Closed" && o.fulfilment !== "Fulfilled");
    const pipeline = ["Unfulfilled", "Preparing", "Out for delivery"].map((stage) => ({
      stage,
      count: open.filter(({ o }) => (o.fulfilment || "Unfulfilled") === stage).length,
    }));
    const unpaid = open.filter(({ o }) => o.payment !== "Success").length;

    // top products by units sold in the range
    const units = new Map();
    for (const { o } of inRange) {
      for (const line of o.products || []) {
        const key = line.docId || line.name;
        const cur = units.get(key) || { name: line.name, image: line.image, qty: 0, total: 0 };
        cur.qty += Number(line.quantity) || 0;
        cur.total += Number(line.lineTotal) || (Number(line.price) || 0) * (Number(line.quantity) || 0);
        units.set(key, cur);
      }
    }
    const top = [...units.values()].sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 5);

    const cityRides = rides.data.filter(here);
    const activeRides = cityRides
      .filter((r) => [...RIDE_WAITING, ...RIDE_ACTIVE].includes(r.status))
      .map((r) => ({ r, when: rideWhen(r) }))
      .sort((a, b) => (a.when?.getTime() || 0) - (b.when?.getTime() || 0));

    const cityBookings = bookings.data.filter(here);
    const bookingsInRange = cityBookings.filter((b) => b.status !== "cancelled" && (recordDate(b)?.getTime() || 0) >= from);
    const bookingsPrev = cityBookings.filter((b) => {
      const t = recordDate(b)?.getTime() || 0;
      return b.status !== "cancelled" && t >= prevFrom && t < from;
    });
    const travelSales = bookingsInRange.reduce((s, b) => s + (Number(b.pricing?.total) || 0), 0);
    const travelPrev = bookingsPrev.reduce((s, b) => s + (Number(b.pricing?.total) || 0), 0);

    const lowStock = products.data
      .map((raw) => normalizeProduct(raw))
      .filter((p) => p.status === "active" && p.stock !== null && p.stock <= 3 && (!p.cities || p.cities.includes(city)))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6);

    return {
      sales,
      salesDelta: pctChange(sales, prevSales),
      ordersCount: inRange.length,
      ordersDelta: pctChange(inRange.length, inPrev.length),
      avg: inRange.length ? sales / inRange.length : 0,
      avgDelta: pctChange(inRange.length ? sales / inRange.length : 0, inPrev.length ? prevSales / inPrev.length : 0),
      travelSales,
      travelDelta: pctChange(travelSales, travelPrev),
      travelCount: bookingsInRange.length,
      days,
      byMethod,
      pipeline,
      unpaid,
      toFulfil: open.length,
      latest: [...cityOrders].sort((a, b) => b.t - a.t).slice(0, 6).map(({ o }) => o),
      top,
      activeRides,
      ridesWaiting: cityRides.filter(rideIsOpen).length,
      bookingsPending: cityBookings.filter((b) => b.status === "pending").length,
      newMessages: messages.data.filter((x) => here(x) && (x.status || "new") === "new").length,
      lowStock,
    };
  }, [orders.data, rides.data, bookings.data, messages.data, products.data, city, range, now]);

  const vs = `vs previous ${range} days`;
  const error = orders.error || rides.error || bookings.error || products.error;

  return (
    <div className="ad-page">
      <PageHead
        title="Dashboard"
        subtitle={`${CITIES[city]?.brand || city} · last ${range} days`}
        actions={<Segmented label="Date range" options={RANGES} value={range} onChange={setRange} />}
      />
      <ErrorNote error={error} />

      <div className="ad-stats">
        <StatTile icon={Coins} label="Store sales" value={compactMoney(m.sales)} delta={m.salesDelta} deltaLabel={vs} />
        <StatTile icon={Receipt} label="Orders" value={m.ordersCount.toLocaleString("en-CA")} delta={m.ordersDelta} deltaLabel={vs} />
        <StatTile icon={ShoppingBag} label="Average order" value={money(m.avg, { whole: true })} delta={m.avgDelta} deltaLabel={vs} />
        <StatTile icon={AirplaneTilt} label="Travel bookings" value={compactMoney(m.travelSales)} delta={m.travelDelta} deltaLabel={vs} />
      </div>

      <div className="ad-attn">
        <AttentionLink to="/admin/pedidos?f=unfulfilled" icon={ClipboardText} count={m.toFulfil} label={m.toFulfil === 1 ? "order to deliver" : "orders to deliver"} extra={m.unpaid ? `${m.unpaid} unpaid` : ""} />
        <AttentionLink to="/admin/rides" icon={Car} count={m.ridesWaiting} label={m.ridesWaiting === 1 ? "ride waiting" : "rides waiting"} />
        <AttentionLink to="/admin/reservas" icon={AirplaneTilt} count={m.bookingsPending} label={m.bookingsPending === 1 ? "booking to confirm" : "bookings to confirm"} />
        <AttentionLink to="/admin/mensajes" icon={ChatsCircle} count={m.newMessages} label={m.newMessages === 1 ? "new message" : "new messages"} />
      </div>

      <AdminInstall />

      <div className="ad-grid">
        <TeamNow city={city} />
        <Card
          title="Rides to handle"
          flush
          actions={
            <Link to="/admin/rides" className="ad-link">
              All rides <ArrowRight size={14} weight="bold" />
            </Link>
          }
        >
          {m.activeRides.length ? (
            <ul className="ad-list">
              {m.activeRides.slice(0, 6).map(({ r, when }) => (
                <li key={r.id}>
                  <Link to={`/admin/rides?id=${encodeURIComponent(r.id)}`} className="ad-list__row">
                    <div className="ad-list__main">
                      <strong>
                        {r.contact?.name || "—"} → {r.dropoff?.address || "—"}
                      </strong>
                      <span>
                        {r.schedule?.type === "later" ? dateTime(when) : `As soon as possible · asked ${timeAgo(recordDate(r))}`}
                        {r.driver?.name ? ` · ${r.driver.name.split(" ")[0]}` : ""}
                      </span>
                    </div>
                    <Pill tone={statusInfo(RIDE_STATUS, r.status).tone}>{statusInfo(RIDE_STATUS, r.status).label}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-card__empty">No rides waiting.</p>
          )}
        </Card>
      </div>

      <DashboardRides city={city} range={range} now={now} />

      <div className="ad-sechead">
        <h2>
          <ShoppingBag size={20} weight="duotone" aria-hidden="true" /> Store <span>· last {range} days</span>
        </h2>
        <Link to="/admin/pedidos" className="ad-link">
          All orders <ArrowRight size={14} weight="bold" />
        </Link>
      </div>

      <div className="ad-grid ad-grid--main">
        <Card className="ad-card--chart">
          <ColumnChart data={m.days} title={`Store sales per day`} />
        </Card>
        <div className="ad-stack">
          <Card title="Sales by payment method">
            <SplitBar
              label="Sales by payment method"
              parts={[
                { label: "Cash", value: m.byMethod.cash },
                { label: "E-transfer", value: m.byMethod.etransfer },
                { label: "Card", value: m.byMethod.card },
              ]}
              format={(v) => money(v, { whole: true })}
            />
          </Card>
          <Card title="Open orders">
            <ul className="ad-pipeline">
              {m.pipeline.map((p) => (
                <li key={p.stage}>
                  <Pill tone={fulfilmentTone(p.stage)}>{p.stage}</Pill>
                  <strong>{p.count}</strong>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="ad-grid ad-grid--3">
        <Card
          title="Latest orders"
          flush
          actions={
            <Link to="/admin/pedidos" className="ad-link">
              All orders <ArrowRight size={14} weight="bold" />
            </Link>
          }
        >
          {m.latest.length ? (
            <ul className="ad-list">
              {m.latest.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/pedidos?id=${encodeURIComponent(o.id)}`} className="ad-list__row">
                    <div className="ad-list__main">
                      <strong>
                        {orderNumber(o)} · {customerName(o)}
                      </strong>
                      <span>{timeAgo(recordDate(o))}</span>
                    </div>
                    <Pill tone={isCancelledOrder(o) ? "neutral" : fulfilmentTone(o.fulfilment)}>{isCancelledOrder(o) ? "Cancelled" : o.fulfilment || "Unfulfilled"}</Pill>
                    <strong className="ad-list__amount">{money(orderTotal(o))}</strong>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-card__empty">No orders yet.</p>
          )}
        </Card>
        <Card title={`Best sellers · last ${range} days`} flush>
          {m.top.length ? (
            <ul className="ad-list">
              {m.top.map((p) => (
                <li key={p.name} className="ad-list__row">
                  {p.image ? <img src={p.image} alt="" className="ad-thumb" /> : <span className="ad-thumb" />}
                  <div className="ad-list__main">
                    <strong>{p.name}</strong>
                    <span>{money(p.total)}</span>
                  </div>
                  <strong className="ad-list__amount">{p.qty} sold</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-card__empty">No sales in this period.</p>
          )}
        </Card>
        <Card
          title="Low stock"
          flush
          actions={
            <Link to="/admin/productos?stock=low" className="ad-link">
              Products <ArrowRight size={14} weight="bold" />
            </Link>
          }
        >
          {m.lowStock.length ? (
            <ul className="ad-list">
              {m.lowStock.map((p) => (
                <li key={p.id}>
                  <Link to={`/admin/productos/${encodeURIComponent(p.id)}`} className="ad-list__row">
                    {p.image ? <img src={p.image} alt="" className="ad-thumb" /> : <Package size={20} className="ad-thumb" />}
                    <div className="ad-list__main">
                      <strong>{p.name}</strong>
                      <span>{money(p.price)}</span>
                    </div>
                    <Pill tone={p.stock === 0 ? "red" : "amber"} icon={Warning}>
                      {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ad-card__empty">Everything is well stocked.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Who is working right now and what nobody has taken yet. */
function TeamNow({ city }) {
  const { list, status } = useStaffList();
  const loading = status === "loading";
  const work = useTeamWork();
  const rides = useCollection("rides").data;
  const orders = useCollection("orders").data;
  const bookings = useCollection("bookings").data;
  const here = (r) => cityOf(r) === city;
  const team = list.filter((s) => s.active !== false && (!s.cities?.length || s.cities.includes(city)));
  const jobsOf = (s) => work.get(s.uid)?.active || [];
  const online = team.filter((s) => s._presence.key === "online");
  const busy = team.filter((s) => jobsOf(s).length);
  const waiting =
    rides.filter((r) => here(r) && rideIsOpen(r)).length +
    orders.filter((o) => here(o) && deliveryIsOpen(o)).length +
    new Set(bookings.filter((b) => here(b) && bookingIsOpen(b)).map(departureKey)).size;
  const shown = team.filter((s) => s._presence.key === "online" || s._presence.key === "away" || jobsOf(s).length).slice(0, 6);

  return (
    <Card
      title="Team now"
      flush
      actions={
        <Link to="/admin/empleados" className="ad-link">
          Employees <ArrowRight size={14} weight="bold" />
        </Link>
      }
    >
      <div className="ad-teamnow">
        <div className={online.length ? "is-good" : ""}>
          <strong>{loading ? "–" : online.length}</strong>
          <span>online</span>
        </div>
        <div>
          <strong>{loading ? "–" : busy.length}</strong>
          <span>on a job</span>
        </div>
        <div className={waiting ? "has-work" : ""}>
          <strong>{waiting}</strong>
          <span>{waiting === 1 ? "job nobody took" : "jobs nobody took"}</span>
        </div>
      </div>
      {loading ? (
        <p className="ad-card__empty">Loading…</p>
      ) : shown.length ? (
        <ul className="ad-list">
          {shown.map((s) => {
            const job = jobsOf(s)[0];
            return (
              <li key={s.uid}>
                <Link to={job ? job.to : `/admin/empleados?id=${encodeURIComponent(s.uid)}`} className="ad-list__row">
                  <Avatar staff={s} size={36} dot={s._presence.key} />
                  <div className="ad-list__main">
                    <strong>{s.name}</strong>
                    {job ? (
                      <span className="ad-list__job">
                        <Lightning size={12} weight="fill" aria-hidden="true" /> {job.label}
                      </span>
                    ) : (
                      <span>{lastSeenText(s)}</span>
                    )}
                  </div>
                  <Pill tone={job ? "violet" : s._presence.tone}>{job ? "On a job" : s._presence.label}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="ad-card__empty">
          {team.length ? (
            "Nobody is online. Employees switch on “Available” in their app to receive jobs."
          ) : (
            <>
              <IdentificationBadge size={22} weight="duotone" /> No employees yet.{" "}
              <Link to="/admin/empleados?id=new" className="ad-link">
                Add your first one
              </Link>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

function AdminInstall() {
  return (
    <InstallApp
      id="admin"
      icon="/apps/admin-192.png"
      className="ad-install"
      strings={{
        title: "Put Express Admin on your phone",
        text: "Open it like an app from your home screen: orders, rides, bookings, messages and your team.",
        button: "Install",
        how: "How to install",
        iosTitle: "Install on iPhone",
        iosSteps: ["Open this page in Safari.", "Tap the Share button (the square with an arrow).", "Choose “Add to Home Screen”, then tap Add."],
        later: "Not now",
      }}
    />
  );
}

function AttentionLink({ to, icon: Icon, count, label, extra }) {
  return (
    <Link to={to} className={`ad-attn__item ${count ? "has-work" : ""}`}>
      <span className="ad-attn__icon">
        <Icon size={22} weight="duotone" />
      </span>
      <span className="ad-attn__text">
        <strong>{count}</strong> {label}
        {extra && <small>{extra}</small>}
      </span>
      <ArrowRight size={16} weight="bold" className="ad-attn__arrow" />
    </Link>
  );
}
