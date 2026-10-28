import { Link } from "react-router-dom";
import { Heart, Lightning, Plus, Check } from "@phosphor-icons/react";
import { useState } from "react";
import { Price, SmartImage, Stars } from "@/components/ui/Misc";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { useWishlist } from "@/context/WishlistContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { isNew, offerIsLive, productPath } from "@/lib/products";
import "./product-card.css";

export default function ProductCard({ product: p, eager, size }) {
  const { t } = useI18n();
  const cart = useCart();
  const wishlist = useWishlist();
  const toast = useToast();
  const [justAdded, setJustAdded] = useState(false);
  const href = productPath(p);
  const multiVariant = p.variants.length > 1;
  const fav = wishlist.has(p.id);
  const lowStock = p.stock != null && p.stock > 0 && p.stock <= 3;

  function quickAdd() {
    const added = cart.add(p, { variant: p.variants[0] || "", qty: 1 });
    if (added > 0) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);
      toast.success(t("product.added"), { action: { label: t("product.viewCart"), to: "/tienda/carrito" } });
    } else {
      toast.info(t("product.maxReached"));
    }
  }

  function toggleFav() {
    const added = wishlist.toggle(p.id);
    if (added) toast.success(t("product.favoriteAdded"), { action: { label: t("nav.favorites"), to: "/tienda/favoritos" } });
  }

  return (
    <article className={`pcard theme-store ${!p.inStock ? "pcard--soldout" : ""} ${size === "lg" ? "pcard--lg" : ""}`}>
      <div className="pcard__media">
        <Link to={href} className="pcard__imglink" tabIndex={-1} aria-hidden="true">
          <SmartImage src={p.image} alt="" w={420} eager={eager} />
        </Link>
        <div className="pcard__badges">
          {!p.inStock ? (
            <span className="badge badge--dark">{t("product.outOfStock")}</span>
          ) : (
            <>
              {p.discountPct >= 5 && <span className="badge badge--sale">{t("product.off", { pct: p.discountPct })}</span>}
              {offerIsLive(p) && (
                <span className="badge badge--flash">
                  <Lightning size={12} weight="fill" /> {t("product.sale")}
                </span>
              )}
              {isNew(p) && <span className="badge badge--new">{t("product.new")}</span>}
            </>
          )}
        </div>
        <button
          className={`pcard__fav ${fav ? "is-on" : ""}`}
          onClick={toggleFav}
          aria-pressed={fav}
          aria-label={fav ? t("product.removeFavorite") : t("product.addFavorite")}
        >
          <Heart size={20} weight={fav ? "fill" : "bold"} />
        </button>
      </div>

      <div className="pcard__body">
        {p.brand && <span className="pcard__brand">{p.brand}</span>}
        <h3 className="pcard__name">
          <Link to={href}>{p.name}</Link>
        </h3>
        {p.stars > 0 && <Stars value={p.stars} count={p.ratingsCount} size={13} />}
        <Price now={p.price} was={p.compareAt} />
        {p.savings > 0 && <span className="pcard__save">{t("product.save", { amount: money(p.savings, { whole: true }) })}</span>}
        <div className="pcard__meta">
          {p.inStock && p.delivery.count > 0 && p.deliveryHours <= 24 && (
            <span className="pcard__ship">
              <Lightning size={14} weight="fill" /> {t("product.deliveryIn", p.delivery)}
            </span>
          )}
          {lowStock && <span className="pcard__low">{t("product.lowStock", { n: p.stock })}</span>}
        </div>
      </div>

      <div className="pcard__actions">
        {multiVariant ? (
          <Link to={href} className="btn btn--soft btn--sm btn--block">
            {t("product.chooseOption")}
          </Link>
        ) : (
          <button className={`btn btn--sm btn--block ${justAdded ? "btn--added" : "btn--primary"}`} onClick={quickAdd} disabled={!p.inStock}>
            {justAdded ? <Check size={16} weight="bold" /> : <Plus size={16} weight="bold" />}
            <span>{!p.inStock ? t("product.outOfStock") : justAdded ? t("product.added") : t("product.add")}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="pcard pcard--skeleton" aria-hidden="true">
      <div className="pcard__media skeleton" />
      <div className="pcard__body">
        <div className="skeleton" style={{ height: 12, width: "40%" }} />
        <div className="skeleton" style={{ height: 14, width: "90%" }} />
        <div className="skeleton" style={{ height: 14, width: "70%" }} />
        <div className="skeleton" style={{ height: 20, width: "50%", marginTop: 6 }} />
      </div>
    </div>
  );
}
