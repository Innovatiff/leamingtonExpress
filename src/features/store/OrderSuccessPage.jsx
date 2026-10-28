import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Bank, CheckCircle, Coins, Copy, CreditCard, MapPin, Money, Package, Phone, XCircle } from "@phosphor-icons/react";
import * as backend from "@backend";
import Button from "@/components/ui/Button";
import { EmptyState, Notice, SmartImage, Spinner } from "@/components/ui/Misc";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { formatDateTime, money, toDate } from "@/lib/format";
import { orderItems, orderStage, paymentKey, STAGE_ORDER } from "@/lib/orders";
import { useSeo } from "@/lib/seo";
import { readJSON } from "@/lib/storage";
import { trackingView } from "@/lib/dispatch";
import { rememberService } from "@/features/tracking/store";
import TrackingCard from "@/features/tracking/TrackingCard";
import { useTracking } from "@/features/tracking/useTracking";

const PAY_ICON = { cash: Money, etransfer: Bank, card: CreditCard };

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") || readJSON("lx_last_order", null, "session")?.token || "";
  const { t, lang } = useI18n();
  const cart = useCart();
  const toast = useToast();
  const settings = useSettings();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState("loading");
  const { view } = useTracking(token);
  useSeo({ title: t("order.title"), noindex: true });

  // Keep it in "My services" on this device
  useEffect(() => {
    if (order && token) rememberService({ kind: "order", token, ref: order.orderNumber });
  }, [order, token]);

  // The cart is emptied once we land here for the order we just placed
  useEffect(() => {
    const last = readJSON("lx_last_order", null, "session");
    if (last?.id === orderId && cart.items.length) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    let timer;
    async function load() {
      try {
        const o = await backend.fetchOrder({ orderId, token });
        if (!alive) return;
        setOrder(o);
        setState("ready");
        // after a card payment, wait for Stripe's confirmation (webhook)
        if (paymentKey(o) === "card" && o.payment !== "Success" && o.status !== "Cancelled" && tries < 20) {
          tries += 1;
          timer = setTimeout(load, 3000);
        }
      } catch (err) {
        console.warn("Order lookup failed", err);
        if (alive) setState("error");
      }
    }
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [orderId, token]);

  if (state === "loading") {
    return (
      <div className="center-block">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !order) {
    return (
      <div className="container">
        <EmptyState icon={Package} title={t("order.notFound")} text={t("order.notFoundText")}>
          <div className="row row--wrap" style={{ justifyContent: "center" }}>
            <Button to="/cuenta" variant="secondary">
              {t("order.myOrders")}
            </Button>
            <Button to="/tienda">{t("order.continue")}</Button>
          </div>
        </EmptyState>
      </div>
    );
  }

  const stage = orderStage(order);
  const pay = paymentKey(order);
  const PayIcon = PAY_ICON[pay] || Money;
  const total = Number(order.total?.finalTotal) || 0;
  const items = orderItems(order);
  const ci = order.customerInfo || {};
  const cancelled = stage === "cancelled";
  const stageIdx = STAGE_ORDER.indexOf(stage === "awaitingPayment" ? "received" : stage);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      toast.success(t("common.copied"));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="container container--narrow order-page">
      <div className={`order-hero ${cancelled ? "order-hero--off" : ""}`}>
        <div className="order-hero__icon">{cancelled ? <XCircle size={56} weight="fill" /> : <CheckCircle size={56} weight="fill" />}</div>
        <h1 className="order-hero__title">{cancelled ? t("order.status.cancelled") : t("order.thanks", { name: ci.firstName || "" })}</h1>
        {!cancelled && <p className="order-hero__text">{t("order.received")}</p>}
        <button className="order-hero__number" onClick={copyNumber} title={t("common.copy")}>
          <span>{t("order.number")}</span>
          <strong>{order.orderNumber}</strong>
          <Copy size={16} weight="bold" />
        </button>
        <p className="tiny muted">{formatDateTime(toDate(order.createdAt), lang)}</p>
      </div>

      {!cancelled && token ? (
        <TrackingCard view={view || trackingView("order", { ...order, accessToken: token })} token={token} details={false} />
      ) : (
        !cancelled && (
          <ol className="order-track" aria-label={t("common.status")}>
            {STAGE_ORDER.map((s, i) => (
              <li key={s} className={`${i <= stageIdx ? "is-done" : ""} ${i === stageIdx ? "is-current" : ""}`}>
                <span className="order-track__dot" />
                <span className="order-track__label">{t(`order.status.${s}`)}</span>
              </li>
            ))}
          </ol>
        )
      )}

      {!cancelled && (
        <section className="card card--pad order-next">
          <h2 className="card__title">{t("order.nextTitle")}</h2>
          <ul className="order-next__list">
            <li>
              <PayIcon size={24} weight="duotone" className="i-blue" />
              <span>
                {pay === "card"
                  ? order.payment === "Success"
                    ? t("order.cardNext")
                    : t("order.cardPending")
                  : pay === "etransfer"
                    ? t("order.etransferNext", { amount: money(total), email: settings.store.etransferEmail, number: order.orderNumber })
                    : t("order.cashNext", { amount: money(total) })}
              </span>
            </li>
            <li>
              <Phone size={24} weight="duotone" className="i-blue" />
              <span>{t("order.deliveryNext")}</span>
            </li>
            {Number(order.total?.totalAccumulatedPoints) > 0 && (
              <li>
                <Coins size={24} weight="duotone" className="i-amber" />
                <span>{t("order.points", { n: order.total.totalAccumulatedPoints })}</span>
              </li>
            )}
          </ul>
          {pay === "card" && order.payment !== "Success" && (
            <Notice tone="info" className="order-next__wait">
              <span className="row" style={{ "--row-gap": "10px" }}>
                <Spinner className="spinner--sm" /> {t("order.cardPending")}
              </span>
            </Notice>
          )}
        </section>
      )}

      <section className="card card--pad">
        <h2 className="card__title">{t("order.summary")}</h2>
        <ul className="order-items">
          {items.map((it, i) => (
            <li key={`${it.docId || it.name}-${i}`}>
              <span className="order-items__img">
                <SmartImage src={it.image} alt="" w={140} />
              </span>
              <span className="grow">
                <span className="order-items__name">{it.name}</span>
                <span className="tiny muted">
                  {it.variant && it.variant !== "not added" ? `${t("order.variant")}: ${it.variant} · ` : ""}
                  {t("order.qty")}: {it.quantity}
                </span>
              </span>
              <strong>{money(it.lineTotal ?? it.price * it.quantity)}</strong>
            </li>
          ))}
        </ul>
        <dl className="order-totals">
          <div className="kv">
            <dt>{t("cart.subtotal")}</dt>
            <dd>{money(Number(order.total?.productsTotal || 0) + Number(order.total?.totalSaved || 0))}</dd>
          </div>
          {Number(order.total?.totalSaved) > 0 && (
            <div className="kv kv--save">
              <dt>{t("cart.savings")}</dt>
              <dd>−{money(order.total.totalSaved)}</dd>
            </div>
          )}
          {Number(order.total?.discount) > 0 && (
            <div className="kv kv--save">
              <dt>
                {t("cart.discount")} {order.discountCode && `(${order.discountCode})`}
              </dt>
              <dd>−{money(order.total.discount)}</dd>
            </div>
          )}
          <div className="kv">
            <dt>{t("cart.delivery")}</dt>
            <dd>{Number(order.total?.shipping) ? money(order.total.shipping) : t("common.free")}</dd>
          </div>
          <div className="kv kv--total">
            <dt>{t("cart.total")}</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        <div className="order-meta">
          <div>
            <span className="tiny muted">
              <MapPin size={14} weight="fill" /> {t("order.deliverTo")}
            </span>
            <p>
              {ci.fullName}
              <br />
              {ci.address}
              {ci.unit ? `, ${ci.unit}` : ""}
              <br />
              {ci.city}, ON {ci.postalCode}
            </p>
          </div>
          <div>
            <span className="tiny muted">
              <PayIcon size={14} weight="fill" /> {t("order.payment")}
            </span>
            <p>
              {t(`payments.${pay}`)}
              <br />
              <span className={`badge ${order.payment === "Success" ? "badge--success" : pay === "cash" ? "badge--info" : "badge--warning"}`}>
                {t(`order.payStatus.${order.payment === "Success" ? "paid" : pay === "cash" ? "onDelivery" : pay === "etransfer" ? "awaitingEtransfer" : "awaitingCard"}`)}
              </span>
            </p>
          </div>
        </div>
      </section>

      <div className="order-actions">
        <Button to="/tienda" size="lg">
          {t("order.continue")}
        </Button>
        <Button to="/cuenta" size="lg" variant="secondary">
          {t("order.myOrders")}
        </Button>
      </div>
      <p className="center-text tiny muted">
        <Link to="/contacto">{t("nav.contact")}</Link>
      </p>
    </div>
  );
}
