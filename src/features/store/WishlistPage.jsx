import { Heart } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";
import { useCatalog } from "@/context/CatalogContext";
import { useWishlist } from "@/context/WishlistContext";
import { useI18n } from "@/i18n";
import { useSeo } from "@/lib/seo";
import ProductCard from "./components/ProductCard";

export default function WishlistPage() {
  const { t } = useI18n();
  const { ids } = useWishlist();
  const { byId } = useCatalog();
  useSeo({ title: t("store.favorites"), noindex: true });
  const items = ids.map((id) => byId.get(id)).filter(Boolean);

  return (
    <div className="container container--wide cart-page">
      <div className="page-head">
        <h1 className="page-head__title">
          {t("store.favorites")} {items.length > 0 && <span className="muted">({items.length})</span>}
        </h1>
      </div>
      {items.length ? (
        <div className="product-grid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Heart} title={t("store.favoritesEmpty")} text={t("store.favoritesEmptyText")}>
          <Button to="/tienda">{t("cart.startShopping")}</Button>
        </EmptyState>
      )}
    </div>
  );
}
