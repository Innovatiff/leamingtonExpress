import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ClockCounterClockwise, MagnifyingGlass, X } from "@phosphor-icons/react";
import { SmartImage } from "@/components/ui/Misc";
import { useCatalog } from "@/context/CatalogContext";
import { useI18n } from "@/i18n";
import { money } from "@/lib/format";
import { categoryLabel, productPath } from "@/lib/products";
import { searchProducts, suggestQueries } from "@/lib/search";
import { readJSON, writeJSON } from "@/lib/storage";
import { normalize } from "@/lib/text";

const RECENT_KEY = "lx_recent_searches";

export function saveRecentSearch(term) {
  const clean = String(term || "").trim();
  if (!clean) return;
  const list = readJSON(RECENT_KEY, []).filter((x) => normalize(x) !== normalize(clean));
  writeJSON(RECENT_KEY, [clean, ...list].slice(0, 6));
}

function Highlight({ text, query }) {
  const q = normalize(query);
  const plain = normalize(text);
  const idx = q ? plain.indexOf(q) : -1;
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong>{text.slice(idx, idx + q.length)}</strong>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchBox({ initial = "", autoFocus = false, className = "" }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { products, vocab, categories, brands } = useCatalog();
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(() => readJSON(RECENT_KEY, []));
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  useEffect(() => setQuery(initial), [initial]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const q = query.trim();
  const suggestions = useMemo(() => (q ? suggestQueries(vocab[lang], q, 5) : []), [q, vocab, lang]);
  const matches = useMemo(() => (q.length >= 2 ? searchProducts(products, q, { limit: 4 }) : []), [q, products]);
  const popular = useMemo(
    () => [...categories.slice(0, 4).map((c) => categoryLabel(c.value, lang)), ...brands.slice(0, 3).map((b) => b.name)],
    [categories, brands, lang],
  );

  // Flat list of selectable items for keyboard navigation
  const items = useMemo(() => {
    if (!q) return [...recent.map((r) => ({ kind: "query", value: r, recent: true })), ...popular.map((p) => ({ kind: "query", value: p }))];
    return [
      ...suggestions.map((s) => ({ kind: "query", value: s })),
      ...matches.map((p) => ({ kind: "product", value: p })),
      { kind: "all", value: q },
    ];
  }, [q, recent, popular, suggestions, matches]);

  function go(term) {
    const clean = String(term || "").trim();
    if (!clean) return;
    saveRecentSearch(clean);
    setRecent(readJSON(RECENT_KEY, []));
    setOpen(false);
    inputRef.current?.blur();
    navigate(`/tienda/productos?q=${encodeURIComponent(clean)}`);
  }

  function choose(item) {
    if (!item) return go(query);
    if (item.kind === "product") {
      saveRecentSearch(query);
      setOpen(false);
      navigate(productPath(item.value));
    } else go(item.value);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(-1, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active >= 0 ? items[active] : null);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const optId = (i) => `${listId}-opt-${i}`;
  // Option indexes follow the same order as `items`
  const popularStart = recent.length;
  const matchesStart = suggestions.length;
  const allIndex = suggestions.length + matches.length;

  return (
    <div className={`searchbox ${open ? "is-open" : ""} ${className}`} ref={wrapRef}>
      <form
        role="search"
        className="searchbox__form"
        onSubmit={(e) => {
          e.preventDefault();
          choose(active >= 0 ? items[active] : null);
        }}
      >
        <MagnifyingGlass size={22} weight="bold" className="searchbox__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          className="searchbox__input"
          type="search"
          enterKeyHint="search"
          value={query}
          placeholder={t("store.searchPlaceholder")}
          aria-label={t("store.searchLabel")}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optId(active) : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            className="searchbox__clear"
            aria-label="Clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X size={18} weight="bold" />
          </button>
        )}
        <button type="submit" className="searchbox__submit">
          <span>{t("common.search")}</span>
        </button>
      </form>

      {open && items.length > 0 && (
        <div className="searchbox__panel" id={listId} role="listbox" aria-label={t("store.suggestions")}>
          {!q ? (
            <>
              {recent.length > 0 && (
                <div className="searchbox__group">
                  <div className="searchbox__group-head">
                    <span>{t("store.recentSearches")}</span>
                    <button
                      type="button"
                      onClick={() => {
                        writeJSON(RECENT_KEY, []);
                        setRecent([]);
                      }}
                    >
                      {t("store.clearRecent")}
                    </button>
                  </div>
                  {recent.map((r, i) => {
                    return (
                      <button key={`r-${r}`} type="button" id={optId(i)} role="option" aria-selected={active === i} className={`searchbox__item ${active === i ? "is-active" : ""}`} onClick={() => go(r)}>
                        <ClockCounterClockwise size={18} /> <span className="grow">{r}</span> <ArrowUpRight size={16} />
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="searchbox__group">
                <div className="searchbox__group-head">
                  <span>{t("store.popularSearches")}</span>
                </div>
                <div className="searchbox__chips">
                  {popular.map((p, j) => {
                    const i = popularStart + j;
                    return (
                      <button key={`p-${p}`} type="button" id={optId(i)} role="option" aria-selected={active === i} className={`chip chip--sm ${active === i ? "chip--active" : ""}`} onClick={() => go(p)}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {suggestions.length > 0 && (
                <div className="searchbox__group">
                  {suggestions.map((s, i) => {
                    return (
                      <button key={`s-${s}`} type="button" id={optId(i)} role="option" aria-selected={active === i} className={`searchbox__item ${active === i ? "is-active" : ""}`} onClick={() => go(s)}>
                        <MagnifyingGlass size={18} />
                        <span className="grow">
                          <Highlight text={s} query={q} />
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    );
                  })}
                </div>
              )}
              {matches.length > 0 && (
                <div className="searchbox__group">
                  <div className="searchbox__group-head">
                    <span>{t("store.productsFound")}</span>
                  </div>
                  {matches.map((p, j) => {
                    const i = matchesStart + j;
                    return (
                      <button key={p.id} type="button" id={optId(i)} role="option" aria-selected={active === i} className={`searchbox__product ${active === i ? "is-active" : ""}`} onClick={() => choose({ kind: "product", value: p })}>
                        <span className="searchbox__thumb">
                          <SmartImage src={p.image} alt="" w={120} />
                        </span>
                        <span className="searchbox__pinfo">
                          <span className="searchbox__pname">{p.name}</span>
                          <span className="searchbox__pprice">
                            <strong className={p.onSale ? "is-sale" : ""}>{money(p.price)}</strong>
                            {p.onSale && <s>{money(p.compareAt)}</s>}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                id={optId(allIndex)}
                role="option"
                aria-selected={active === allIndex}
                className={`searchbox__all ${active === allIndex ? "is-active" : ""}`}
                onClick={() => go(q)}
              >
                {matches.length ? t("store.seeAllResults", { q }) : t("store.searchFor", { q })}
                <ArrowUpRight size={16} weight="bold" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
