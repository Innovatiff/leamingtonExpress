// Employees inside the admin: who is online, what each one may do and what
// they are working on, plus the "assign an employee" box used by the Rides,
// Orders and Bookings drawers.
import { useMemo, useState } from "react";
import { AirplaneTilt, ArrowsClockwise, Car, Package, Phone, UserMinus, WhatsappLogo } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { deliveryStep, RIDE_ACTIVE, vehicleText } from "@/lib/dispatch";
import { toDate } from "@/lib/format";
import { initials } from "@/lib/text";
import { dayToDate, phonePretty, recordDate, telHref, timeAgo, useCollection, useNow, waHref } from "../lib";
import { rideWhen } from "../pages/shared";
import { Pill } from "./AdminUI";

export const SKILL_INFO = {
  rides: { label: "Rides", icon: Car, text: "Picks up customers who ask for a ride." },
  deliveries: { label: "Deliveries", icon: Package, text: "Takes store orders to the customer’s door." },
  trips: { label: "Trips", icon: AirplaneTilt, text: "Drives or guides travel departures." },
};

// The employee app checks in every minute while it is open.
const ONLINE_MS = 5 * 60 * 1000;

export function presence(s, now) {
  if (s?.active === false) return { key: "inactive", label: "Inactive", tone: "neutral" };
  const seen = toDate(s?.lastSeenAt);
  if (s?.online && seen && now - seen.getTime() < ONLINE_MS) return { key: "online", label: "Online", tone: "green", seen };
  if (s?.online) return { key: "away", label: "App closed", tone: "amber", seen };
  return { key: "offline", label: "Offline", tone: "neutral", seen };
}

const RANK = { online: 0, away: 1, offline: 2, inactive: 3 };

/** The whole team, online first. */
export function useStaffList() {
  const { status, data, error } = useCollection("staff");
  const now = useNow(30000);
  const list = useMemo(
    () =>
      data
        .map((s) => ({ ...s, uid: s.uid || s.id, _presence: presence(s, now) }))
        .sort((a, b) => RANK[a._presence.key] - RANK[b._presence.key] || String(a.name).localeCompare(String(b.name))),
    [data, now],
  );
  return { status, list, error, now };
}

/** Active employees allowed to take this kind of job in this city. */
export const ableTo = (list, skill, city) =>
  list.filter((s) => s.active !== false && s.can?.[skill] && (!city || !s.cities?.length || s.cities.includes(city)));

/* ------------------------------ Their work ------------------------------- */
const DAY = 86400000;

/**
 * What each employee is doing now, what they took for later (scheduled rides,
 * future departures) and how much they finished in the last 30 days.
 * → Map uid → { active: [{ kind, id, label, to }], upcoming: [...], done: number }
 */
export function useTeamWork() {
  const rides = useCollection("rides").data;
  const orders = useCollection("orders").data;
  const bookings = useCollection("bookings").data;
  const now = useNow();
  return useMemo(() => {
    const out = new Map();
    const of = (uid) => {
      if (!out.has(uid)) out.set(uid, { active: [], upcoming: [], done: 0 });
      return out.get(uid);
    };
    const recent = (d) => d && now - d.getTime() < 30 * DAY;
    const today = new Date(now);
    today.setHours(23, 59, 59, 999);

    for (const r of rides) {
      if (!r.driverUid) continue;
      if (RIDE_ACTIVE.includes(r.status)) {
        const job = { kind: "ride", id: r.id, label: `Ride ${r.ref || ""}`.trim(), to: `/admin/rides?id=${encodeURIComponent(r.id)}` };
        // a scheduled ride hours away is "taken", not "working"
        const later = r.status === "assigned" && r.schedule?.type === "later" && (rideWhen(r)?.getTime() || 0) - now > 2 * 3600 * 1000;
        of(r.driverUid)[later ? "upcoming" : "active"].push(job);
      } else if (r.status === "completed" && recent(toDate(r.completedAt) || recordDate(r))) of(r.driverUid).done += 1;
    }
    for (const o of orders) {
      if (!o.courierUid || o.status === "Cancelled") continue;
      const step = deliveryStep(o);
      if (step === "assigned" || step === "picked_up") of(o.courierUid).active.push({ kind: "delivery", id: o.id, label: `Delivery ${o.orderNumber || ""}`.trim(), to: `/admin/pedidos?id=${encodeURIComponent(o.id)}` });
      else if (step === "delivered" && recent(toDate(o.deliveredAt) || toDate(o.fulfilledAt) || recordDate(o))) of(o.courierUid).done += 1;
    }
    // One departure = every booking of the same trip and date
    const seen = new Set();
    for (const b of bookings) {
      if (!b.guideUid || b.status === "cancelled") continue;
      const key = `${b.guideUid}|${b.tripId}|${b.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (b.tripStage === "assigned" || b.tripStage === "picked_up") {
        const job = { kind: "trip", id: b.id, label: b.tripTitle || "Trip", date: dayToDate(b.date), to: `/admin/reservas?id=${encodeURIComponent(b.id)}` };
        const later = b.tripStage === "assigned" && job.date && job.date > today;
        of(b.guideUid)[later ? "upcoming" : "active"].push(job);
      }
      else if ((b.tripStage === "completed" || b.status === "completed") && recent(toDate(b.completedAt) || recordDate(b))) of(b.guideUid).done += 1;
    }
    return out;
  }, [rides, orders, bookings, now]);
}

/* -------------------------------- Pieces --------------------------------- */
export function Avatar({ staff, size = 40, dot }) {
  return (
    <span className="ad-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {staff?.photo ? <img src={staff.photo} alt="" /> : initials(staff?.name || "?")}
      {dot && <i className={`ad-avatar__dot is-${dot}`} />}
    </span>
  );
}

export function SkillChips({ can, compact }) {
  return (
    <span className={`ad-skills ${compact ? "ad-skills--compact" : ""}`}>
      {Object.entries(SKILL_INFO).map(([key, info]) => (
        <span key={key} className={`ad-skill ${can?.[key] ? "is-on" : ""}`} title={can?.[key] ? `Can do ${info.label.toLowerCase()}` : `No ${info.label.toLowerCase()}`}>
          <info.icon size={14} weight={can?.[key] ? "fill" : "regular"} aria-hidden="true" />
          {info.label}
          <span className="sr-only">{can?.[key] ? ": allowed" : ": not allowed"}</span>
        </span>
      ))}
    </span>
  );
}

/** "Honda CR-V · Negra" + plate */
export function VehicleLine({ vehicle }) {
  const text = vehicleText(vehicle);
  if (!text && !vehicle?.plate) return null;
  return (
    <span className="ad-vehicle">
      <Car size={15} weight="duotone" aria-hidden="true" />
      {text}
      {vehicle?.plate && <span className="trk-plate">{vehicle.plate}</span>}
    </span>
  );
}

/** Employee picker: online people first, busy ones marked. */
export function StaffSelect({ skill, city, value, onChange, disabled, label, placeholder }) {
  const { list } = useStaffList();
  const work = useTeamWork();
  const able = ableTo(list, skill, city);
  const online = able.filter((s) => s._presence.key === "online");
  const rest = able.filter((s) => s._presence.key !== "online");
  const option = (s) => {
    const busy = work.get(s.uid)?.active.length;
    return (
      <option key={s.uid} value={s.uid}>
        {s.name}
        {s.vehicle?.make ? ` · ${vehicleText(s.vehicle)}` : ""}
        {busy ? ` · busy (${busy})` : ""}
      </option>
    );
  };
  return (
    <label className="ad-select ad-select--block">
      <span>{label}</span>
      <select value={value || ""} disabled={disabled} onChange={(e) => onChange(able.find((s) => s.uid === e.target.value) || null)}>
        <option value="">{able.length ? placeholder || "Choose an employee…" : `Nobody can do ${SKILL_INFO[skill].label.toLowerCase()} yet`}</option>
        {online.length > 0 && <optgroup label="Online now">{online.map(option)}</optgroup>}
        {rest.length > 0 && <optgroup label={online.length ? "Not online" : "Team"}>{rest.map(option)}</optgroup>}
      </select>
    </label>
  );
}

/**
 * The "who does this job" section of a drawer.
 * assigned = the snapshot saved on the record ({ uid, name, phone, vehicle… }) or null.
 */
export function AssignBox({ title, skill, city, assigned, onAssign, busy, locked, lockedText, hint }) {
  const { list } = useStaffList();
  const [changing, setChanging] = useState(false);
  const live = assigned?.uid ? list.find((s) => s.uid === assigned.uid) : null;
  const person = live ? { ...assigned, ...live, vehicle: assigned.vehicle?.plate || assigned.vehicle?.make ? assigned.vehicle : live.vehicle } : assigned;
  const pick = async (staff) => {
    if (!staff) return;
    await onAssign(staff);
    setChanging(false);
  };

  return (
    <section className="ad-detail__sec">
      <h3>{title}</h3>
      {person?.name && !changing ? (
        <>
          <div className="ad-assigned">
            <Avatar staff={person} size={46} dot={live?._presence.key} />
            <div className="ad-assigned__body">
              <strong>{person.name}</strong>
              <VehicleLine vehicle={person.vehicle} />
              <span className="ad-assigned__meta">
                {live ? (
                  <Pill tone={live._presence.tone}>{live._presence.label}</Pill>
                ) : assigned.uid ? (
                  <Pill tone="neutral">No longer on the team</Pill>
                ) : (
                  <Pill tone="neutral">Entered by hand</Pill>
                )}
                {person.phone && <span>{phonePretty(person.phone)}</span>}
              </span>
            </div>
            {person.phone && (
              <div className="ad-assigned__call">
                <Button href={telHref(person.phone)} size="sm" variant="secondary" square icon={Phone} aria-label={`Call ${person.name}`} />
                <Button href={waHref(person.phone)} target="_blank" rel="noreferrer" size="sm" variant="secondary" square icon={WhatsappLogo} aria-label={`WhatsApp ${person.name}`} />
              </div>
            )}
          </div>
          {!locked && (
            <div className="ad-assigned__tools">
              <Button size="sm" variant="secondary" icon={ArrowsClockwise} onClick={() => setChanging(true)} disabled={busy}>
                Change
              </Button>
              <Button size="sm" variant="ghost" icon={UserMinus} className="ad-danger-text" loading={busy} onClick={() => onAssign(null)}>
                Remove
              </Button>
            </div>
          )}
        </>
      ) : locked ? (
        <p className="ad-hint">{lockedText || "Nobody was assigned."}</p>
      ) : (
        <div className="ad-assign-pick">
          <StaffSelect skill={skill} city={city} value="" onChange={pick} disabled={busy} label={changing ? "Give it to" : "Assign to"} />
          {changing && (
            <Button size="sm" variant="ghost" onClick={() => setChanging(false)}>
              Keep {person?.name?.split(" ")[0]}
            </Button>
          )}
        </div>
      )}
      {hint && !locked && <p className="ad-hint">{hint}</p>}
    </section>
  );
}

/** One line for a list: "Carlos M. · 5 min ago". */
export function lastSeenText(s) {
  const p = s?._presence;
  if (!p) return "";
  if (p.key === "online") return "Online now";
  if (p.key === "inactive") return "Can’t sign in";
  return p.seen ? `Last seen ${timeAgo(p.seen)}` : "Never signed in";
}
