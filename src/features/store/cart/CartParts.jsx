import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Tag, Trash, Truck, Warning, X } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { QtyStepper, SmartImage } from "@/components/ui/Misc";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { productPath } from "@/lib/products";

export function CartLine({ line, onNavigate, compact }) {
  const { t } = useI18n();
  const { setQty, remove } = useCart();
  const href = line.product ? productPath(line.product) : null;
  const Title = href ? Link : "span";

  return (
    <li className={`cart-line ${line.unavailable ? "cart-line--off" : ""} ${compact ? "cart-line--compact" : ""}`}>
      <Title className="cart-line__img" {...(href ? { to: href, onClick: onNavigate } : {})}>
        <SmartImage src={line.image} alt="" w={180} />
      </Title>
      <div className="cart-line__info">
        <Title className="cart-line__name" {...(href ? { to: href, onClick: onNavigate } : {})}>
          {line.name || "…"}
        </Title>
        {line.variant && <span className="cart-line__variant">{line.variant}</span>}
        {line.unavailable ? (
          <span className="cart-line__warn">
            <Warning size={15} weight="fill" /> {t("cart.unavailable")}
          </span>
        ) : (
          line.overStock && (
            <span className="cart-line__warn">
              <Warning size={15} weight="fill" /> {t("cart.onlyLeft", { n: line.maxQty })}
            </span>
          )
        )}
        <div className="cart-line__row">
          {!line.unavailable && (
            <QtyStepper
              size="sm"
              value={line.qty}
              max={line.maxQty}
              onChange={(q) => setQty(line.key, Math.min(q, line.maxQty))}
             
            />
          )}
          <div className="cart-line__price">
            <strong>{money(line.price * line.qty)}</strong>
            {line.qty > 1 && <span className="tiny muted">{money(line.price)} {t("cart.each")}</span>}
          </div>
        </div>
      </div>
      <button className="cart-line__remove" onClick={() => remove(line.key)} aria-label={`${t("cart.remove")}: ${line.name}`}>
        <Trash size={18} />
      </button>
    </li>
  );
}

export function PromoCodeForm() {
  const { t } = useI18n();
  const { promo, applyPromo, removePromo, totals } = useCart();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (promo) {
    return (
      <div className="promo-applied">
        <Tag size={18} weight="fill" />
        <span className="grow">{t("cart.applied", { code: promo.code })}</span>
        <button className="icon-btn" onClick={removePromo} aria-label={t("cart.removeCode")}>
          <X size={16} />
        </button>
      </div>
    );
  }

  // Not a <form>: this box also lives inside the checkout form, and nested
  // forms would submit the order when pressing Enter here.
  async function submit() {
    if (!code.trim() || totals.subtotal <= 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await applyPromo(code);
      if (!res?.valid) {
        setError(
          res?.reason === "minimum" && res.minSubtotal
            ? t("cart.codeMinimum", { amount: money(res.minSubtotal, { whole: true }) })
            : res?.reason === "used"
              ? t("cart.codeUsed")
              : t("cart.invalidCode"),
        );
      }
      else setCode("");
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="promo-form">
      <label className="field__label" htmlFor="promo-code">
        {t("cart.promoLabel")}
      </label>
      <div className="promo-form__row">
        <input
          id="promo-code"
          className="input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("cart.promoPlaceholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button variant="dark" loading={busy} disabled={!code.trim()} onClick={submit}>
          {t("cart.apply")}
        </Button>
      </div>
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}

export function CartTotals({ showPoints = true }) {
  const { t } = useI18n();
  const { totals, promo } = useCart();
  const settings = useSettings();
  return (
    <div className="cart-totals">
      {settings.store.freeDeliveryOver > 0 && totals.count > 0 && (
        <div className={`free-ship ${totals.freeDelivery ? "free-ship--done" : ""}`}>
          <Truck size={18} weight="fill" />
          <span>
            {totals.freeDelivery
              ? t("cart.freeDeliveryUnlocked")
              : t("cart.freeDeliveryLeft", { amount: money(totals.toFreeDelivery) })}
          </span>
          <div className="free-ship__bar">
            <span style={{ width: `${Math.min(100, (totals.subtotal / settings.store.freeDeliveryOver) * 100)}%` }} />
          </div>
        </div>
      )}
      <dl>
        <div className="kv">
          <dt>{t("cart.subtotal")}</dt>
          <dd>{money(totals.subtotal + totals.savings)}</dd>
        </div>
        {totals.savings > 0 && (
          <div className="kv kv--save">
            <dt>{t("cart.savings")}</dt>
            <dd>−{money(totals.savings)}</dd>
          </div>
        )}
        {promo && totals.discount > 0 && (
          <div className="kv kv--save">
            <dt>
              {t("cart.discount")} ({promo.code})
            </dt>
            <dd>−{money(totals.discount)}</dd>
          </div>
        )}
        <div className="kv">
          <dt>{t("cart.delivery")}</dt>
          <dd>{totals.delivery === 0 ? t("common.free") : money(totals.delivery)}</dd>
        </div>
        <div className="kv kv--total">
          <dt>{t("cart.total")}</dt>
          <dd>{money(totals.total)}</dd>
        </div>
      </dl>
      <p className="tiny muted cart-totals__tax">{t("cart.taxIncluded")}</p>
      {showPoints && totals.points > 0 && (
        <p className="points-note">
          <Coins size={18} weight="fill" /> {t("cart.points", { n: totals.points })}
        </p>
      )}
    </div>
  );
}
