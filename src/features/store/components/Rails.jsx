import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useI18n } from "@/i18n";
import ProductCard, { ProductCardSkeleton } from "./ProductCard";

/** Horizontal product carousel with arrow buttons on desktop. */
export function ProductRail({ title, text, to, products, loading, eagerCount = 0, className = "" }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const scroll = (dir) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  if (!loading && !products.length) return null;
  return (
    <section className={`rail ${className}`}>
      <div className="section-head">
        <div>
          <h2 className="section-head__title">{title}</h2>
          {text && <p className="section-head__text">{text}</p>}
        </div>
        <div className="rail__actions">
          {to && (
            <Link to={to} className="section-head__link">
              {t("common.seeAll")} <ArrowRight size={16} weight="bold" />
            </Link>
          )}
          <button className="rail__arrow" onClick={() => scroll(-1)} aria-label="←">
            <CaretLeft size={18} weight="bold" />
          </button>
          <button className="rail__arrow" onClick={() => scroll(1)} aria-label="→">
            <CaretRight size={18} weight="bold" />
          </button>
        </div>
      </div>
      <div className="scroller product-rail" ref={ref}>
        {loading
          ? Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)
          : products.map((p, i) => <ProductCard key={p.id} product={p} eager={i < eagerCount} />)}
      </div>
    </section>
  );
}

/** Product grid with a header. */
export function ProductGridSection({ title, text, to, products, loading, className = "", children }) {
  const { t } = useI18n();
  if (!loading && !products.length) return null;
  return (
    <section className={className}>
      <div className="section-head">
        <div>
          <h2 className="section-head__title">{title}</h2>
          {text && <p className="section-head__text">{text}</p>}
        </div>
        {to && (
          <Link to={to} className="section-head__link">
            {t("common.seeAll")} <ArrowRight size={16} weight="bold" />
          </Link>
        )}
      </div>
      {children}
      <div className="product-grid">
        {loading ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : products.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}
