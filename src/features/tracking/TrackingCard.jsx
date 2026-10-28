import { AirplaneTilt, CalendarBlank, Car, CheckCircle, MapPin, NavigationArrow, Package, Phone, ShareNetwork, UsersThree, WhatsappLogo, XCircle } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { SITE_NAME } from "@/config/site";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { vehicleText } from "@/lib/dispatch";
import { formatDate, formatTime, fromIsoDay, money, toDate } from "@/lib/format";
import { initials } from "@/lib/text";
import "./tracking.css";

const KIND_ICON = { ride: Car, order: Package, booking: AirplaneTilt };

// Which step of the progress bar each stage lights up, and the time stamp of each step
const STEP_OF = {
  ride: { searching: 0, assigned: 1, arrived: 1, in_progress: 2, completed: 3 },
  order: { awaitingPayment: 0, received: 0, preparing: 1, onTheWay: 2, delivered: 3 },
  booking: { pending: 0, confirmed: 1, assigned: 2, on_trip: 3, completed: 4 },
};
const STEP_TIMES = {
  ride: ["created", "assigned", "pickedUp", "completed"],
  order: ["created", "assigned", "pickedUp", "completed"],
  booking: ["created", "confirmed", "assigned", "pickedUp", "completed"],
};
const DONE = ["completed", "delivered"];

export const trackUrl = (token) => `${window.location.origin}/seguimiento/${token}`;

const LATER_MS = 45 * 60 * 1000;

/** Headline + explanation for the current stage, with the employee's name when there is one. */
export function stageText(t, view, now = Date.now()) {
  const name = view.staff?.name;
  let key = `track.${view.kind}.${view.stage}`;
  // Scheduled ride taken well in advance: the driver isn't driving to you yet
  if (view.kind === "ride" && view.stage === "assigned" && !view.detail?.asap && new Date(view.detail?.when || 0).getTime() - now > LATER_MS) {
    key = "track.ride.assignedLater";
  }
  if (!name) {
    if ((view.kind === "ride" && ["assigned", "arrived"].includes(view.stage)) || (view.kind === "booking" && view.stage === "assigned")) {
      return { title: t(`${key}NoName`), text: t(`${key}Text`) };
    }
    if (view.kind === "order" && ["preparing", "onTheWay"].includes(view.stage)) return { title: t(key), text: t(`${key}NoName`) };
  }
  return { title: t(key, { name }), text: t(`${key}Text`, { name }) };
}

export function StaffCard({ view }) {
  const { t } = useI18n();
  const s = view.staff;
  if (!s) return null;
  const v = s.vehicle;
  return (
    <div className="trk-staff">
      <span className="trk-staff__avatar" aria-hidden="true">
        {s.photo ? <img src={s.photo} alt="" /> : initials(s.name) || "?"}
      </span>
      <div className="trk-staff__body">
        <span className="trk-staff__role">{t(`track.staffRole.${view.kind}`)}</span>
        <strong className="trk-staff__name">{s.name}</strong>
        {v && (
          <span className="trk-staff__car">
            {vehicleText(v)}
            {v.plate && (
              <span className="trk-plate" title={t("track.plate")}>
                {v.plate}
              </span>
            )}
          </span>
        )}
      </div>
      {s.phone && (
        <div className="trk-staff__actions">
          <Button href={`tel:+1${s.phone.slice(-10)}`} size="sm" variant="secondary" icon={Phone}>
            {t("track.call")}
          </Button>
          <Button href={`https://wa.me/1${s.phone.slice(-10)}`} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={WhatsappLogo} className="trk-wa">
            {t("track.whatsapp")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Details({ view }) {
  const { t, lang } = useI18n();
  const d = view.detail || {};
  if (view.kind === "ride") {
    const when = d.asap ? t("track.asap") : formatDate(toDate(d.when), lang, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    return (
      <div className="trk-details">
        <div className="trk-route">
          <span>
            <MapPin size={18} weight="fill" className="trk-route__a" />
            <span>
              <small>{t("track.from")}</small>
              {d.from}
            </span>
          </span>
          <span>
            <NavigationArrow size={18} weight="fill" className="trk-route__b" />
            <span>
              <small>{t("track.to")}</small>
              {d.to}
            </span>
          </span>
        </div>
        <ul className="trk-facts">
          <li>
            <CalendarBlank size={18} weight="duotone" /> {when}
          </li>
          <li>
            <UsersThree size={18} weight="duotone" /> {t("track.pax", { n: d.pax })}
          </li>
          {(d.fare != null || d.estimate) && (
            <li>
              <strong>{d.fare != null ? `${t("track.fare")}: ${money(d.fare)}` : `${t("track.estimate")}: ${money(d.estimate.low, { whole: true })}–${money(d.estimate.high, { whole: true })}`}</strong>
            </li>
          )}
        </ul>
      </div>
    );
  }
  if (view.kind === "order") {
    return (
      <ul className="trk-facts trk-details">
        <li>
          <Package size={18} weight="duotone" /> {t("track.items", { n: d.items })} · {t("track.total")} <strong>{money(d.total)}</strong>
        </li>
        {d.address && (
          <li>
            <MapPin size={18} weight="duotone" /> {t("track.deliverTo")}: {d.address}
          </li>
        )}
      </ul>
    );
  }
  const date = fromIsoDay(d.date);
  return (
    <ul className="trk-facts trk-details">
      <li>
        <AirplaneTilt size={18} weight="duotone" /> <strong>{d.trip}</strong>
      </li>
      <li>
        <CalendarBlank size={18} weight="duotone" /> {date ? formatDate(date, lang, { weekday: "long", day: "numeric", month: "long" }) : d.date}
        {d.time ? ` · ${t("track.departs")} ${d.time}` : ""}
      </li>
      <li>
        <UsersThree size={18} weight="duotone" /> {t("track.people", { n: d.people })}
      </li>
    </ul>
  );
}

/** Full live-status card for one ride, order or booking. */
export default function TrackingCard({ view, token, compact = false, details = true }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const Icon = KIND_ICON[view.kind] || Package;
  const cancelled = view.stage === "cancelled";
  const done = DONE.includes(view.stage);
  const steps = t(`track.${view.kind}.steps`);
  const current = STEP_OF[view.kind]?.[view.stage] ?? 0;
  const { title, text } = stageText(t, view);
  const times = STEP_TIMES[view.kind] || [];

  async function share() {
    const url = trackUrl(token);
    const textToShare = t("track.shareText", { kind: t(`track.kinds.${view.kind}`), brand: SITE_NAME, url });
    try {
      if (navigator.share) await navigator.share({ title: SITE_NAME, text: textToShare, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("track.copied"));
      }
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <article className={`trk ${compact ? "trk--compact" : ""} trk--${view.kind} ${cancelled ? "is-cancelled" : ""} ${done ? "is-done" : ""}`} aria-live="polite">
      <header className="trk__top">
        <span className="trk__kind">
          <Icon size={16} weight="fill" /> {t(`track.kindTitle.${view.kind}`)}
          {view.ref && <span className="trk__ref">{view.ref}</span>}
        </span>
        {!cancelled && !done && (
          <span className="trk__live">
            <span className="trk__dot" /> {t("track.live")}
          </span>
        )}
      </header>

      <div className="trk__hero">
        <span className={`trk__icon ${view.stage === "searching" || view.stage === "received" ? "is-pulsing" : ""}`} aria-hidden="true">
          {cancelled ? <XCircle size={30} weight="fill" /> : done ? <CheckCircle size={30} weight="fill" /> : <Icon size={28} weight="fill" />}
        </span>
        <div>
          <h2 className="trk__title">{title}</h2>
          <p className="trk__text">{text}</p>
        </div>
      </div>

      {!cancelled && Array.isArray(steps) && (
        <ol className="trk-steps" style={{ "--steps": steps.length }}>
          {steps.map((label, i) => {
            const at = toDate(view.times?.[times[i]]);
            return (
              <li key={label} className={`${i < current || done ? "is-done" : ""} ${i === current && !done ? "is-current" : ""}`}>
                <span className="trk-steps__bar" />
                <span className="trk-steps__label">{label}</span>
                {at && (i <= current || done) && <span className="trk-steps__time">{formatTime(at, lang)}</span>}
              </li>
            );
          })}
        </ol>
      )}

      {!compact && <StaffCard view={view} />}
      {!compact && details && <Details view={view} />}

      {!compact && token && (
        <div className="trk__foot">
          <button type="button" className="trk__share" onClick={share}>
            <ShareNetwork size={18} weight="bold" /> {t("track.share")}
          </button>
        </div>
      )}
    </article>
  );
}
