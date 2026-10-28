import { editDistance, normalize } from "./text";

// Generic words that mean the same thing in Spanish & English. Brand/model
// words (iphone, galaxy, airpods…) are intentionally NOT here so searching for
// them stays precise.
const SYNONYM_GROUPS = [
  ["telefono", "telefonos", "celular", "celulares", "cel", "movil", "moviles", "phone", "phones", "smartphone", "smartphones"],
  ["audifonos", "audifono", "auriculares", "auricular", "headphones", "headphone", "earbuds", "earbud", "cascos"],
  ["tv", "tvs", "tele", "television", "televisor", "televisores", "pantalla", "pantallas"],
  ["bocina", "bocinas", "speaker", "speakers", "parlante", "parlantes", "altavoz", "altavoces"],
  ["laptop", "laptops", "computadora", "computadoras", "portatil", "portatiles", "notebook", "compu"],
  ["tablet", "tablets", "tableta", "tabletas"],
  ["reloj", "relojes", "watch", "watches", "smartwatch", "smartwatches"],
  ["impresora", "impresoras", "printer", "printers"],
  ["videojuego", "videojuegos", "juego", "juegos", "gaming", "consola", "consolas", "gamer", "control", "controles"],
  ["bolso", "bolsos", "bolsa", "bolsas", "cartera", "carteras", "purse", "purses", "handbag", "handbags"],
  ["plancha", "planchas", "straightener", "cabello", "pelo", "hair"],
  ["cargador", "cargadores", "charger", "chargers"],
  ["camara", "camaras", "camera", "cameras"],
  ["casa", "hogar", "home"],
  ["electronica", "electronicos", "electronics", "electronico"],
  ["inalambrico", "inalambricos", "inalambricas", "wireless", "bluetooth"],
  ["negro", "black"],
  ["blanco", "white"],
  ["azul", "blue"],
  ["rojo", "red"],
  ["rosa", "pink"],
  ["gris", "gray", "grey"],
];

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) SYNONYMS.set(word, group);
}

const STOPWORDS = new Set(["de", "del", "para", "con", "la", "el", "los", "las", "un", "una", "y", "en", "the", "for", "with", "and", "a", "of"]);

function variantsOf(token) {
  const out = new Set([token]);
  if (token.length > 4 && token.endsWith("es")) out.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s")) out.add(token.slice(0, -1));
  for (const v of [...out]) {
    const group = SYNONYMS.get(v);
    if (group) group.forEach((g) => out.add(g));
  }
  return [...out];
}

export function tokenize(query) {
  return normalize(query)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t));
}

/**
 * Search normalized products. Every query word must match (directly, via a
 * synonym, or with a one-letter typo). Returns products sorted by relevance.
 */
export function searchProducts(products, query, { limit } = {}) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const results = [];
  for (const p of products) {
    const words = p.searchText.split(" ");
    const name = normalize(p.name);
    const brand = normalize(p.brand);
    let score = 0;
    let ok = true;

    for (const token of tokens) {
      const alts = variantsOf(token);
      let best = 0;
      for (const alt of alts) {
        const direct = alt === token;
        if (brand && brand === alt) best = Math.max(best, 40);
        if (name.split(" ").includes(alt)) best = Math.max(best, direct ? 32 : 16);
        else if (name.includes(alt)) best = Math.max(best, direct ? 22 : 10);
        if (p.searchText.includes(alt)) best = Math.max(best, direct ? 12 : 6);
      }
      if (!best && token.length >= 4) {
        const maxDist = token.length >= 7 ? 2 : 1;
        if (words.some((w) => Math.abs(w.length - token.length) <= maxDist && editDistance(w, token) <= maxDist)) best = 3;
      }
      if (!best) {
        ok = false;
        break;
      }
      score += best;
    }
    if (!ok) continue;
    score += (p.inStock ? 4 : 0) + Math.min(6, p.performance) + (p.onSale ? 1 : 0);
    results.push({ p, score });
  }

  results.sort((a, b) => b.score - a.score);
  const list = results.map((r) => r.p);
  return limit ? list.slice(0, limit) : list;
}

/** Build a vocabulary once (brands, categories, product words) for suggestions. */
export function buildVocabulary(products, labelFns) {
  const phrases = new Map(); // normalized → display
  const words = new Set();
  const add = (display) => {
    const key = normalize(display);
    if (key && !phrases.has(key)) phrases.set(key, display);
  };
  for (const p of products) {
    if (p.brand) add(p.brand);
    add(labelFns.category(p.category));
    if (p.brand) add(`${p.brand} ${labelFns.category(p.category).toLowerCase()}`);
    p.searchText.split(" ").forEach((w) => w.length > 2 && words.add(w));
  }
  return { phrases, words: [...words] };
}

/** Autocomplete query suggestions (strings). */
export function suggestQueries(vocab, query, max = 6) {
  const q = normalize(query);
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const [key, display] of vocab.phrases) {
    if (key === q) continue;
    if (key.startsWith(q)) starts.push(display);
    else if (key.includes(` ${q}`) || (q.length > 2 && key.includes(q))) contains.push(display);
  }
  return [...starts.sort((a, b) => a.length - b.length), ...contains].slice(0, max);
}

/** "tabelt" → "tablet" when nothing matches. */
export function didYouMean(vocab, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return "";
  let changed = false;
  const fixed = tokens.map((t) => {
    if (t.length < 3 || vocab.words.includes(t) || SYNONYMS.has(t)) return t;
    let best = t;
    let bestD = t.length >= 7 ? 3 : 2;
    for (const w of [...vocab.words, ...SYNONYMS.keys()]) {
      if (Math.abs(w.length - t.length) >= bestD) continue;
      const d = editDistance(t, w);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (best !== t) changed = true;
    return best;
  });
  return changed ? fixed.join(" ") : "";
}
