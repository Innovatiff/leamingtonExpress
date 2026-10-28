import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CaretLeft,
  CaretRight,
  Coins,
  CreditCard,
  Heart,
  Lightning,
  MagnifyingGlassPlus,
  Package,
  ShareNetwork,
  ShieldCheck,
  ShoppingCartSimple,
  Storefront,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { Countdown, EmptyState, QtyStepper, SmartImage, Skeleton, Stars } from "@/components/ui/Misc";
import { Modal } from "@/components/ui/Overlay";
import { CITY, SITE_URL } from "@/config/site";
import { useCart } from "@/context/CartContext";
import { useCatalog, useProduct } from "@/context/CatalogContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { recentlyViewed, rememberViewed, useWishlist } from "@/context/WishlistContext";
import { useI18n } from "@/i18n";
import { cdnImage } from "@/lib/cloudinary";
import { MAX_QTY_PER_LINE } from "@/lib/cart";
import { money } from "@/lib/format";
import { categoryLabel, departmentLabel, offerIsLive, productPath, sortProducts } from "@/lib/products";
import { useSeo } from "@/lib/seo";
import { normalize } from "@/lib/text";
import { ProductRail } from "./components/Rails";

function Gallery({ product }) {
  const { t } = useI18n();
  const images = product.images.length ? product.images : [""];
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [lightbox, setLightbox] = useState(false);
  const touch = useRef(null);
  const thumbsRef = useRef(null);
  useEffect(() => setIndex(0), [product.id]);
  const go = (i) => setIndex((i + images.length) % images.length);

  // Keep the selected thumbnail visible in the (scrollable) strip without moving the page.
  useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[index];
    if (!thumb) return;
    const left = thumb.offsetLeft; // the strip is position: relative, so this is relative to it
    if (left < strip.scrollLeft) strip.scrollTo({ left, behavior: "smooth" });
    else if (left + thumb.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: left + thumb.offsetWidth - strip.clientWidth, behavior: "smooth" });
  }, [index]);

  return (
    <div className="gallery">
      <div
        className={`gallery__main ${zoom ? "is-zoom" : ""}`}
        // Hover zoom is for mouse only: on phones a tap would leave the photo stuck zoomed in.
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onPointerLeave={() => setZoom(null)}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || images.length < 2) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
        }}
        onClick={() => images[index] && setLightbox(true)}
        style={zoom ? { "--zx": `${zoom.x}%`, "--zy": `${zoom.y}%` } : undefined}
      >
        <SmartImage src={images[index]} alt={product.name} w={900} eager />
        {images.length > 1 && (
          <>
            <button className="gallery__nav gallery__nav--prev" onClick={(e) => (e.stopPropagation(), go(index - 1))} aria-label="←">
              <CaretLeft size={20} weight="bold" />
            </button>
            <button className="gallery__nav gallery__nav--next" onClick={(e) => (e.stopPropagation(), go(index + 1))} aria-label="→">
              <CaretRight size={20} weight="bold" />
            </button>
            <span className="gallery__count" aria-hidden="true">
              {index + 1}/{images.length}
            </span>
          </>
        )}
        <span className="gallery__zoomhint">
          <MagnifyingGlassPlus size={16} weight="bold" /> {t("product.zoom")}
        </span>
      </div>
      {images.length > 1 && (
        <div className="gallery__thumbs" role="tablist" ref={thumbsRef}>
          {images.map((src, i) => (
            <button key={src + i} role="tab" aria-selected={i === index} className={`gallery__thumb ${i === index ? "is-active" : ""}`} onClick={() => setIndex(i)} aria-label={`${i + 1} / ${images.length}`}>
              <SmartImage src={src} alt="" w={160} />
            </button>
          ))}
        </div>
      )}
      <Modal open={lightbox} onClose={() => setLightbox(false)} title={product.name} wide closeLabel={t("common.close")}>
        <div className="lightbox">
          <img src={cdnImage(images[index], { w: 1400 })} alt={product.name} />
          {images.length > 1 && (
            <div className="lightbox__nav">
              <Button variant="secondary" iconOnly icon={CaretLeft} onClick={() => go(index - 1)} aria-label="←" />
              <span className="muted">
                {index + 1} / {images.length}
              </span>
              <Button variant="secondary" iconOnly icon={CaretRight} onClick={() => go(index + 1)} aria-label="→" />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function useProductJsonLd(p) {
  useEffect(() => {
    if (!p) return undefined;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: p.name,
      image: p.images.slice(0, 5),
      sku: p.sku || p.productId || p.id,
      brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
      offers: {
        "@type": "Offer",
        url: `${SITE_URL}${productPath(p)}`,
        priceCurrency: "CAD",
        price: p.price.toFixed(2),
        availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: CITY.brand },
      },
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [p]);
}

export default function ProductPage() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { byId, products, status } = useCatalog();
  const cart = useCart();
  const toast = useToast();
  const wishlist = useWishlist();
  const settings = useSettings();
  const p = useProduct(id);
  const pid = p?.id;
  const firstVariant = p?.variants[0] || "";

  const [variant, setVariant] = useState("");
  const [qty, setQty] = useState(1);
  // a different product (not a price or stock update of this one) starts over
  useEffect(() => {
    setVariant(firstVariant);
    setQty(1);
    if (pid) rememberViewed(pid);
  }, [pid, firstVariant]);

  useSeo({
    title: p?.name,
    description: p ? `${p.brand ? `${p.brand} · ` : ""}${p.name} — ${money(p.price)}. ${t("product.deliveryIn", p.delivery)}.` : undefined,
    image: p?.image ? cdnImage(p.image, { w: 1200 }) : undefined,
    path: p ? productPath(p) : undefined,
  });
  useProductJsonLd(p);

  const related = useMemo(() => {
    if (!p) return [];
    const same = products.filter((x) => x.id !== p.id && x.category === p.category);
    const dept = products.filter((x) => x.id !== p.id && x.category !== p.category && x.department === p.department);
    return [...sortProducts(same, "featured"), ...sortProducts(dept, "featured")].slice(0, 12);
  }, [p, products]);

  const recent = useMemo(
    () =>
      recentlyViewed()
        .filter((x) => x !== id)
        .map((x) => byId.get(x))
        .filter(Boolean)
        .slice(0, 12),
    [id, byId],
  );

  if (!p) {
    if (status !== "ready" || p === undefined) {
      return (
        <div className="container container--wide pdp">
          <div className="pdp__grid">
            <Skeleton h={480} r={24} />
            <div className="stack">
              <Skeleton h={18} w="30%" />
              <Skeleton h={34} w="90%" />
              <Skeleton h={34} w="50%" />
              <Skeleton h={120} r={16} />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="container">
        <EmptyState icon={Package} title={t("product.notFound")} text={t("product.notFoundText")}>
          <Button to="/tienda">{t("product.backToStore")}</Button>
        </EmptyState>
      </div>
    );
  }

  const inCart = cart.lines.find((l) => l.id === p.id && (l.variant || "") === (variant || ""))?.qty || 0;
  const stockCap = p.stock == null ? MAX_QTY_PER_LINE : Math.min(MAX_QTY_PER_LINE, p.stock);
  const maxQty = Math.max(0, stockCap - inCart);
  const canBuy = p.inStock && maxQty > 0;
  const lowStock = p.stock != null && p.stock > 0 && p.stock <= 5;
  const fav = wishlist.has(p.id);
  const pays = ["cash", "etransfer", "card"].filter((k) => settings.store.payments?.[k]);

  function addToCart(goCheckout = false) {
    if (!canBuy) {
      toast.info(t("product.maxReached"));
      return;
    }
    const added = cart.add(p, { variant, qty: Math.min(qty, maxQty) });
    if (added <= 0) return toast.info(t("product.maxReached"));
    setQty(1);
    if (goCheckout) navigate("/tienda/checkout");
    else toast.success(t("product.added"), { action: { label: t("product.viewCart"), to: "/tienda/carrito" } });
  }

  async function share() {
    const url = `${window.location.origin}${productPath(p)}`;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("product.linkCopied"));
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="container container--wide pdp">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/tienda">{t("store.title")}</Link>
        {p.department && (
          <>
            <CaretRight size={12} />
            <Link to={`/tienda/productos?dep=${encodeURIComponent(normalize(p.department))}`}>{departmentLabel(p.department, lang)}</Link>
          </>
        )}
        <CaretRight size={12} />
        <Link to={`/tienda/productos?cat=${encodeURIComponent(normalize(p.category))}`}>{categoryLabel(p.category, lang)}</Link>
      </nav>

      <div className="pdp__grid">
        <Gallery product={p} />

        <div className="buybox">
          {p.brand && (
            <Link to={`/tienda/productos?marca=${encodeURIComponent(p.brand)}`} className="buybox__brand">
              {p.brand}
            </Link>
          )}
          <h1 className="buybox__name">{p.name}</h1>
          <div className="buybox__meta">
            {p.stars > 0 && <Stars value={p.stars} count={p.ratingsCount} size={16} />}
            {p.sku && (
              <span className="tiny muted">
                {t("product.sku")}: {p.sku}
              </span>
            )}
          </div>

          <div className="buybox__price">
            <span className={`buybox__now ${p.onSale ? "is-sale" : ""}`}>{money(p.price)}</span>
            {p.onSale && <span className="buybox__was">{money(p.compareAt)}</span>}
            {p.onSale && (
              <span className="buybox__save">
                {t("product.save", { amount: money(p.savings) })} · −{p.discountPct}%
              </span>
            )}
          </div>
          <p className="buybox__tax">{t("product.taxIncluded")}</p>
          {offerIsLive(p) && (
            <div className="buybox__offer">
              <Lightning size={18} weight="fill" />
              <Countdown to={p.offerEndsAt} prefix={t("product.offerEnds")} />
            </div>
          )}

          {p.variants.length > 0 && (
            <div className="buybox__variants">
              <span className="field__label">
                {t("product.variant")}: <strong>{variant}</strong>
              </span>
              <div className="row row--wrap" style={{ "--row-gap": "8px" }}>
                {p.variants.map((v) => (
                  <button key={v} className={`variant-pill ${v === variant ? "is-active" : ""}`} onClick={() => setVariant(v)} aria-pressed={v === variant}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="buybox__stock">
            {!p.inStock ? (
              <span className="stock stock--out">{t("product.soldOut")}</span>
            ) : lowStock ? (
              <span className="stock stock--low">{t("product.lowStock", { n: p.stock })}</span>
            ) : (
              <span className="stock stock--ok">{t("product.inStock")}</span>
            )}
          </div>

          <div className="buybox__actions">
            {p.inStock && <QtyStepper value={Math.min(qty, Math.max(1, maxQty))} max={Math.max(1, maxQty)} onChange={setQty} />}
            <Button size="lg" className="grow" icon={ShoppingCartSimple} onClick={() => addToCart(false)} disabled={!canBuy}>
              {p.inStock ? t("product.addToCart") : t("product.outOfStock")}
            </Button>
          </div>
          {p.inStock && (
            <Button size="lg" variant="dark" block onClick={() => addToCart(true)} disabled={!canBuy}>
              {t("product.buyNow")}
            </Button>
          )}
          {inCart > 0 && maxQty === 0 && <p className="tiny muted">{t("product.maxReached")}</p>}

          <div className="buybox__secondary">
            <button
              className={`link-btn ${fav ? "is-on" : ""}`}
              onClick={() => {
                if (wishlist.toggle(p.id)) toast.success(t("product.favoriteAdded"));
              }}
              aria-pressed={fav}
            >
              <Heart size={18} weight={fav ? "fill" : "bold"} /> {fav ? t("product.removeFavorite") : t("product.addFavorite")}
            </button>
            <button className="link-btn" onClick={share}>
              <ShareNetwork size={18} weight="bold" /> {t("product.share")}
            </button>
          </div>

          <ul className="buybox__info">
            {p.delivery.count > 0 && (
              <li>
                <Lightning size={22} weight="fill" className="i-amber" />
                <div>
                  <strong>{t("product.deliveryFast", p.delivery)}</strong>
                  <span>{t("store.perkDeliveryText", { city: CITY.name })}</span>
                </div>
              </li>
            )}
            <li>
              <Storefront size={22} weight="fill" className="i-blue" />
              <div>
                <strong>{t("product.deliveredBy", { brand: p.origin || CITY.brand })}</strong>
                <span>{t("product.localSupport", { city: CITY.name })}</span>
              </div>
            </li>
            {pays.length > 0 && (
              <li>
                <CreditCard size={22} weight="fill" className="i-blue" />
                <div>
                  <strong>{t("product.payOptions")}</strong>
                  <span>{pays.map((k) => t(`payments.${k}`)).join(" · ")}</span>
                </div>
              </li>
            )}
            {p.points > 0 && (
              <li>
                <Coins size={22} weight="fill" className="i-amber" />
                <div>
                  <strong>{t("product.points", { n: p.points })}</strong>
                  <span>{t("store.perkPointsText")}</span>
                </div>
              </li>
            )}
            <li>
              <ShieldCheck size={22} weight="fill" className="i-green" />
              <div>
                <strong>{t("product.securePurchase")}</strong>
                <span>{t("product.securePurchaseText")}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <section className="pdp__details">
        <div className="pdp__specs card card--pad">
          <h2 className="card__title">{t("product.specs")}</h2>
          {p.description && <p className="pdp__desc">{p.description}</p>}
          {p.specs.length ? (
            <dl className="specs">
              {p.specs.map((s, i) => (
                <div key={i} className="specs__row">
                  <dt>{s.title}</dt>
                  <dd>{s.description}</dd>
                </div>
              ))}
            </dl>
          ) : (
            !p.description && <p className="muted">{t("product.noSpecs")}</p>
          )}
        </div>
      </section>

      <div className="pdp__rails">
        <ProductRail title={t("product.related")} products={related} />
        <ProductRail title={t("product.recentlyViewed")} products={recent} />
      </div>

      {p.inStock && (
        <div className="pdp-sticky">
          <div className="pdp-sticky__price">
            <strong className={p.onSale ? "is-sale" : ""}>{money(p.price)}</strong>
            {p.onSale && <s>{money(p.compareAt)}</s>}
          </div>
          <Button icon={ShoppingCartSimple} onClick={() => addToCart(false)} disabled={!canBuy}>
            {t("product.add")}
          </Button>
        </div>
      )}
    </div>
  );
}
