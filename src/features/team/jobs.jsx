import { createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { AirplaneTilt, CalendarBlank, Car, CurrencyDollar, MapPin, NavigationArrow, Package, Suitcase, Users, UsersThree } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { useI18n } from "@/i18n";
import { deliveryStep } from "@/lib/dispatch";
import { formatDate, formatTime, isoDay, money, toDate } from "@/lib/format";
import { jobTime } from "./useTeam";

/** staff, jobs, now and the job actions — provided by the app shell. */
export const TeamContext = createContext(null);
export const useTeam = () => useContext(TeamContext);

export const KIND_ICON = { rides: Car, deliveries: Package, trips: AirplaneTilt };
export const jobPath = (kind, job) => `/equipo/trabajo/${kind}/${encodeURIComponent(job.id)}`;

/** "Now", "Today 3:30 p.m.", "Tomorrow 9:00 a.m." or "Sat, May 2 · 6:00 a.m.". */
export function useWhen() {
  const { t, lang } = useI18n();
  const { now } = useTeam();
  return (kind, job) => {
    if (kind === "rides" && job.schedule?.type !== "later") return t("team.now");
    if (kind === "deliveries") return t("team.now");
    const at = jobTime(kind, job);
    const day = isoDay(at);
    const today = isoDay(new Date(now));
    const tomorrow = isoDay(new Date(now + 24 * 3600 * 1000));
    const time = kind === "trips" && !job.time ? "" : ` · ${formatTime(at, lang)}`;
    if (day === today) return `${t("team.today")}${time}`;
    if (day === tomorrow) return `${t("team.tomorrow")}${time}`;
    return `${formatDate(at, lang, { weekday: "short", day: "numeric", month: "short" })}${time}`;
  };
}

/** "3 min" / "2 h" since a job came in. */
export function useAgo() {
  const { now } = useTeam();
  return (value) => {
    const d = toDate(value);
    if (!d) return "";
    const mins = Math.max(0, Math.round((now - d.getTime()) / 60000));
    if (mins < 60) return `${mins} min`;
    const h = Math.round(mins / 60);
    return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
  };
}

export const ridePrice = (r) =>
  r.fare != null && r.fare !== "" ? money(r.fare) : r.estimate ? `${money(r.estimate.low, { whole: true })}–${money(r.estimate.high, { whole: true })}` : null;

export const orderTotal = (o) => Number(o.total?.finalTotal) || 0;

/** Status label for a job this employee took. */
export function myStatus(t, kind, job) {
  if (kind === "rides") return t(`team.status.${job.status}`);
  if (kind === "deliveries") {
    const step = deliveryStep(job);
    return step === "assigned" ? t("team.status.trip_assigned") : t(`team.status.${step}`);
  }
  return job.stage === "completed" ? t("team.status.completed") : t(`team.status.trip_${job.stage}`);
}

function RideBody({ job }) {
  const { t } = useI18n();
  const price = ridePrice(job);
  return (
    <>
      <div className="tj-route">
        <span>
          <MapPin size={18} weight="fill" className="tj-route__a" />
          <span>{job.pickup?.address || t("team.gps")}</span>
        </span>
        <span>
          <NavigationArrow size={18} weight="fill" className="tj-route__b" />
          <span>
            {job.dropoff?.address}
            {job.dropoff?.km ? <em> · {t("team.km", { km: job.dropoff.km })}</em> : null}
          </span>
        </span>
      </div>
      <div className="tj-meta">
        <span>
          <Users size={16} weight="bold" /> {job.passengers || 1}
        </span>
        {job.luggage > 0 && (
          <span>
            <Suitcase size={16} weight="bold" /> {job.luggage}
          </span>
        )}
        {job.vehicle === "xl" && <span className="tj-tag">XL</span>}
        <span>{t(`team.payWith.${job.payment || "cash"}`)}</span>
        <strong className="tj-price">{price || t("team.quote")}</strong>
      </div>
    </>
  );
}

function DeliveryBody({ job }) {
  const { t } = useI18n();
  const ci = job.customerInfo || {};
  const cash = job.paymentMethodKey === "cash" && job.payment !== "Success";
  return (
    <>
      <div className="tj-route">
        <span>
          <MapPin size={18} weight="fill" className="tj-route__b" />
          <span>{[ci.address, ci.city].filter(Boolean).join(", ")}</span>
        </span>
      </div>
      <div className="tj-meta">
        <span>
          <Package size={16} weight="bold" /> {t("team.delivery.items", { n: job.productsCount || (job.products || []).length })}
        </span>
        <span>{cash ? t("team.delivery.collect", { amount: money(orderTotal(job)) }) : job.payment === "Success" ? t("team.delivery.paid") : t(`team.payWith.${job.paymentMethodKey || "cash"}`)}</span>
        <strong className="tj-price">{money(orderTotal(job))}</strong>
      </div>
    </>
  );
}

function TripBody({ job }) {
  const { t } = useI18n();
  return (
    <>
      <strong className="tj-trip">{job.title}</strong>
      <div className="tj-meta">
        <span>
          <CalendarBlank size={16} weight="bold" /> {job.time ? t("team.trip.departs", { time: job.time }) : job.date}
        </span>
        <span>
          <UsersThree size={16} weight="bold" /> {t("team.trip.travellers", { n: job.people })}
        </span>
        <span>{t("team.trip.bookings", { n: job.bookings.length })}</span>
      </div>
    </>
  );
}

const BODY = { rides: RideBody, deliveries: DeliveryBody, trips: TripBody };

/** A job in a list: what, where, when — and "Accept" for open jobs. */
export function JobCard({ kind, job, mine = false }) {
  const { t } = useI18n();
  const { act, busy } = useTeam();
  const when = useWhen();
  const ago = useAgo();
  const Icon = KIND_ICON[kind];
  const Body = BODY[kind];
  const ref = kind === "rides" ? job.ref : kind === "deliveries" ? job.orderNumber : "";
  const urgent = kind === "rides" && job.schedule?.type !== "later";
  const acceptLabel = kind === "rides" ? t("team.ride.accept") : kind === "deliveries" ? t("team.delivery.accept") : t("team.trip.accept");

  return (
    <article className={`tj tj--${kind} ${mine ? "is-mine" : ""}`}>
      <Link to={jobPath(kind, job)} className="tj__link" aria-label={`${t("team.seeDetails")} ${ref}`}>
        <header className="tj__head">
          <span className="tj__kind">
            <Icon size={16} weight="fill" /> {t(`team.skills.${kind}`)}
          </span>
          <span className={`tj__when ${urgent && !mine ? "is-urgent" : ""}`}>{when(kind, job)}</span>
          {mine ? <span className="tj__status">{myStatus(t, kind, job)}</span> : kind !== "trips" && <span className="tj__ago">{ago(job.createdAt)}</span>}
        </header>
        {ref && <span className="tj__ref">{ref}</span>}
        <Body job={job} />
      </Link>
      {!mine && (
        <Button block size="lg" icon={kind === "rides" ? Car : kind === "deliveries" ? Package : AirplaneTilt} loading={busy === `accept:${job.id}`} disabled={Boolean(busy)} onClick={() => act.accept(kind, job)}>
          {acceptLabel}
        </Button>
      )}
    </article>
  );
}

export function MoneyLine({ label, value }) {
  return (
    <span className="tj-money">
      <CurrencyDollar size={18} weight="bold" /> {label} <strong>{value}</strong>
    </span>
  );
}
