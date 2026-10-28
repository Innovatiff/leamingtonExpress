import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Bank, CreditCard, LockSimple, Money, ShieldCheck, Truck, UserCircle } from "@phosphor-icons/react";
import * as backend from "@backend";
import Button from "@/components/ui/Button";
import { Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Notice, SmartImage } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { readJSON, removeKey, writeJSON } from "@/lib/storage";
import { formatPostal, isEmail, isPhone, isPostal, maskPhone, phoneDigits10 } from "@/lib/validators";
import { CartTotals, PromoCodeForm } from "./cart/CartParts";

const GUEST_KEY = "lx_checkout_info";
const LEGACY_GUEST_KEY = "express_guest_checkout_info_v1"; // saved by the previous site

const PAY_META = {
  cash: { icon: Money },
  etransfer: { icon: Bank },
  card: { icon: CreditCard },
};

function loadGuestInfo() {
  const saved = readJSON(GUEST_KEY, null);
  if (saved) return saved;
  const legacy = readJSON(LEGACY_GUEST_KEY, null);
  if (!legacy) return {};
  const [firstName = "", ...rest] = String(legacy.fullName || "").trim().split(/\s+/);
  return { firstName, lastName: rest.join(" "), street: legacy.address || "", postalCode: legacy.postalCode || "", phone: legacy.phone || "" };
}

export default function CheckoutPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, info, saveProfile } = useAuth();
  const cart = useCart();
  const settings = useSettings();
  useSeo({ title: t("checkout.title"), noindex: true });

  // store orders are paid before we buy and deliver them: no cash on delivery
  const methods = ["etransfer", "card"].filter((m) => settings.store.payments?.[m]);
  const [form, setForm] = useState(() => {
    const g = loadGuestInfo();
    return {
      firstName: g.firstName || "",
      lastName: g.lastName || "",
      phone: g.phone ? maskPhone(g.phone) : "",
      email: g.email || "",
      street: g.street || "",
      unit: g.unit || "",
      town: g.town || CITY.serviceArea[0],
      postalCode: g.postalCode ? formatPostal(g.postalCode) : "",
      notes: "",
      payment: "",
      saveInfo: true,
    };
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const prefilled = useRef(false);

  // Fill empty fields from the signed-in customer's profile once
  useEffect(() => {
    if (!user || prefilled.current || (!info.firstName && !info.phone && !info.address.street)) return;
    prefilled.current = true;
    setForm((f) => ({
      ...f,
      firstName: f.firstName || info.firstName,
      lastName: f.lastName || info.lastName,
      phone: f.phone || (info.phone ? maskPhone(info.phone) : ""),
      email: f.email || info.email,
      street: f.street || info.address.street,
      unit: f.unit || info.address.unit,
      town: info.address.town && CITY.serviceArea.includes(info.address.town) ? info.address.town : f.town,
      postalCode: f.postalCode || formatPostal(info.address.postalCode),
    }));
  }, [user, info]);

  useEffect(() => {
    if (!form.payment && methods.length) setForm((f) => ({ ...f, payment: methods[0] }));
  }, [form.payment, methods]);

  // Returned from a cancelled card payment → release that pending order
  const cancelledId = params.get("cancelled");
  useEffect(() => {
    if (!cancelledId) return;
    const last = readJSON("lx_last_order", null, "session");
    if (last?.id === cancelledId && backend.cancelOrder) backend.cancelOrder({ orderId: last.id, token: last.token }).catch(() => {});
  }, [cancelledId]);

  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [k]: k === "phone" ? maskPhone(v) : k === "postalCode" ? formatPostal(v) : v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const lines = cart.lines.filter((l) => !l.unavailable);
  const blocked = cart.lines.some((l) => l.unavailable || l.overStock);
  const townOptions = useMemo(() => CITY.serviceArea.map((s) => ({ value: s, label: s })), []);

  if (!cart.lines.length && !submitting) return <Navigate to="/tienda/carrito" replace />;

  function validate() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = t("errors.required");
    if (!form.lastName.trim()) e.lastName = t("errors.required");
    if (!isPhone(form.phone)) e.phone = t("errors.phone");
    if (form.email.trim() && !isEmail(form.email)) e.email = t("errors.email");
    if (form.payment === "card" && !isEmail(form.email)) e.email = t("errors.email");
    if (!form.street.trim()) e.street = t("errors.required");
    if (!form.town) e.town = t("errors.required");
    if (!isPostal(form.postalCode)) e.postalCode = t("errors.postal");
    if (!form.payment) e.payment = t("errors.required");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleError(err) {
    const reason = err?.details?.reason || err?.code;
    const productId = err?.details?.productId;
    const line = cart.lines.find((l) => l.id === productId);
    if (reason === "OUT_OF_STOCK" && line) {
      const available = Number(err.details.available) || 0;
      if (available > 0) cart.setQty(line.key, available);
      else cart.remove(line.key);
      setServerError(t("checkout.errors.outOfStock", { name: line.name }));
    } else if (reason === "PRODUCT_NOT_FOUND") {
      if (line) cart.remove(line.key);
      setServerError(t("checkout.errors.notFound"));
    } else if (reason === "DISCOUNT_INVALID") {
      cart.removePromo();
      setServerError(t("checkout.errors.discount"));
    } else if (reason === "CARD_UNAVAILABLE") {
      setServerError(t("checkout.errors.cardUnavailable"));
    } else if (String(err?.code || "").includes("unavailable") || err?.message === "Failed to fetch") {
      setServerError(t("errors.network"));
    } else {
      setServerError(t("checkout.errors.generic"));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setServerError("");
    if (!validate()) {
      setServerError(t("checkout.fixErrors"));
      document.querySelector(".field--invalid input, .field--invalid select")?.focus();
      return;
    }
    if (!lines.length) return setServerError(t("checkout.errors.empty"));
    setSubmitting(true);
    try {
      const payload = {
        city: CITY.id,
        lang,
        items: lines.map((l) => ({ id: l.id, variant: l.variant || "", qty: l.qty })),
        customer: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: phoneDigits10(form.phone),
          email: form.email.trim().toLowerCase(),
        },
        address: {
          street: form.street.trim(),
          unit: form.unit.trim(),
          town: form.town,
          postalCode: formatPostal(form.postalCode),
          notes: form.notes.trim(),
        },
        paymentMethod: form.payment,
        discountCode: cart.promo?.code || "",
        returnUrl: window.location.origin,
      };
      const res = await backend.placeOrder(payload);

      const guest = { firstName: payload.customer.firstName, lastName: payload.customer.lastName, phone: payload.customer.phone, email: payload.customer.email, ...payload.address, notes: undefined };
      if (form.saveInfo) {
        writeJSON(GUEST_KEY, guest);
        if (user) {
          saveProfile({
            userInformation: { firstName: guest.firstName, lastName: guest.lastName, phoneNumber: guest.phone },
            address: { homeAddress: guest.street, unit: guest.unit, city: guest.town, cityProvince: `${guest.town}, ON`, postalCode: guest.postalCode },
          }).catch(() => {});
        }
      } else removeKey(GUEST_KEY);
      removeKey(LEGACY_GUEST_KEY);

      writeJSON("lx_last_order", { id: res.orderId, token: res.token, number: res.orderNumber }, "session");
      if (res.checkoutUrl) {
        if (res.checkoutUrl.startsWith("/")) navigate(res.checkoutUrl);
        else window.location.assign(res.checkoutUrl);
        return;
      }
      cart.clear();
      navigate(`/tienda/pedido/${res.orderId}?t=${encodeURIComponent(res.token)}`, { replace: true });
    } catch (err) {
      console.error("Checkout failed", err);
      handleError(err);
      setSubmitting(false);
    }
  }

  const placeLabel = form.payment === "card" ? t("checkout.payCard", { total: money(cart.totals.total) }) : t("checkout.place", { total: money(cart.totals.total) });

  return (
    <div className="container container--wide checkout">
      <div className="checkout__head">
        <h1 className="page-head__title">{t("checkout.title")}</h1>
        <span className="checkout__secure">
          <LockSimple size={18} weight="fill" /> {t("checkout.secure")}
        </span>
      </div>

      {cancelledId && (
        <Notice tone="warning" className="checkout__notice">
          {t("checkout.cancelled")}{" "}
          <button className="section-head__link" onClick={() => setParams({})}>
            ✕
          </button>
        </Notice>
      )}

      <form className="checkout__grid" onSubmit={submit} noValidate>
        <div className="checkout__main">
          <section className="card card--pad checkout__section">
            <h2 className="checkout__step">
              <span>1</span> {t("checkout.contactTitle")}
            </h2>
            {!user && (
              <div className="checkout__signin">
                <UserCircle size={22} weight="duotone" />
                <span className="grow">{t("checkout.signInPrompt")}</span>
                <Link to="/cuenta?next=/tienda/checkout" className="section-head__link">
                  {t("checkout.signIn")}
                </Link>
              </div>
            )}
            <div className="form-grid">
              <TextField label={t("checkout.firstName")} value={form.firstName} onChange={set("firstName")} error={errors.firstName} autoComplete="given-name" required />
              <TextField label={t("checkout.lastName")} value={form.lastName} onChange={set("lastName")} error={errors.lastName} autoComplete="family-name" required />
              <TextField label={t("checkout.phone")} value={form.phone} onChange={set("phone")} error={errors.phone} hint={t("checkout.phoneHint")} inputMode="tel" autoComplete="tel-national" placeholder="(226) 555-0123" required />
              <TextField
                label={t("checkout.email")}
                optional={form.payment === "card" ? undefined : t("common.optional")}
                type="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
                hint={t("checkout.emailHint")}
                autoComplete="email"
              />
            </div>
          </section>

          <section className="card card--pad checkout__section">
            <h2 className="checkout__step">
              <span>2</span> {t("checkout.addressTitle")}
            </h2>
            <div className="form-grid">
              <TextField className="span-2" label={t("checkout.street")} placeholder={t("checkout.streetPlaceholder")} value={form.street} onChange={set("street")} error={errors.street} autoComplete="address-line1" required />
              <TextField label={t("checkout.unit")} optional={t("common.optional")} value={form.unit} onChange={set("unit")} autoComplete="address-line2" />
              <SelectField label={t("checkout.town")} value={form.town} onChange={set("town")} options={townOptions} error={errors.town} />
              <TextField label={t("checkout.postalCode")} value={form.postalCode} onChange={set("postalCode")} error={errors.postalCode} placeholder="N8H 3X9" autoComplete="postal-code" autoCapitalize="characters" required />
              <TextAreaField className="span-2" label={t("checkout.notes")} optional={t("common.optional")} placeholder={t("checkout.notesPlaceholder")} value={form.notes} onChange={set("notes")} rows={2} maxLength={300} />
            </div>
            <p className="checkout__eta">
              <Truck size={18} weight="fill" /> {t("product.deliveryFast", { count: 2, unit: "hours" })} · {CITY.name} {lang === "es" ? "y alrededores" : "and nearby"}
            </p>
          </section>

          <section className="card card--pad checkout__section">
            <h2 className="checkout__step">
              <span>3</span> {t("checkout.paymentTitle")}
            </h2>
            <div className="stack" role="radiogroup" aria-label={t("checkout.paymentTitle")}>
              {methods.map((m) => {
                const Icon = PAY_META[m].icon;
                return (
                  <button
                    type="button"
                    key={m}
                    role="radio"
                    aria-checked={form.payment === m}
                    className="choice"
                    onClick={() => set("payment")(m)}
                  >
                    <span className="choice__radio" />
                    <Icon size={26} weight="duotone" className="i-blue" />
                    <span className="grow">
                      <span className="choice__title">{t(`checkout.${m}`)}</span>
                      <span className="choice__text">{t(`checkout.${m}Text`)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.payment && <span className="field__error">{errors.payment}</span>}
            <Checkbox className="checkout__save" label={t("checkout.saveInfo")} checked={form.saveInfo} onChange={set("saveInfo")} />
          </section>
        </div>

        <aside className="checkout__aside">
          <div className="card card--pad">
            <h2 className="card__title">{t("checkout.reviewTitle")}</h2>
            <ul className="checkout__lines">
              {lines.map((l) => (
                <li key={l.key}>
                  <span className="checkout__thumb">
                    <SmartImage src={l.image} alt="" w={120} />
                    <em>{l.qty}</em>
                  </span>
                  <span className="grow checkout__lname">
                    {l.name}
                    {l.variant && <small>{l.variant}</small>}
                  </span>
                  <strong>{money(l.price * l.qty)}</strong>
                </li>
              ))}
            </ul>
            <div className="stack" style={{ "--stack-gap": "14px" }}>
              <PromoCodeForm />
              <CartTotals />
              {serverError && <Notice tone="error">{serverError}</Notice>}
              {blocked && <Notice tone="warning">{t("checkout.errors.notFound")}</Notice>}
              <Button type="submit" size="xl" block loading={submitting} disabled={blocked || !lines.length || !methods.length}>
                {submitting ? t("checkout.processing") : placeLabel}
              </Button>
              <p className="checkout__terms">
                <ShieldCheck size={16} weight="fill" /> {t("checkout.agree")}{" "}
                <Link to="/terminos" target="_blank">
                  {t("footer.terms")}
                </Link>
              </p>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
