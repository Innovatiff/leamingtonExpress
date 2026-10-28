import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, LockSimple, ShoppingCartSimple } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { EmptyState, Notice } from "@/components/ui/Misc";
import { useCart } from "@/context/CartContext";
import { useCatalog } from "@/context/CatalogContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { sortProducts } from "@/lib/products";
import { useSeo } from "@/lib/seo";
import { CartLine, CartTotals, PromoCodeForm } from "./cart/CartParts";
import { ProductRail } from "./components/Rails";

export default function CartPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { lines, totals } = useCart();
  const { products } = useCatalog();
  const settings = useSettings();
  useSeo({ title: t("cart.title"), noindex: true });

  const suggestions = useMemo(() => {
    const inCart = new Set(lines.map((l) => l.id));
    return sortProducts(
      products.filter((p) => !inCart.has(p.id) && p.inStock),
      "featured",
    ).slice(0, 12);
  }, [products, lines]);

  const blocked = lines.some((l) => l.unavailable || l.overStock) || totals.count === 0;
  const pays = ["cash", "etransfer", "card"].filter((k) => settings.store.payments?.[k]);

  if (!lines.length) {
    return (
      <div className="container container--wide cart-page">
        <EmptyState icon={ShoppingCartSimple} title={t("cart.empty")} text={t("cart.emptyText")}>
          <Button to="/tienda" size="lg">
            {t("cart.startShopping")}
          </Button>
        </EmptyState>
        <ProductRail title={t("product.related")} products={suggestions} />
      </div>
    );
  }

  return (
    <div className="container container--wide cart-page">
      <div className="page-head">
        <h1 className="page-head__title">
          {t("cart.title")} <span className="muted">({t("cart.items", { n: totals.count })})</span>
        </h1>
      </div>

      <div className="cart-page__grid">
        <div className="card card--pad">
          {blocked && totals.count > 0 && (
            <Notice tone="warning" className="cart-page__notice">
              {t("checkout.errors.notFound")}
            </Notice>
          )}
          <ul className="cart-lines">
            {lines.map((line) => (
              <CartLine key={line.key} line={line} />
            ))}
          </ul>
          <Link to="/tienda" className="section-head__link cart-page__back">
            <ArrowLeft size={16} weight="bold" /> {t("cart.continue")}
          </Link>
        </div>

        <aside className="card card--pad cart-page__summary">
          <h2 className="card__title">{t("cart.summary")}</h2>
          <div className="stack" style={{ "--stack-gap": "16px" }}>
            <PromoCodeForm />
            <CartTotals />
            <Button size="lg" block disabled={blocked} onClick={() => navigate("/tienda/checkout")} iconRight={ArrowRight}>
              {t("cart.checkout")} · {money(totals.total)}
            </Button>
            <p className="cart-page__secure">
              <LockSimple size={16} weight="fill" /> {t("checkout.secure")}
              {pays.length > 0 && <span> · {pays.map((k) => t(`payments.${k}`)).join(" · ")}</span>}
            </p>
          </div>
        </aside>
      </div>

      <div className="cart-page__more">
        <ProductRail title={t("product.related")} products={suggestions} />
      </div>
    </div>
  );
}
