import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Baby,
  CalendarBlank,
  CheckCircle,
  Clock,
  MapPin,
  NavigationArrow,
  Package,
  PawPrint,
  Phone,
  Signpost,
  Suitcase,
  Users,
  UsersThree,
  WhatsappLogo,
  Wheelchair,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { EmptyState, Spinner } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Overlay";
import { CITY } from "@/config/site";
import { useI18n } from "@/i18n";
import { deliveryStep } from "@/lib/dispatch";
import { money } from "@/lib/format";
import { KIND_ICON, myStatus, orderTotal, ridePrice, useTeam, useWhen } from "./jobs";
import { findJob } from "./useTeam";

const digits = (v) => String(v || "").replace(/\D/g, "").slice(-10);
const tel = (v) => `tel:+1${digits(v)}`;
const wa = (v, text = "") => `https://wa.me/1${digits(v)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const gmaps = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
const waze = (q, ll) => (ll ? `https://waze.com/ul?ll=${ll}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(q)}&navigate=yes`);

function Navigate({ query, ll }) {
  const { t } = useI18n();
  if (!query && !ll) return null;
  return (
    <div className="tjd-nav">
      <Button href={gmaps(ll || query)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={NavigationArrow}>
        {t("team.maps")}
      </Button>
      <Button href={waze(query, ll)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={Signpost}>
        {t("team.waze")}
      </Button>
    </div>
  );
}

function Contact({ name, phone, message }) {
  const { t } = useI18n();
  return (
    <div className="tjd-contact">
      <strong>{name || "—"}</strong>
      {phone ? (
        <div className="tjd-contact__btns">
          <Button href={tel(phone)} size="sm" icon={Phone}>
            {t("team.call")}
          </Button>
          <Button href={wa(phone, message)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={WhatsappLogo} className="tjd-wa">
            {t("team.whatsapp")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Big next-step button at the bottom, with confirmation where it matters. */
function ActionBar({ children }) {
  return <div className="tjd-actions">{children}</div>;
}

function RideJob({ job, mine }) {
  const { t } = useI18n();
  const { act, busy } = useTeam();
  const [confirm, setConfirm] = useState(null);
  const pickupLL = job.pickup?.lat ? `${job.pickup.lat},${job.pickup.lng}` : "";
  const options = [
    job.options?.childSeat && { icon: Baby, label: t("team.options.childSeat") },
    job.options?.wheelchair && { icon: Wheelchair, label: t("team.options.wheelchair") },
    job.options?.pet && { icon: PawPrint, label: t("team.options.pet") },
    job.options?.stops && { icon: MapPin, label: t("team.options.stops", { text: job.stops || "—" }) },
  ].filter(Boolean);
  const first = String(job.contact?.name || "").split(" ")[0];
  const hello = job.lang === "en" ? `Hi ${first}, this is your Express driver.` : `Hola ${first}, soy tu chofer de Express.`;

  return (
    <>
      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.pickup")}</h2>
        <p className="tjd-place">
          <MapPin size={20} weight="fill" className="tj-route__a" />
          <span>
            {job.pickup?.address || t("team.gps")}
            {pickupLL && <em> · GPS</em>}
          </span>
        </p>
        <Navigate query={job.pickup?.address} ll={pickupLL} />
        <h2 className="tjd-card__title">{t("team.dropoff")}</h2>
        <p className="tjd-place">
          <NavigationArrow size={20} weight="fill" className="tj-route__b" />
          <span>
            {job.dropoff?.address}
            {job.dropoff?.km ? <em> · {t("team.km", { km: job.dropoff.km })}</em> : null}
          </span>
        </p>
        <Navigate query={job.dropoff?.address} />
      </section>

      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.customer")}</h2>
        {mine ? <Contact name={job.contact?.name} phone={job.contact?.phone} message={hello} /> : <p className="muted small">{t("team.phoneAfter")}</p>}
      </section>

      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.details")}</h2>
        <ul className="tjd-facts">
          <li>
            <Users size={18} weight="duotone" /> {t("team.pax", { n: job.passengers || 1 })}
          </li>
          <li>
            <Suitcase size={18} weight="duotone" /> {t("team.bags", { n: job.luggage || 0 })}
          </li>
          <li>{job.vehicle === "xl" ? t("team.xl") : t("team.standard")}</li>
          {options.map((o) => (
            <li key={o.label}>
              <o.icon size={18} weight="duotone" /> {o.label}
            </li>
          ))}
          <li>
            {t(`team.payWith.${job.payment || "cash"}`)} · <strong>{ridePrice(job) || t("team.quote")}</strong>
          </li>
        </ul>
        {job.notes && (
          <p className="tjd-quote">
            <strong>{t("team.notes")}:</strong> “{job.notes}”
          </p>
        )}
      </section>

      <ActionBar>
        {!mine && (
          <Button block size="xl" loading={busy === `accept:${job.id}`} disabled={Boolean(busy)} onClick={() => act.accept("rides", job)}>
            {t("team.ride.accept")}
          </Button>
        )}
        {mine && job.status === "assigned" && (
          <>
            <Button block size="xl" loading={busy === "step:arrived"} disabled={Boolean(busy)} onClick={() => act.step("rides", job, "arrived")}>
              {t("team.ride.arrived")}
            </Button>
            <Button block variant="secondary" disabled={Boolean(busy)} onClick={() => act.step("rides", job, "in_progress")}>
              {t("team.ride.startDirect")}
            </Button>
          </>
        )}
        {mine && job.status === "arrived" && (
          <Button block size="xl" loading={busy === "step:in_progress"} disabled={Boolean(busy)} onClick={() => act.step("rides", job, "in_progress")}>
            {t("team.ride.start")}
          </Button>
        )}
        {mine && job.status === "in_progress" && (
          <Button block size="xl" className="tjd-finish" disabled={Boolean(busy)} onClick={() => setConfirm("finish")}>
            {t("team.ride.finish")}
          </Button>
        )}
        {mine && job.status === "completed" && (
          <p className="tjd-done">
            <CheckCircle size={22} weight="fill" /> {t("team.ride.done")}
          </p>
        )}
        {mine && ["assigned", "arrived"].includes(job.status) && (
          <button type="button" className="tjd-release" onClick={() => setConfirm("release")}>
            {t("team.release")}
          </button>
        )}
      </ActionBar>

      <ConfirmModal
        open={confirm === "finish"}
        text={t("team.ride.finishConfirm")}
        onClose={() => setConfirm(null)}
        onConfirm={() => act.step("rides", job, "completed").then(() => setConfirm(null))}
      />
      <ConfirmModal open={confirm === "release"} text={t("team.releaseConfirm")} onClose={() => setConfirm(null)} onConfirm={() => act.release("rides", job).then(() => setConfirm(null))} />
    </>
  );
}

function DeliveryJob({ job, mine }) {
  const { t } = useI18n();
  const { act, busy } = useTeam();
  const [confirm, setConfirm] = useState(null);
  const [cash, setCash] = useState(false);
  const ci = job.customerInfo || {};
  const address = [ci.address, ci.unit, ci.city, ci.postalCode].filter(Boolean).join(", ");
  const step = deliveryStep(job);
  const total = money(orderTotal(job));
  const payCash = job.paymentMethodKey === "cash" && job.payment !== "Success";
  const hello = job.lang === "en" ? `Hi ${ci.firstName || ""}, I'm bringing your Express order ${job.orderNumber}.` : `Hola ${ci.firstName || ""}, te llevo tu pedido ${job.orderNumber} de Express.`;

  return (
    <>
      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.deliverTo")}</h2>
        <p className="tjd-place">
          <MapPin size={20} weight="fill" className="tj-route__b" />
          <span>{address}</span>
        </p>
        {ci.orderNotes && <p className="tjd-quote">“{ci.orderNotes}”</p>}
        <Navigate query={address} />
      </section>

      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.customer")}</h2>
        {mine ? <Contact name={ci.fullName || job.customer} phone={ci.phone} message={hello} /> : <p className="muted small">{t("team.phoneAfter")}</p>}
      </section>

      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.delivery.products")}</h2>
        <ul className="tjd-items">
          {(job.products || []).map((l, i) => (
            <li key={`${l.docId}-${i}`}>
              <span>
                {l.quantity} × {l.name}
                {l.variant && l.variant !== "not added" ? <em> · {l.variant}</em> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className={`tjd-pay ${payCash ? "is-cash" : ""}`}>
          {payCash
            ? t("team.delivery.collect", { amount: total })
            : job.payment === "Success"
              ? `${t("team.delivery.paid")} · ${total}`
              : job.paymentMethodKey === "etransfer"
                ? `${t("team.delivery.etransfer")} · ${total}`
                : t("team.delivery.cardPending")}
        </p>
        {(!mine || step === "assigned") && <p className="muted small">{t("team.delivery.storePickup")}</p>}
      </section>

      <ActionBar>
        {!mine && (
          <Button block size="xl" loading={busy === `accept:${job.id}`} disabled={Boolean(busy)} onClick={() => act.accept("deliveries", job)}>
            {t("team.delivery.accept")}
          </Button>
        )}
        {mine && step === "assigned" && (
          <Button block size="xl" loading={busy === "step:picked_up"} disabled={Boolean(busy)} onClick={() => act.step("deliveries", job, "picked_up")}>
            {t("team.delivery.pickedUp")}
          </Button>
        )}
        {mine && step === "picked_up" && (
          <Button block size="xl" className="tjd-finish" disabled={Boolean(busy)} onClick={() => setConfirm("finish")}>
            {t("team.delivery.delivered")}
          </Button>
        )}
        {mine && step === "delivered" && (
          <p className="tjd-done">
            <CheckCircle size={22} weight="fill" /> {t("team.delivery.done")}
          </p>
        )}
        {mine && step === "assigned" && (
          <button type="button" className="tjd-release" onClick={() => setConfirm("release")}>
            {t("team.release")}
          </button>
        )}
      </ActionBar>

      <ConfirmModal
        open={confirm === "finish"}
        text={t("team.delivery.deliveredConfirm")}
        onClose={() => setConfirm(null)}
        onConfirm={() => act.step("deliveries", job, "delivered", { cashCollected: payCash && cash }).then(() => setConfirm(null))}
        disabled={payCash && !cash}
      >
        {payCash && <Checkbox label={t("team.delivery.collected", { amount: total })} checked={cash} onChange={(e) => setCash(e.target.checked)} />}
      </ConfirmModal>
      <ConfirmModal open={confirm === "release"} text={t("team.releaseConfirm")} onClose={() => setConfirm(null)} onConfirm={() => act.release("deliveries", job).then(() => setConfirm(null))} />
    </>
  );
}

function TripJob({ job, mine }) {
  const { t } = useI18n();
  const { act, busy } = useTeam();
  const when = useWhen();
  const [confirm, setConfirm] = useState(null);
  const payLabel = (b) => (b.status === "paid" ? t("team.trip.paidFull") : b.status === "deposit_paid" ? t("team.trip.deposit") : t("team.trip.awaitingDeposit"));

  return (
    <>
      <section className="tjd-card">
        <h2 className="tjd-card__title">{job.title}</h2>
        <ul className="tjd-facts">
          <li>
            <CalendarBlank size={18} weight="duotone" /> {when("trips", job)}
          </li>
          <li>
            <UsersThree size={18} weight="duotone" /> {t("team.trip.travellers", { n: job.people })} · {t("team.trip.bookings", { n: job.bookings.length })}
          </li>
          <li>
            <MapPin size={18} weight="duotone" /> {t("team.trip.meeting", { city: CITY.name })}
          </li>
        </ul>
      </section>

      <section className="tjd-card">
        <h2 className="tjd-card__title">{t("team.trip.group")}</h2>
        <ul className="tjd-bookings">
          {job.bookings.map((b) => (
            <li key={b.id}>
              <div className="tjd-bookings__head">
                <strong>{b.lead?.name}</strong>
                <span className="tjd-chip">{b.ref}</span>
              </div>
              <span className="muted small">
                {t("team.trip.adultsKids", { a: b.adults || 0, c: b.children || 0 })} · {payLabel(b)}
              </span>
              {Array.isArray(b.travelers) && b.travelers.length > 0 && <span className="small">{b.travelers.join(", ")}</span>}
              {b.requests && (
                <span className="tjd-quote small">
                  {t("team.trip.requests")}: “{b.requests}”
                </span>
              )}
              {mine && b.lead?.phone && (
                <div className="tjd-contact__btns">
                  <Button href={tel(b.lead.phone)} size="sm" variant="secondary" icon={Phone}>
                    {t("team.call")}
                  </Button>
                  <Button href={wa(b.lead.phone)} target="_blank" rel="noreferrer" size="sm" variant="secondary" icon={WhatsappLogo} className="tjd-wa">
                    {t("team.whatsapp")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {!mine && <p className="muted small">{t("team.phoneAfter")}</p>}
      </section>

      <ActionBar>
        {!mine && (
          <Button block size="xl" loading={busy === `accept:${job.id}`} disabled={Boolean(busy)} onClick={() => act.accept("trips", job)}>
            {t("team.trip.accept")}
          </Button>
        )}
        {mine && job.stage === "assigned" && (
          <Button block size="xl" loading={busy === "step:picked_up"} disabled={Boolean(busy)} onClick={() => act.step("trips", job, "picked_up")}>
            {t("team.trip.pickedUp")}
          </Button>
        )}
        {mine && job.stage === "picked_up" && (
          <Button block size="xl" className="tjd-finish" disabled={Boolean(busy)} onClick={() => setConfirm("finish")}>
            {t("team.trip.finish")}
          </Button>
        )}
        {mine && job.stage === "completed" && (
          <p className="tjd-done">
            <CheckCircle size={22} weight="fill" /> {t("team.trip.done")}
          </p>
        )}
        {mine && job.stage === "assigned" && (
          <button type="button" className="tjd-release" onClick={() => setConfirm("release")}>
            {t("team.release")}
          </button>
        )}
      </ActionBar>

      <ConfirmModal open={confirm === "finish"} text={t("team.trip.finishConfirm")} onClose={() => setConfirm(null)} onConfirm={() => act.step("trips", job, "completed").then(() => setConfirm(null))} />
      <ConfirmModal open={confirm === "release"} text={t("team.releaseConfirm")} onClose={() => setConfirm(null)} onConfirm={() => act.release("trips", job).then(() => setConfirm(null))} />
    </>
  );
}

function ConfirmModal({ open, text, onClose, onConfirm, disabled, children }) {
  const { t } = useI18n();
  const { busy } = useTeam();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("team.confirm")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("team.cancel")}
          </Button>
          <Button onClick={onConfirm} loading={Boolean(busy)} disabled={disabled}>
            {t("team.confirm")}
          </Button>
        </>
      }
    >
      <p>{text}</p>
      {children}
    </Modal>
  );
}

const PAGES = { rides: RideJob, deliveries: DeliveryJob, trips: TripJob };

export default function JobDetail() {
  const { kind, id } = useParams();
  const { t } = useI18n();
  const { jobs, staff } = useTeam();
  const when = useWhen();
  const Page = PAGES[kind];
  const job = Page ? findJob(jobs, kind, id) : null;
  const Icon = KIND_ICON[kind] || Package;

  if (!jobs.ready) {
    return (
      <div className="team-center">
        <Spinner />
      </div>
    );
  }
  if (!job) {
    return (
      <div className="team-page">
        <EmptyState icon={Clock} title={t("team.taken")} text="">
          <Button to="/equipo" variant="secondary" icon={ArrowLeft}>
            {t("team.back")}
          </Button>
        </EmptyState>
      </div>
    );
  }

  const mine = kind === "rides" ? job.driverUid === staff.uid : kind === "deliveries" ? job.courierUid === staff.uid : job.bookings.some((b) => b.guideUid === staff.uid);
  const title =
    kind === "rides" ? t("team.ride.title", { ref: job.ref || "" }) : kind === "deliveries" ? t("team.delivery.title", { ref: job.orderNumber || "" }) : t("team.trip.title", { trip: job.title });

  return (
    <div className="team-page tjd">
      <div className="tjd-top">
        <Link to={mine ? "/equipo/mis-trabajos" : "/equipo"} className="tjd-back">
          <ArrowLeft size={18} weight="bold" /> {t("team.back")}
        </Link>
        <span className={`tj__status ${mine ? "" : "is-open"}`}>{mine ? myStatus(t, kind, job) : t("team.status.open")}</span>
      </div>
      <header className="tjd-head">
        <span className={`tjd-head__icon tjd-head__icon--${kind}`}>
          <Icon size={26} weight="fill" />
        </span>
        <div>
          <h1>{title}</h1>
          <p className="muted">{when(kind, job)}</p>
        </div>
      </header>
      <Page job={job} mine={mine} />
    </div>
  );
}
