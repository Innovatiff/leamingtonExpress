import { useEffect } from "react";
import { SITE_NAME, SITE_URL } from "@/config/site";

function setMeta(attr, key, content) {
  if (content == null) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Per-page <title>, description, Open Graph and robots tags. */
export function useSeo({ title, description, image, noindex = false, path } = {}) {
  useEffect(() => {
    const full = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}`;
    document.title = full;
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
    }
    setMeta("property", "og:title", full);
    if (image) setMeta("property", "og:image", image.startsWith("http") ? image : `${SITE_URL}${image}`);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    const url = `${SITE_URL}${path ?? window.location.pathname}`;
    setMeta("property", "og:url", url);
    setCanonical(url);
  }, [title, description, image, noindex, path]);
}
