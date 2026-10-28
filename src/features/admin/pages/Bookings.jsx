import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AirplaneTilt, CalendarBlank, ChatCircleText, DownloadSimple, IdentificationCard, ListBullets, Phone, UsersThree, WhatsappLogo } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { CITIES } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import { money } from "@/lib/format";
import { DEFAULT_TRIPS } from "@/features/travel/data/trips";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, Segmented, Tabs, useAdminCity } from "../components/AdminUI";
import { cityOf, dayToDate, downloadCsv, matches, phonePretty, recordDate, telHref, timeAgo, useCollection, waHref, weekdayDate } from "../lib";
import { BOOKING_PAYMENT, BOOKING_STATUS, statusInfo } from "./shared";

const LIVE = ["pending", "confirmed", "deposit_paid", "paid"];
const FILTERS = {
  open: { label: "Upcoming", test: (b) => LIVE.includes(b.status) },
  pending: { label: "New", test: (b) => b.status === "pending" },
  confirmed: { label: "Awaiting deposit", test: (b) => b.status === "confirmed" },
  paid: { label: "Paid", test: (b) => b.status === "deposit_paid" || b.status === "paid" },
  completed: { label: "Travelled", test: (b) => b.status === "completed" },
  cancelled: { label: "Cancelled", test: (b) => b.status === "cancelled" },
  all: { label: "All", test: () => true },
};
const people = (b) => (Number(b.adults) || 0) + (Number(b.children) || 0);

export default function Bookings() {
  const { city } = useAdminCity();
  const { status, data, error } = useCollection("bookings");
  const trips = useCollection("trips").data;
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get("f")] ? params.get("f") : "open";
  const view = params.get("vista") === "salidas" ? "departures" : "list";
  const openId = params.get("id");
  const [query, setQuery] = useState("");

  const bookings = useMemo(
    () => data.filter((b) => cityOf(b) === city).map((b) => ({ ...b, _date: dayToDate(b.date), _created: recordDate(b) })),
    [data, city],
  );
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, bookings.filter(f.test).length])), [bookings]);
  const list = bookings
    .filter((b) => FILTERS[filter].test(b) && matches(query, b.ref, b.lead?.name, b.lead?.phone, b.lead?.email, b.tripTitle, ...(b.travelers || [])))
    .sort((a, b) => (filter === "open" ? (a._date?.getTime() || 0) - (b._date?.getTime() || 0) : (b._created?.getTime() || 0) - (a._created?.getTime() || 0)));
  const current = openId ? data.find((b) => b.id === openId) : null;

  // Seats per departure (trip + date), for planning vans and hotel rooms
  const departures = useMemo(() => {
    const groups = new Map();
    for (const b of bookings.filter((x) => LIVE.includes(x.status))) {
      const key = `${b.tripId}|${b.date}`;
      const g = groups.get(key) || { key, tripId: b.tripId, title: b.tripTitle, date: b._date, bookings: [], seats: 0, value: 0, paid: 0 };
      g.bookings.push(b);
      g.seats += people(b);
      g.value += Number(b.pricing?.total) || 0;
      g.paid += Number(b.amountPaid) || 0;
      groups.set(key, g);
    }
    const capacity = (tripId) => Number([...trips, ...DEFAULT_TRIPS].find((t) => t.id === tripId)?.groupSize) || 14;
    return [...groups.values()].map((g) => ({ ...g, capacity: capacity(g.tripId) })).sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
  }, [bookings, trips]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key !== "id" });
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Travel bookings"
        subtitle={`${CITIES[city]?.brand} · ${counts.pending} new request${counts.pending === 1 ? "" : "s"}`}
        actions={
          <>
            <Segmented
              label="View"
              value={view}
              onChange={(v) => setParam("vista", v === "departures" ? "salidas" : "")}
              options={[
                { value: "list", label: "Bookings", icon: ListBullets },
                { value: "departures", label: "Departures", icon: CalendarBlank },
              ]}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={DownloadSimple}
              disabled={!list.length}
              onClick={() =>
                downloadCsv(`bookings-${city}-${new Date().toISOString().slice(0, 10)}.csv`, [
                  { label: "Reference", value: (b) => b.ref },
                  { label: "Trip", value: (b) => b.tripTitle },
                  { label: "Date", value: (b) => b.date },
                  { label: "Adults", value: (b) => b.adults },
                  { label: "Children", value: (b) => b.children },
                  { label: "Lead traveller", value: (b) => b.lead?.name },
                  { label: "Phone", value: (b) => b.lead?.phone },
                  { label: "Email", value: (b) => b.lead?.email },
                  { label: "Other travellers", value: (b) => (b.travelers || []).join(" | ") },
                  { label: "Total", value: (b) => b.pricing?.total },
                  { label: "Deposit", value: (b) => b.pricing?.deposit },
                  { label: "Paid", value: (b) => b.amountPaid || 0 },
                  { label: "Status", value: (b) => b.status },
                ], list)
              }
            >
              Export CSV
            </Button>
          </>
        }
      />
      <ErrorNote error={error} />

      {view === "departures" ? (
        <Card flush title="Upcoming departures">
          {departures.length ? (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Departure</th>
                    <th>Trip</th>
                    <th>Seats</th>
                    <th className="num">Bookings</th>
                    <th className="num">Value</th>
                    <th className="num">Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {departures.map((g) => (
                    <tr key={g.key}>
                      <td className="strong">{weekdayDate(g.date)}</td>
                      <td>{g.title}</td>
                      <td>
                        <div className="ad-meter" role="img" aria-label={`${g.seats} of ${g.capacity} seats`}>
                          <span style={{ width: `${Math.min(100, (g.seats / g.capacity) * 100)}%` }} className={g.seats > g.capacity ? "is-over" : ""} />
                        </div>
                        <span className="ad-cell-sub">
                          {g.seats} / {g.capacity} seats
                        </span>
                      </td>
                      <td className="num">{g.bookings.length}</td>
                      <td className="num">{money(g.value, { whole: true })}</td>
                      <td className="num">{money(g.paid, { whole: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={CalendarBlank} title="No upcoming departures with bookings" />
          )}
        </Card>
      ) : (
        <>
          <div className="ad-toolbar">
            <Tabs label="Booking filters" value={filter} onChange={(k) => setParam("f", k === "open" ? "" : k)} tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: counts[key] }))} />
            <SearchInput value={query} onChange={setQuery} placeholder="Reference, name, phone, trip…" />
          </div>
          <Card flush>
            <div className="ad-table-wrap">
              <table className="ad-table ad-table--click">
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Departure</th>
                    <th>Travellers</th>
                    <th>Lead traveller</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                {status === "loading" ? (
                  <LoadingRows cols={6} />
                ) : (
                  <tbody>
                    {list.map((b) => {
                      const st = statusInfo(BOOKING_STATUS, b.status);
                      return (
                        <tr key={b.id} onClick={() => setParam("id", b.id)}>
                          <td>
                            <button type="button" className="ad-rowlink" onClick={() => setParam("id", b.id)}>
                              {b.tripTitle || b.tripId}
                            </button>
                            <span className="ad-cell-sub">
                              {b.ref} · {timeAgo(b._created)}
                            </span>
                          </td>
                          <td>{weekdayDate(b._date)}</td>
                          <td>
                            <span className="ad-cell-main">
                              {b.adults} adult{b.adults === 1 ? "" : "s"}
                              {b.children ? ` · ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}
                            </span>
                            {b.singleRoom && <span className="ad-cell-sub">Single room</span>}
                          </td>
                          <td>
                            <span className="ad-cell-main">{b.lead?.name || "—"}</span>
                            <span className="ad-cell-sub">{phonePretty(b.lead?.phone)}</span>
                          </td>
                          <td className="num">
                            <span className="ad-cell-main strong">{money(b.pricing?.total || 0)}</span>
                            <span className="ad-cell-sub">{Number(b.amountPaid) > 0 ? `${money(b.amountPaid)} paid` : `deposit ${money(b.pricing?.deposit || 0)}`}</span>
                          </td>
                          <td>
                            <Pill tone={st.tone}>{st.label}</Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                )}
              </table>
            </div>
            {status !== "loading" && !list.length && <Empty icon={AirplaneTilt} title="No bookings here" text="Bookings made on the website appear here instantly." />}
          </Card>
        </>
      )}

      <BookingDrawer key={`${openId}-${current ? 1 : 0}`} booking={current} onClose={() => setParam("id", "")} />
    </div>
  );
}

function bookingMessage(b, status) {
  const first = (b.lead?.name || "").split(" ")[0];
  const date = weekdayDate(dayToDate(b.date));
  const total = money(b.pricing?.total || 0);
  const deposit = money(b.pricing?.deposit || 0);
  if (b.lang === "en") {
    if (status === "confirmed") return `Hi ${first}! Your spot on "${b.tripTitle}" (${date}) is available ✅ Booking ${b.ref}. Total ${total}. To hold it, please send the ${deposit} deposit.`;
    return `Hi ${first}! Thanks for your payment for "${b.tripTitle}" (${date}). Booking ${b.ref} is confirmed. See you soon! ✈️`;
  }
  if (status === "confirmed") return `¡Hola ${first}! Hay lugar en "${b.tripTitle}" (${date}) ✅ Reserva ${b.ref}. Total ${total}. Para asegurar tu lugar, envía el depósito de ${deposit}.`;
  return `¡Hola ${first}! Recibimos tu pago de "${b.tripTitle}" (${date}). Tu reserva ${b.ref} está confirmada. ¡Nos vemos pronto! ✈️`;
}

function BookingDrawer({ booking, onClose }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState(() => ({ amountPaid: booking?.amountPaid ?? 0, note: booking?.adminNote || "" }));
  if (!booking) return null;
  const b = booking;
  const st = statusInfo(BOOKING_STATUS, b.status);
  const p = b.pricing || {};
  const dirty = Number(draft.amountPaid || 0) !== Number(b.amountPaid || 0) || draft.note !== (b.adminNote || "");

  const save = async (patch, message, key = "save") => {
    setBusy(key);
    try {
      await admin.updateRecord("bookings", b.id, patch);
      toast.success(message);
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your connection and permissions.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Drawer open onClose={onClose} title={`Booking ${b.ref || ""}`} className="ad-drawer">
      <div className="ad-detail">
        <div className="ad-detail__meta">
          <Pill tone={st.tone}>{st.label}</Pill>
          <span>Booked {timeAgo(recordDate(b))}</span>
        </div>

        <section className="ad-detail__sec">
          <p className="ad-detail__name">{b.tripTitle}</p>
          <ul className="ad-facts">
            <li>
              <CalendarBlank size={18} weight="duotone" /> {weekdayDate(dayToDate(b.date))}
              {b.departureTime ? ` · departs ${b.departureTime}` : ""}
            </li>
            <li>
              <UsersThree size={18} weight="duotone" /> {b.adults} adult{b.adults === 1 ? "" : "s"}
              {b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}
              {b.singleRoom ? " · single room" : ""}
            </li>
            {b.confirms?.passport && (
              <li>
                <IdentificationCard size={18} weight="duotone" /> Confirmed everyone has a passport
              </li>
            )}
          </ul>
          <Link to={`/viajes/${encodeURIComponent(b.tripId)}`} target="_blank" className="ad-link">
            View trip page
          </Link>
        </section>

        <section className="ad-detail__sec">
          <h3>Lead traveller</h3>
          <p className="ad-detail__name">{b.lead?.name || "—"}</p>
          <div className="ad-contact">
            {b.lead?.phone && (
              <>
                <Button href={telHref(b.lead.phone)} size="sm" variant="secondary" icon={Phone}>
                  {phonePretty(b.lead.phone)}
                </Button>
                <Button href={waHref(b.lead.phone)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={WhatsappLogo}>
                  WhatsApp
                </Button>
              </>
            )}
            {b.lead?.email && (
              <Button href={`mailto:${b.lead.email}`} size="sm" variant="secondary">
                {b.lead.email}
              </Button>
            )}
          </div>
          {b.travelers?.length > 0 && (
            <p className="ad-hint">
              <strong>Also travelling:</strong> {b.travelers.join(", ")}
            </p>
          )}
          {b.requests && <p className="ad-quote">“{b.requests}”</p>}
        </section>

        <section className="ad-detail__sec">
          <h3>Price</h3>
          <dl className="ad-totals">
            <div>
              <dt>
                {b.adults} × {money(p.adultUnit || 0)}
                {b.children ? ` + ${b.children} × ${money(p.childUnit || 0)}` : ""}
              </dt>
              <dd>{money(p.base || 0)}</dd>
            </div>
            {Number(p.discount) > 0 && (
              <div>
                <dt>
                  {p.discountKind === "group" ? "Group discount" : "Offer"} (−{p.discountPct}%)
                </dt>
                <dd>−{money(p.discount)}</dd>
              </div>
            )}
            {Number(p.supplement) > 0 && (
              <div>
                <dt>Single room</dt>
                <dd>+{money(p.supplement)}</dd>
              </div>
            )}
            <div className="ad-totals__total">
              <dt>Total</dt>
              <dd>{money(p.total || 0)}</dd>
            </div>
            <div>
              <dt>Deposit ({p.depositPct || 0}%)</dt>
              <dd>{money(p.deposit || 0)}</dd>
            </div>
          </dl>
          <p className="ad-hint">Prefers to pay with {BOOKING_PAYMENT[b.payPref] || b.payPref || "—"}. Prices were calculated on the website — double-check before confirming.</p>
          <div className="form-grid">
            <TextField label="Amount received (CAD)" type="number" min="0" step="1" value={draft.amountPaid} onChange={(e) => setDraft((d) => ({ ...d, amountPaid: e.target.value }))} />
            <TextAreaField className="span-2" label="Internal note" rows={2} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </div>
          {dirty && (
            <Button size="sm" loading={busy === "save"} onClick={() => save({ amountPaid: Number(draft.amountPaid) || 0, adminNote: draft.note.trim() }, "Booking updated")}>
              Save changes
            </Button>
          )}
        </section>

        {b.lead?.phone && (
          <section className="ad-detail__sec">
            <h3>Quick WhatsApp messages</h3>
            <div className="ad-templates">
              {[
                ["Spot available — ask for deposit", "confirmed"],
                ["Payment received", "paid"],
              ].map(([label, kind]) => (
                <a key={kind} className="ad-template" href={waHref(b.lead.phone, bookingMessage(b, kind))} target="_blank" rel="noreferrer">
                  <ChatCircleText size={18} weight="duotone" />
                  <span>
                    <strong>{label}</strong>
                    {bookingMessage(b, kind)}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="ad-detail__sec">
          <h3>Status</h3>
          <div className="ad-status-grid">
            {BOOKING_STATUS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`ad-status-btn ad-status-btn--${s.tone} ${b.status === s.key ? "is-current" : ""}`}
                aria-pressed={b.status === s.key}
                disabled={busy === s.key}
                onClick={() => {
                  if (b.status === s.key) return;
                  const patch = { status: s.key };
                  if (s.key === "paid" && !Number(b.amountPaid)) patch.amountPaid = Number(p.total) || 0;
                  if (s.key === "deposit_paid" && !Number(b.amountPaid)) patch.amountPaid = Number(p.deposit) || 0;
                  if (patch.amountPaid != null) setDraft((d) => ({ ...d, amountPaid: patch.amountPaid }));
                  save(patch, `Booking: ${s.label}`, s.key);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      </div>
    </Drawer>
  );
}
