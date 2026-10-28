import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Baby,
  Car,
  ChatCircleText,
  Clock,
  DownloadSimple,
  MapPin,
  NavigationArrow,
  PawPrint,
  Phone,
  Suitcase,
  Users,
  Van,
  WhatsappLogo,
  Wheelchair,
} from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Drawer } from "@/components/ui/Overlay";
import { CITIES } from "@/config/cities";
import { useToast } from "@/context/ToastContext";
import { money } from "@/lib/format";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, Tabs, useAdminCity } from "../components/AdminUI";
import { cityOf, dateTime, directionsHref, downloadCsv, mapsHref, matches, phonePretty, recordDate, telHref, timeAgo, useCollection, waHref } from "../lib";
import { RIDE_PAYMENT, RIDE_STATUS, rideWhen, statusInfo } from "./shared";

const ACTIVE = ["requested", "confirmed", "assigned"];
const FILTERS = {
  active: { label: "Active", test: (r) => ACTIVE.includes(r.status) },
  requested: { label: "New", test: (r) => r.status === "requested" },
  confirmed: { label: "Confirmed", test: (r) => r.status === "confirmed" },
  assigned: { label: "Driver assigned", test: (r) => r.status === "assigned" },
  completed: { label: "Completed", test: (r) => r.status === "completed" },
  cancelled: { label: "Cancelled", test: (r) => r.status === "cancelled" },
  all: { label: "All", test: () => true },
};

const priceText = (r) => (r.fare != null && r.fare !== "" ? money(r.fare) : r.estimate ? `${money(r.estimate.low, { whole: true })}–${money(r.estimate.high, { whole: true })}` : "Quote");
const pickupQuery = (r) => (r.pickup?.lat ? `${r.pickup.lat},${r.pickup.lng}` : r.pickup?.address || "");

export default function Rides() {
  const { city } = useAdminCity();
  const { status, data, error } = useCollection("rides");
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get("f")] ? params.get("f") : "active";
  const openId = params.get("id");
  const [query, setQuery] = useState("");

  const rides = useMemo(() => data.filter((r) => cityOf(r) === city).map((r) => ({ ...r, _when: rideWhen(r), _created: recordDate(r) })), [data, city]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, rides.filter(f.test).length])), [rides]);
  const list = rides
    .filter((r) => FILTERS[filter].test(r) && matches(query, r.ref, r.contact?.name, r.contact?.phone, r.pickup?.address, r.dropoff?.address))
    .sort((a, b) =>
      ACTIVE.includes(a.status) && ACTIVE.includes(b.status)
        ? (a._when?.getTime() || 0) - (b._when?.getTime() || 0)
        : (b._created?.getTime() || 0) - (a._created?.getTime() || 0),
    );
  const current = openId ? data.find((r) => r.id === openId) : null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "f" });
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Rides"
        subtitle={`${CITIES[city]?.brand} · ${counts.requested} new request${counts.requested === 1 ? "" : "s"}`}
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={DownloadSimple}
            disabled={!list.length}
            onClick={() =>
              downloadCsv(`rides-${city}-${new Date().toISOString().slice(0, 10)}.csv`, [
                { label: "Reference", value: (r) => r.ref },
                { label: "Requested", value: (r) => r._created?.toISOString() || "" },
                { label: "When", value: (r) => (r.schedule?.type === "later" ? r._when?.toISOString() : "ASAP") },
                { label: "Pickup", value: (r) => r.pickup?.address },
                { label: "Destination", value: (r) => r.dropoff?.address },
                { label: "Passengers", value: (r) => r.passengers },
                { label: "Vehicle", value: (r) => r.vehicle },
                { label: "Customer", value: (r) => r.contact?.name },
                { label: "Phone", value: (r) => r.contact?.phone },
                { label: "Fare", value: (r) => r.fare ?? "" },
                { label: "Status", value: (r) => r.status },
              ], list)
            }
          >
            Export CSV
          </Button>
        }
      />
      <ErrorNote error={error} />
      <div className="ad-toolbar">
        <Tabs label="Ride filters" value={filter} onChange={(k) => setParam("f", k === "active" ? "" : k)} tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: counts[key] }))} />
        <SearchInput value={query} onChange={setQuery} placeholder="Reference, name, phone, address…" />
      </div>

      <Card flush>
        <div className="ad-table-wrap">
          <table className="ad-table ad-table--click">
            <thead>
              <tr>
                <th>When</th>
                <th>Route</th>
                <th>Riders</th>
                <th>Customer</th>
                <th className="num">Price</th>
                <th>Status</th>
              </tr>
            </thead>
            {status === "loading" ? (
              <LoadingRows cols={6} />
            ) : (
              <tbody>
                {list.map((r) => {
                  const st = statusInfo(RIDE_STATUS, r.status);
                  const asap = r.schedule?.type !== "later";
                  return (
                    <tr key={r.id} onClick={() => setParam("id", r.id)}>
                      <td>
                        <button type="button" className="ad-rowlink" onClick={() => setParam("id", r.id)}>
                          {asap ? "As soon as possible" : dateTime(r._when)}
                        </button>
                        <span className="ad-cell-sub">
                          {r.ref} · {timeAgo(r._created)}
                        </span>
                      </td>
                      <td className="ad-route-cell">
                        <span className="ad-cell-main">{r.pickup?.address || "—"}</span>
                        <span className="ad-cell-sub">→ {r.dropoff?.address || "—"}</span>
                      </td>
                      <td>
                        <span className="ad-cell-main">
                          {r.passengers || 1} <Users size={14} weight="bold" aria-label="passengers" />
                          {r.luggage ? (
                            <>
                              {" "}
                              · {r.luggage} <Suitcase size={14} weight="bold" aria-label="bags" />
                            </>
                          ) : null}
                        </span>
                        <span className="ad-cell-sub">{r.vehicle === "xl" ? "XL / Minivan" : "Standard"}</span>
                      </td>
                      <td>
                        <span className="ad-cell-main">{r.contact?.name || "—"}</span>
                        <span className="ad-cell-sub">{phonePretty(r.contact?.phone)}</span>
                      </td>
                      <td className="num strong">{priceText(r)}</td>
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
        {status !== "loading" && !list.length && <Empty icon={Car} title="No rides here" text="New ride requests from the website appear here instantly." />}
      </Card>

      <RideDrawer key={`${openId}-${current ? 1 : 0}`} ride={current} onClose={() => setParam("id", "")} />
    </div>
  );
}

function rideMessage(r, draft) {
  const first = (r.contact?.name || "").split(" ")[0];
  const when = r.schedule?.type === "later" ? dateTime(rideWhen(r)) : r.lang === "en" ? "as soon as possible" : "lo antes posible";
  const fare = draft.fare ? money(draft.fare) : "";
  const driver = draft.driverName ? `${draft.driverName}${draft.driverPhone ? ` (${phonePretty(draft.driverPhone)})` : ""}` : "";
  if (r.lang === "en") {
    return [
      `Hi ${first}! Your ride ${r.ref} is confirmed ✅`,
      `📍 ${r.pickup?.address} → ${r.dropoff?.address}`,
      `🕒 ${when}`,
      fare && `💵 Price: ${fare}`,
      driver && `🚗 Driver: ${driver}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `¡Hola ${first}! Tu ride ${r.ref} está confirmado ✅`,
    `📍 ${r.pickup?.address} → ${r.dropoff?.address}`,
    `🕒 ${when}`,
    fare && `💵 Precio: ${fare}`,
    driver && `🚗 Chofer: ${driver}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function RideDrawer({ ride, onClose }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState(() => ({
    fare: ride?.fare ?? (ride?.estimate ? Math.round((ride.estimate.low + ride.estimate.high) / 2) : ""),
    driverName: ride?.driver?.name || "",
    driverPhone: ride?.driver?.phone || "",
    note: ride?.adminNote || "",
  }));
  if (!ride) return null;
  const r = ride;
  const st = statusInfo(RIDE_STATUS, r.status);
  const when = rideWhen(r);
  const options = [
    r.options?.childSeat && { icon: Baby, label: "Child seat" },
    r.options?.wheelchair && { icon: Wheelchair, label: "Folding wheelchair" },
    r.options?.pet && { icon: PawPrint, label: "Pet" },
    r.options?.stops && { icon: MapPin, label: `Stops: ${r.stops || "—"}` },
  ].filter(Boolean);
  const dirty =
    String(draft.fare ?? "") !== String(r.fare ?? "") ||
    draft.driverName !== (r.driver?.name || "") ||
    draft.driverPhone !== (r.driver?.phone || "") ||
    draft.note !== (r.adminNote || "");

  const save = async (patch, message, key = "save") => {
    setBusy(key);
    try {
      await admin.updateRecord("rides", r.id, patch);
      toast.success(message);
    } catch (err) {
      console.error(err);
      toast.error("Could not save. Check your connection and permissions.");
    } finally {
      setBusy("");
    }
  };

  const details = () => ({
    fare: draft.fare === "" ? null : Number(draft.fare),
    driver: draft.driverName ? { name: draft.driverName.trim(), phone: draft.driverPhone.replace(/\D/g, "") } : null,
    adminNote: draft.note.trim(),
  });

  return (
    <Drawer open onClose={onClose} title={`Ride ${r.ref || ""}`} className="ad-drawer">
      <div className="ad-detail">
        <div className="ad-detail__meta">
          <Pill tone={st.tone}>{st.label}</Pill>
          <span>Requested {timeAgo(recordDate(r))}</span>
        </div>

        <section className="ad-detail__sec">
          <div className="ad-when">
            <Clock size={22} weight="duotone" />
            <div>
              <strong>{r.schedule?.type === "later" ? dateTime(when) : "As soon as possible"}</strong>
              <span>{r.schedule?.type === "later" ? "Scheduled ride" : `Asked ${timeAgo(recordDate(r))}`}</span>
            </div>
          </div>
          <div className="ad-route">
            <a href={mapsHref(pickupQuery(r))} target="_blank" rel="noreferrer">
              <MapPin size={18} weight="fill" />
              <span>
                <small>Pick-up</small>
                {r.pickup?.address || "—"}
                {r.pickup?.lat ? <em> (GPS)</em> : null}
              </span>
            </a>
            <a href={mapsHref(r.dropoff?.address || "")} target="_blank" rel="noreferrer">
              <NavigationArrow size={18} weight="fill" />
              <span>
                <small>Destination{r.dropoff?.km ? ` · ≈${r.dropoff.km} km` : ""}</small>
                {r.dropoff?.address || "—"}
              </span>
            </a>
          </div>
          <Button href={directionsHref(pickupQuery(r), r.dropoff?.address || "")} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={NavigationArrow}>
            Open directions
          </Button>
        </section>

        <section className="ad-detail__sec">
          <h3>Trip</h3>
          <ul className="ad-facts">
            <li>
              <Users size={18} weight="duotone" /> {r.passengers || 1} passenger{(r.passengers || 1) === 1 ? "" : "s"}
            </li>
            <li>
              <Suitcase size={18} weight="duotone" /> {r.luggage || 0} bag{r.luggage === 1 ? "" : "s"}
            </li>
            <li>
              {r.vehicle === "xl" ? <Van size={18} weight="duotone" /> : <Car size={18} weight="duotone" />} {r.vehicle === "xl" ? "XL / Minivan" : "Standard"}
            </li>
            {options.map((o) => (
              <li key={o.label}>
                <o.icon size={18} weight="duotone" /> {o.label}
              </li>
            ))}
          </ul>
          {r.notes && <p className="ad-quote">“{r.notes}”</p>}
          <p className="ad-hint">
            Pays with {RIDE_PAYMENT[r.payment] || r.payment || "—"}
            {r.estimate ? ` · website estimate ${money(r.estimate.low, { whole: true })}–${money(r.estimate.high, { whole: true })}` : " · no estimate shown (long trip)"}
          </p>
        </section>

        <section className="ad-detail__sec">
          <h3>Customer</h3>
          <p className="ad-detail__name">{r.contact?.name || "—"}</p>
          <div className="ad-contact">
            {r.contact?.phone && (
              <>
                <Button href={telHref(r.contact.phone)} size="sm" variant="secondary" icon={Phone}>
                  {phonePretty(r.contact.phone)}
                </Button>
                <Button href={waHref(r.contact.phone)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={WhatsappLogo}>
                  WhatsApp
                </Button>
              </>
            )}
            {r.contact?.email && (
              <Button href={`mailto:${r.contact.email}`} size="sm" variant="secondary">
                {r.contact.email}
              </Button>
            )}
          </div>
        </section>

        <section className="ad-detail__sec">
          <h3>Price & driver</h3>
          <div className="form-grid">
            <TextField label="Final price (CAD)" type="number" min="0" step="1" inputMode="decimal" value={draft.fare ?? ""} onChange={(e) => setDraft((d) => ({ ...d, fare: e.target.value }))} />
            <TextField label="Driver name" value={draft.driverName} onChange={(e) => setDraft((d) => ({ ...d, driverName: e.target.value }))} />
            <TextField label="Driver phone" inputMode="tel" value={draft.driverPhone} onChange={(e) => setDraft((d) => ({ ...d, driverPhone: e.target.value }))} />
            <TextAreaField className="span-2" label="Internal note" rows={2} value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </div>
          {dirty && (
            <Button size="sm" onClick={() => save(details(), "Ride updated")} loading={busy === "save"}>
              Save changes
            </Button>
          )}
          {r.contact?.phone && (
            <a className="ad-template" href={waHref(r.contact.phone, rideMessage(r, draft))} target="_blank" rel="noreferrer">
              <ChatCircleText size={18} weight="duotone" />
              <span>
                <strong>Send confirmation on WhatsApp</strong>
                {rideMessage(r, draft)}
              </span>
            </a>
          )}
        </section>

        <section className="ad-detail__sec">
          <h3>Status</h3>
          <div className="ad-status-grid">
            {RIDE_STATUS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`ad-status-btn ad-status-btn--${s.tone} ${r.status === s.key ? "is-current" : ""}`}
                aria-pressed={r.status === s.key}
                disabled={busy === s.key}
                onClick={() => r.status !== s.key && save({ ...details(), status: s.key, [`${s.key}At`]: new Date() }, `Ride: ${s.label}`, s.key)}
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
