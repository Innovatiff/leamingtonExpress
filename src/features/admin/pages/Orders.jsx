import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowCounterClockwise,
  ChatCircleText,
  ClipboardText,
  DownloadSimple,
  EnvelopeSimple,
  MapPin,
  Phone,
  Printer,
  Star,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { CITIES } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import { coordsOf, shortName } from "@/lib/dispatch";
import { money } from "@/lib/format";
import { orderItems, orderTotal, paymentKey } from "@/lib/orders";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, Tabs, useAdminCity, useConfirm } from "../components/AdminUI";
import LiveJobMap from "../components/LiveJobMap";
import { AssignBox } from "../components/Staff";
import {
  cityOf,
  customerName,
  dateTime,
  downloadCsv,
  isCancelledOrder,
  mapsHref,
  matches,
  orderNumber,
  phonePretty,
  recordDate,
  telHref,
  timeAgo,
  useCollection,
  waHref,
} from "../lib";
import { FULFILMENT, fulfilmentTone, PAYMENT_STATES, paymentLabel, paymentTone } from "./shared";

const FILTERS = {
  all: { label: "All", test: () => true },
  unfulfilled: { label: "To deliver", test: (o) => !isCancelledOrder(o) && o.status !== "Closed" && o.fulfilment !== "Fulfilled" },
  priority: { label: "Priority", test: (o) => !!o.priority && !isCancelledOrder(o) && o.status !== "Closed" },
  unpaid: { label: "Unpaid", test: (o) => !isCancelledOrder(o) && o.payment !== "Success" && o.payment !== "Refunded" },
  open: { label: "Open", test: (o) => !isCancelledOrder(o) && o.status !== "Closed" },
  closed: { label: "Closed", test: (o) => o.status === "Closed" },
  cancelled: { label: "Cancelled", test: (o) => isCancelledOrder(o) },
};
const PAGE = 50;
const METHOD = { cash: "Cash", etransfer: "E-transfer", card: "Card" };

export default function Orders() {
  const { city } = useAdminCity();
  const { status, data, error } = useCollection("orders");
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get("f")] ? params.get("f") : "all";
  const openId = params.get("id");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const cityOrders = useMemo(
    () =>
      data
        .filter((o) => cityOf(o) === city)
        .map((o) => ({ ...o, _date: recordDate(o) }))
        .sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0)),
    [data, city],
  );
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, cityOrders.filter(f.test).length])), [cityOrders]);
  const list = cityOrders.filter(
    (o) =>
      FILTERS[filter].test(o) &&
      matches(query, orderNumber(o), customerName(o), o.customerInfo?.phone, o.customerInfo?.email, o.customerInfo?.address, ...orderItems(o).map((l) => l.name)),
  );
  const current = openId ? data.find((o) => o.id === openId) : null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "f" });
  };

  const exportCsv = () =>
    downloadCsv(`orders-${city}-${new Date().toISOString().slice(0, 10)}.csv`, CSV_COLUMNS, list);

  return (
    <div className="ad-page">
      <PageHead
        title="Orders"
        subtitle={`${CITIES[city]?.brand} · ${counts.unfulfilled} to deliver`}
        actions={
          <Button variant="secondary" size="sm" icon={DownloadSimple} onClick={exportCsv} disabled={!list.length}>
            Export CSV
          </Button>
        }
      />
      <ErrorNote error={error} />
      <div className="ad-toolbar">
        <Tabs
          label="Order filters"
          value={filter}
          onChange={(k) => {
            setParam("f", k === "all" ? "" : k);
            setLimit(PAGE);
          }}
          tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: counts[key] }))}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Order #, name, phone, product…" />
      </div>

      <Card flush>
        <div className="ad-table-wrap">
          <table className="ad-table ad-table--click">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num ad-hide-sm">Items</th>
                <th className="num">Total</th>
                <th>Payment</th>
                <th>Delivery</th>
              </tr>
            </thead>
            {status === "loading" ? (
              <LoadingRows cols={7} />
            ) : (
              <tbody>
                {list.slice(0, limit).map((o) => {
                  const cancelled = isCancelledOrder(o);
                  return (
                    <tr key={o.id} onClick={() => setParam("id", o.id)} className={o.priority && !cancelled ? "is-priority" : ""}>
                      <td>
                        <button type="button" className="ad-rowlink" onClick={() => setParam("id", o.id)}>
                          {o.priority && !cancelled && <Star size={14} weight="fill" className="ad-star" aria-label="Priority" />}
                          {orderNumber(o)}
                        </button>
                      </td>
                      <td>
                        <span className="ad-cell-main">{timeAgo(o._date)}</span>
                        <span className="ad-cell-sub">{dateTime(o._date)}</span>
                      </td>
                      <td>
                        <span className="ad-cell-main">{customerName(o)}</span>
                        <span className="ad-cell-sub">
                          {phonePretty(o.customerInfo?.phone)} {o.customerInfo?.city ? `· ${o.customerInfo.city}` : ""}
                        </span>
                      </td>
                      <td className="num ad-hide-sm">{o.productsCount || orderItems(o).reduce((s, l) => s + (Number(l.quantity) || 0), 0)}</td>
                      <td className="num strong">{money(orderTotal(o))}</td>
                      <td>
                        <Pill tone={paymentTone(o.payment)}>{paymentLabel(o.payment)}</Pill>
                        <span className="ad-cell-sub">{METHOD[paymentKey(o)]}</span>
                      </td>
                      <td>
                        {cancelled ? <Pill tone="neutral">Cancelled</Pill> : <Pill tone={fulfilmentTone(o.fulfilment)}>{o.fulfilment || "Unfulfilled"}</Pill>}
                        {o.courier?.name ? <span className="ad-cell-sub">{shortName(o.courier.name)}</span> : o.status === "Closed" && <span className="ad-cell-sub">Closed</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
        {status !== "loading" && !list.length && (
          <Empty icon={ClipboardText} title={query ? "No orders match your search" : "No orders here"} text={query ? "Try a name, phone number or order number." : "New orders appear here instantly."} />
        )}
        {list.length > limit && (
          <div className="ad-more">
            <Button variant="secondary" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show more ({list.length - limit})
            </Button>
          </div>
        )}
      </Card>

      <OrderDrawer key={openId || "closed"} order={current} onClose={() => setParam("id", "")} />
    </div>
  );
}

const CSV_COLUMNS = [
  { label: "Order", value: (o) => orderNumber(o) },
  { label: "Date", value: (o) => recordDate(o)?.toISOString() || "" },
  { label: "Customer", value: (o) => customerName(o) },
  { label: "Phone", value: (o) => o.customerInfo?.phone || "" },
  { label: "Email", value: (o) => o.customerInfo?.email || "" },
  { label: "Address", value: (o) => [o.customerInfo?.address, o.customerInfo?.unit, o.customerInfo?.city, o.customerInfo?.postalCode].filter(Boolean).join(", ") },
  { label: "Items", value: (o) => orderItems(o).map((l) => `${l.quantity} x ${l.name}${l.variant ? ` (${l.variant})` : ""}`).join(" | ") },
  { label: "Subtotal", value: (o) => o.total?.productsTotal ?? "" },
  { label: "Delivery", value: (o) => o.total?.shipping ?? "" },
  { label: "Discount", value: (o) => o.total?.discount ?? "" },
  { label: "Total", value: (o) => orderTotal(o) },
  { label: "Payment method", value: (o) => o.paymentMethod || "" },
  { label: "Payment", value: (o) => o.payment || "" },
  { label: "Delivery status", value: (o) => o.fulfilment || "" },
  { label: "Status", value: (o) => o.status || "" },
];

function messageTemplates(o) {
  const first = (o.customerInfo?.firstName || customerName(o)).split(" ")[0];
  const num = orderNumber(o);
  const total = money(orderTotal(o));
  const brand = CITIES[cityOf(o)]?.brand || "Express";
  return o.lang === "en"
    ? [
        ["Order received", `Hi ${first}! We received your order ${num} (${total}). We'll let you know when it's on the way. — ${brand}`],
        ["On the way", `Hi ${first}! Your order ${num} is on the way 🚗. Total to pay: ${total}. — ${brand}`],
        ["Thank you", `Thank you for shopping with ${brand}, ${first}! We hope you enjoy your order ${num}. 🙌`],
      ]
    : [
        ["Pedido recibido", `¡Hola ${first}! Recibimos tu pedido ${num} (${total}). Te avisamos cuando vaya en camino. — ${brand}`],
        ["En camino", `¡Hola ${first}! Tu pedido ${num} va en camino 🚗. Total a pagar: ${total}. — ${brand}`],
        ["Gracias", `¡Gracias por tu compra en ${brand}, ${first}! Esperamos que disfrutes tu pedido ${num}. 🙌`],
      ];
}

function OrderDrawer({ order, onClose }) {
  const toast = useToast();
  const { city } = useAdminCity();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState("");
  const [noteDraft, setNoteDraft] = useState(null);

  if (!order) return confirmDialog;
  const o = order;
  const ci = o.customerInfo || {};
  const items = orderItems(o);
  const cancelled = isCancelledOrder(o);
  const note = noteDraft ?? o.adminNote ?? "";
  const address = [ci.address, ci.unit, ci.city, ci.postalCode].filter(Boolean).join(", ");

  const update = async (patch, message, key) => {
    setBusy(key || "update");
    try {
      await admin.updateRecord("orders", o.id, patch);
      if (message) toast.success(message);
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your connection and permissions.");
    } finally {
      setBusy("");
    }
  };

  const setStage = (stage) => {
    const patch = { fulfilment: stage };
    if (stage === "Out for delivery") patch.pickedUpAt = new Date();
    if (stage === "Fulfilled") {
      patch.fulfilledAt = new Date();
      patch.deliveredAt = new Date();
    }
    update(patch, `Delivery: ${stage}`, `stage-${stage}`);
  };

  const assign = async (staff) => {
    setBusy("assign");
    try {
      await admin.assignDelivery(o.id, staff, o.fulfilment);
      toast.success(staff ? `${shortName(staff.name)} will deliver it — the customer can see it` : "Courier removed");
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your connection and permissions.");
    } finally {
      setBusy("");
    }
  };

  const cancelOrder = async () => {
    const ok = await confirm({
      title: `Cancel ${orderNumber(o)}?`,
      message: "The items go back into stock and the order moves to Cancelled. You can reopen it later.",
      confirmLabel: "Cancel order",
      danger: true,
    });
    if (ok) update({ status: "Cancelled" }, "Order cancelled", "cancel");
  };

  return (
    <>
      <Drawer
        open
        onClose={() => {
          setNoteDraft(null);
          onClose();
        }}
        title={`Order ${orderNumber(o)}`}
        className="ad-drawer ad-print-area"
        headerExtra={
          <button
            type="button"
            className={`icon-btn ad-star-btn ${o.priority ? "is-on" : ""}`}
            onClick={() => update({ priority: !o.priority }, o.priority ? "Priority removed" : "Marked as priority", "priority")}
            aria-pressed={!!o.priority}
            aria-label="Priority"
            title="Priority"
          >
            <Star size={20} weight={o.priority ? "fill" : "regular"} />
          </button>
        }
        footer={
          <div className="ad-drawer__actions no-print">
            <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
              Print
            </Button>
            {cancelled ? (
              <Button variant="secondary" size="sm" icon={ArrowCounterClockwise} loading={busy === "reopen"} onClick={() => update({ status: "Opened", payment: o.payment === "Expired" ? "Pending" : o.payment }, "Order reopened", "reopen")}>
                Reopen
              </Button>
            ) : (
              <Button variant="ghost" size="sm" icon={XCircle} className="ad-danger-text" loading={busy === "cancel"} onClick={cancelOrder}>
                Cancel order
              </Button>
            )}
          </div>
        }
      >
        <div className="ad-detail">
          <div className="ad-detail__meta">
            <span>{dateTime(recordDate(o))}</span>
            <Pill tone={paymentTone(o.payment)}>{paymentLabel(o.payment)}</Pill>
            {cancelled ? <Pill tone="neutral">Cancelled</Pill> : <Pill tone={fulfilmentTone(o.fulfilment)}>{o.fulfilment || "Unfulfilled"}</Pill>}
            {o.status === "Closed" && <Pill tone="neutral">Closed</Pill>}
          </div>

          {!cancelled && (
            <section className="ad-detail__sec no-print">
              <h3>Delivery</h3>
              <div className="ad-steps" role="group" aria-label="Delivery stage">
                {FULFILMENT.map((stage, i) => {
                  const idx = FULFILMENT.indexOf(o.fulfilment || "Unfulfilled");
                  return (
                    <button
                      key={stage}
                      type="button"
                      className={`ad-step ${i < idx ? "is-done" : ""} ${i === idx ? "is-current" : ""}`}
                      aria-pressed={i === idx}
                      onClick={() => i !== idx && setStage(stage)}
                      disabled={busy.startsWith("stage")}
                    >
                      <span>{i + 1}</span>
                      {stage}
                    </button>
                  );
                })}
              </div>
              <div className="ad-inline-fields">
                <label className="ad-select">
                  <span>Payment</span>
                  <select value={o.payment === "Expired" ? "Pending" : o.payment || "Pending"} onChange={(e) => update({ payment: e.target.value, ...(e.target.value === "Success" ? { paidAt: new Date() } : {}) }, `Payment: ${paymentLabel(e.target.value)}`)}>
                    {PAYMENT_STATES.map((p) => (
                      <option key={p} value={p}>
                        {paymentLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ad-select">
                  <span>Order</span>
                  <select value={o.status === "Closed" ? "Closed" : "Opened"} onChange={(e) => update({ status: e.target.value }, e.target.value === "Closed" ? "Order closed" : "Order reopened")}>
                    <option value="Opened">Open</option>
                    <option value="Closed">Closed</option>
                  </select>
                </label>
              </div>
              {paymentKey(o) === "etransfer" && o.payment !== "Success" && <p className="ad-hint">Paid by e-Transfer: check your bank email before marking it as paid.</p>}
            </section>
          )}

          {(!cancelled || o.courier?.name) && (
            <div className="no-print">
              <AssignBox
                title="Courier"
                skill="deliveries"
                city={city}
                assigned={o.courier?.name ? { uid: o.courierUid || "", ...o.courier } : null}
                onAssign={assign}
                busy={busy === "assign"}
                locked={cancelled || o.fulfilment === "Fulfilled" || o.status === "Closed"}
                lockedText="Delivered without a courier from the app."
                hint={
                  o.courierUid
                    ? "The courier marks it picked up and delivered from the employee app; the customer follows it live."
                    : paymentKey(o) === "card" && o.payment !== "Success"
                      ? "Unpaid card orders stay hidden from couriers until the payment goes through."
                      : "Online couriers also see this order in the employee app and can take it themselves."
                }
              />
              {o.courierUid && o.fulfilment === "Out for delivery" && o.accessToken && (
                <section className="ad-detail__sec">
                  <h3>Live location</h3>
                  <LiveJobMap token={o.accessToken} target={coordsOf(o.addressGeo)} kind="order" />
                </section>
              )}
            </div>
          )}

          <section className="ad-detail__sec">
            <h3>Customer</h3>
            <p className="ad-detail__name">{customerName(o)}</p>
            <div className="ad-contact no-print">
              {ci.phone && (
                <>
                  <Button href={telHref(ci.phone)} size="sm" variant="secondary" icon={Phone}>
                    {phonePretty(ci.phone)}
                  </Button>
                  <Button href={waHref(ci.phone)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={WhatsappLogo}>
                    WhatsApp
                  </Button>
                </>
              )}
              {ci.email && (
                <Button href={`mailto:${ci.email}`} size="sm" variant="secondary" icon={EnvelopeSimple}>
                  Email
                </Button>
              )}
            </div>
            <p className="print-only">
              {phonePretty(ci.phone)} {ci.email}
            </p>
            {address && (
              <a className="ad-address" href={mapsHref(address)} target="_blank" rel="noreferrer">
                <MapPin size={18} weight="fill" /> {address}
              </a>
            )}
            {ci.orderNotes && <p className="ad-quote">“{ci.orderNotes}”</p>}
          </section>

          <section className="ad-detail__sec">
            <h3>Items ({items.reduce((s, l) => s + (Number(l.quantity) || 0), 0)})</h3>
            <ul className="ad-items">
              {items.map((l, i) => (
                <li key={`${l.docId || l.name}-${i}`}>
                  {l.image ? <img src={l.image} alt="" className="ad-thumb" /> : <span className="ad-thumb" />}
                  <div>
                    <strong>{l.name}</strong>
                    <span>
                      {l.variant ? `${l.variant} · ` : ""}
                      {l.quantity} × {money(l.price)}
                    </span>
                  </div>
                  <strong>{money(l.lineTotal ?? (Number(l.price) || 0) * (Number(l.quantity) || 0))}</strong>
                </li>
              ))}
            </ul>
            <dl className="ad-totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{money(o.total?.productsTotal ?? 0)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{money(o.total?.shipping ?? 0)}</dd>
              </div>
              {Number(o.total?.discount) > 0 && (
                <div>
                  <dt>Discount {o.discountCode ? `(${o.discountCode})` : ""}</dt>
                  <dd>−{money(o.total.discount)}</dd>
                </div>
              )}
              <div className="ad-totals__total">
                <dt>Total · {o.paymentMethod || METHOD[paymentKey(o)]}</dt>
                <dd>{money(orderTotal(o))}</dd>
              </div>
              {Number(o.total?.totalAccumulatedPoints) > 0 && (
                <div>
                  <dt>Express Points</dt>
                  <dd>+{o.total.totalAccumulatedPoints}</dd>
                </div>
              )}
            </dl>
          </section>

          {ci.phone && (
            <section className="ad-detail__sec no-print">
              <h3>Quick WhatsApp messages</h3>
              <div className="ad-templates">
                {messageTemplates(o).map(([label, text]) => (
                  <a key={label} className="ad-template" href={waHref(ci.phone, text)} target="_blank" rel="noreferrer">
                    <ChatCircleText size={18} weight="duotone" />
                    <span>
                      <strong>{label}</strong>
                      {text}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="ad-detail__sec no-print">
            <TextAreaField label="Internal note" hint="Only visible to the team." rows={3} value={note} onChange={(e) => setNoteDraft(e.target.value)} />
            {noteDraft !== null && noteDraft !== (o.adminNote || "") && (
              <Button size="sm" onClick={() => update({ adminNote: noteDraft.trim() }, "Note saved", "note").then(() => setNoteDraft(null))} loading={busy === "note"}>
                Save note
              </Button>
            )}
          </section>
        </div>
      </Drawer>
      {confirmDialog}
    </>
  );
}
