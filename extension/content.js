// Express — the "Add to Express" button on Walmart.ca and Amazon.ca product pages (and on any
// store's page after you press the Express button in the toolbar). It reads the product with
// extract.js and hands it to background.js, which puts it on your admin's list.
(function () {
  "use strict";
  if (globalThis.__expressAdd || !globalThis.ExpressExtract) return;
  const X = globalThis.ExpressExtract;
  const AFTER_RELOAD = "express-add-after-reload";
  // the page's own data describes the product it loaded with; after Walmart moves to another
  // product without reloading, it may not
  const loadedPath = location.pathname;

  /* ------------------------------- Button ------------------------------- */

  // Built without innerHTML (some stores lock that down), inside a shadow root so the
  // store's styles don't touch it.
  const host = document.createElement("div");
  host.setAttribute("data-express-add", "");
  host.style.cssText = "all:initial;position:fixed;left:20px;bottom:20px;z-index:2147483646;display:none";
  // open, so browser tools (and an assistant driving the browser) can find the button
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .wrap { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; font: 500 14px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .row { display: flex; align-items: center; gap: 6px; }
    button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 9px; height: 46px;
      padding: 0 20px 0 14px; border-radius: 999px; color: #fff; font: 700 15px/1 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #2f6bff, #0a2bb8); box-shadow: 0 10px 28px -10px rgba(10, 43, 184, 0.75), 0 2px 6px rgba(0, 0, 0, 0.18);
      transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s; }
    button:hover { transform: translateY(-2px); box-shadow: 0 16px 34px -12px rgba(10, 43, 184, 0.85), 0 2px 6px rgba(0, 0, 0, 0.2); }
    button:focus-visible { outline: 3px solid #ffb38a; outline-offset: 3px; }
    button[disabled] { opacity: 0.7; cursor: progress; transform: none; }
    svg { width: 18px; height: 23px; flex: none; }
    .close { all: unset; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
      background: rgba(11, 29, 51, 0.72); color: #fff; font: 700 15px/1 system-ui, sans-serif; }
    .close:hover { background: rgba(11, 29, 51, 0.9); }
    .toast { max-width: 320px; padding: 10px 14px; border-radius: 12px; color: #fff; background: #0b1d33;
      box-shadow: 0 10px 30px -12px rgba(0, 0, 0, 0.5); }
    .toast.good { background: #0f7a4d; }
    .toast.warn { background: #9a4a00; }
    .toast.bad { background: #b42318; }
    .toast[hidden] { display: none; }
  `;

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  toastEl.hidden = true;
  toastEl.setAttribute("role", "status");
  const row = document.createElement("div");
  row.className = "row";
  const button = document.createElement("button");
  button.type = "button";
  button.title = "Send this product to your Express admin (Alt+Shift+E)";
  button.setAttribute("aria-label", "Add to Express");
  const label = document.createElement("span");
  label.textContent = "Add to Express";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "close";
  close.title = "Hide on this page";
  close.setAttribute("aria-label", "Hide this button on this page"); // not "Add to Express": an assistant looks for that name
  close.textContent = "×";

  // the Express pin, in white
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 128");
  svg.setAttribute("aria-hidden", "true");
  for (const [d, opacity] of [
    ["M25.6 94.7C14 80 8 63 8 46 8 22.8 26.8 4 50 4s42 18.8 42 42c0 5.5-.3 10.6-.8 15.4Q60 86 25.6 94.7ZM50 28a17 17 0 1 0 0 34 17 17 0 1 0 0-34Z", "1"],
    ["M32.4 105.6Q63 93 90 63.4C85 85 70 103 50.4 124 45 116 39 110 32.4 105.6Z", "0.7"],
  ]) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#fff");
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("opacity", opacity);
    svg.append(path);
  }
  button.append(svg, label);
  row.append(button, close);
  wrap.append(toastEl, row);
  root.append(style, wrap);
  (document.body || document.documentElement).append(host);

  let hidden = false;
  let forced = false; // shown by the toolbar button on a page that isn't Walmart or Amazon
  let busy = false;
  let toastTimer = 0;

  /** status (added, error, reloading) is also written on the page, for an assistant to read */
  function toast(message, tone = "", status = "") {
    toastEl.textContent = message;
    toastEl.className = `toast ${tone}`;
    toastEl.hidden = false;
    host.setAttribute("data-express-status", status || tone || "info");
    host.setAttribute("data-express-message", message);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 6000);
  }

  function setBusy(on) {
    busy = on;
    button.disabled = on;
    label.textContent = on ? "Adding…" : "Add to Express";
  }

  const money = (n) => `$${Number(n).toFixed(2)}`;

  /* -------------------------------- Add --------------------------------- */

  async function add() {
    if (busy) return;
    if (X.supplierOf(location.href) !== "other" && !X.isProductPage(document, location.href)) {
      toast("Open a product's own page first, then add it.", "bad", "error");
      return;
    }
    let product;
    try {
      product = X.extract(document, location.href, { fresh: location.pathname === loadedPath });
    } catch (err) {
      console.warn("Express: couldn't read this page", err);
      toast("This page couldn't be read. Reload it and try again.", "bad", "error");
      return;
    }
    if (product.stale) {
      // Walmart switched products without reloading: its data is still the previous product's
      try {
        sessionStorage.setItem(AFTER_RELOAD, location.href);
      } catch {
        /* private mode: the button still works after a manual reload */
      }
      toast("Reloading the page to read this product…", "", "reloading");
      setTimeout(() => location.reload(), 500);
      return;
    }
    if (!product.name) {
      toast("No product found here. Open the product's own page, then press Add to Express.", "bad", "error");
      return;
    }
    setBusy(true);
    try {
      const answer = await chrome.runtime.sendMessage({ type: "express-add", product });
      if (!answer || !answer.ok) throw new Error((answer && answer.error) || "No answer");
      if (!(product.price > 0)) toast("Added to your Express list. This page shows no price: type it there.", "warn", "added");
      else if (product.available === false) toast(`Added (${money(product.price)}), but it's out of stock here: it will show as sold out.`, "warn", "added");
      else toast(`Added to your Express list · ${money(product.price)}`, "good", "added");
    } catch (err) {
      console.warn("Express:", err);
      toast("Couldn't reach Express. Reload this page and try again.", "bad", "error");
    } finally {
      setBusy(false);
    }
  }

  button.addEventListener("click", add);
  // Alt+Shift+E (Option+Shift+E on a Mac) adds without looking for the button. The browser
  // usually takes the shortcut itself (background.js); this is for when the page gets it.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === "KeyE") {
        e.preventDefault();
        e.stopPropagation();
        globalThis.__expressAdd();
      }
    },
    true,
  );
  close.addEventListener("click", () => {
    hidden = true;
    host.style.display = "none";
  });

  /** The toolbar button: add this page's product, and show the button here from now on. */
  globalThis.__expressAdd = () => {
    forced = true;
    hidden = false;
    host.style.display = "";
    return add();
  };

  /* ------------------------------- Showing ------------------------------- */

  // Walmart and Amazon change pages without reloading: check the address now and then
  let lastUrl = "";
  let wasProduct = false;
  function refresh() {
    const changed = location.href !== lastUrl;
    if (!changed && (wasProduct || forced)) return;
    if (changed) {
      lastUrl = location.href;
      hidden = false;
    }
    try {
      wasProduct = X.supplierOf(location.href) !== "other" && X.isProductPage(document, location.href);
    } catch {
      wasProduct = false;
    }
    host.style.display = (wasProduct || forced) && !hidden ? "" : "none";
  }
  refresh();
  setInterval(refresh, 1200);

  // after the reload above, add it by itself
  try {
    if (sessionStorage.getItem(AFTER_RELOAD) === location.href) {
      sessionStorage.removeItem(AFTER_RELOAD);
      setTimeout(add, 1500);
    }
  } catch {
    /* no sessionStorage */
  }

  // A product page opened with #express-add at the end of its address is added by itself,
  // once: the simplest way for an assistant driving the browser (nothing to find or click)
  const AUTO = "#express-add";
  function addFromAddress() {
    if (location.hash !== AUTO) return;
    history.replaceState(history.state, "", location.pathname + location.search);
    setTimeout(add, 1500);
  }
  addFromAddress();
  window.addEventListener("hashchange", addFromAddress);
})();
