// Live map (MapLibre + OpenFreeMap tiles: free, no API key). Loaded only when a
// customer's page or the admin shows an employee on the way.
import { useEffect, useRef, useState } from "react";
import { AttributionControl, LngLatBounds, Map as MapLibre, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import "./LiveMap.css";

setWorkerUrl(workerUrl);

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

const ICONS = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 19 20.5l-7-3.6-7 3.6z" fill="currentColor"/></svg>',
  car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 11.2 6.6 6.6A2.3 2.3 0 0 1 8.8 5h6.4a2.3 2.3 0 0 1 2.2 1.6l1.6 4.6v6.3a1 1 0 0 1-1 1h-1.3a1 1 0 0 1-1-1v-1H7.3v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.3zm2.4-.7h9.2l-1.1-3.2a.8.8 0 0 0-.8-.5H9.3a.8.8 0 0 0-.8.5zM7.6 14.6a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zm8.8 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z"/></svg>',
  box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.6 8.4 4.6v9.6L12 21.4l-8.4-4.6V7.2zm0 2.3L6.3 8 12 11.1 17.7 8zm-6.6 4.6v6.2l5.7 3.1v-6.2zm13.2 0-5.7 3.1v6.2l5.7-3.1z"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12.2a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2zm-7.5 7.7c.7-3.4 3.8-5.7 7.5-5.7s6.8 2.3 7.5 5.7a.9.9 0 0 1-.9 1.1H5.4a.9.9 0 0 1-.9-1.1z"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11.3 3.3a1 1 0 0 1 1.4 0l8 7.4a.9.9 0 0 1-.6 1.6H19v7.2a1 1 0 0 1-1 1h-3.6v-5.2h-4.8v5.2H6a1 1 0 0 1-1-1v-7.2H3.9a.9.9 0 0 1-.6-1.6z"/></svg>',
};

function element(className, html, label) {
  const node = document.createElement("div");
  node.className = className;
  node.innerHTML = html;
  if (label) {
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", label);
  }
  return node;
}

/** Can this browser draw the map? (MapLibre needs WebGL 2) */
function canDraw() {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

const hasHeading = (h) => Number.isFinite(h);

/**
 * driver = { lat, lng, heading? } · target = { lat, lng } or null (pick-up point / door)
 * kind = "ride" | "order" · labels = { driver, target, center, fallback, openMaps }
 */
export default function LiveMap({ driver, target, kind = "ride", targetIcon = "person", labels }) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const marks = useRef({});
  const anim = useRef(0);
  const follow = useRef(true);
  const first = useRef(driver);
  const words = useRef(labels);
  const { lat, lng, heading } = driver;
  const tLat = target?.lat;
  const tLng = target?.lng;
  useEffect(() => {
    words.current = labels;
  }, [labels]);
  const [supported] = useState(canDraw);
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(true);

  // The map itself (once)
  useEffect(() => {
    if (!supported || !box.current) return undefined;
    const start = first.current;
    const map = new MapLibre({
      container: box.current,
      style: MAP_STYLE,
      center: [start.lng, start.lat],
      zoom: 14,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e) => {
      if (!map.isStyleLoaded()) {
        console.warn("Live map unavailable", e?.error?.message || e);
        setFailed(true);
      }
    });
    // Once the customer moves the map, stop re-centring until they ask for it
    const stopFollowing = (e) => {
      if (e.originalEvent) {
        follow.current = false;
        setFollowing(false);
      }
    };
    map.on("dragstart", stopFollowing);
    map.on("zoomstart", stopFollowing);
    mapRef.current = map;
    return () => {
      cancelAnimationFrame(anim.current);
      map.remove();
      mapRef.current = null;
      marks.current = {};
    };
  }, [supported]);

  // Markers and camera, on every new position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const m = marks.current;
    const driverAt = { lat, lng };
    const targetAt = tLat != null && tLng != null ? { lat: tLat, lng: tLng } : null;

    const icon = hasHeading(heading) ? ICONS.arrow : kind === "order" ? ICONS.box : ICONS.car;
    if (!m.driver) {
      m.driver = new Marker({ element: element("lm-driver", `<span class="lm-driver__pulse"></span><span class="lm-driver__dot">${icon}</span>`, words.current?.driver), rotationAlignment: "map" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      m.driver.getElement().querySelector(".lm-driver__dot").innerHTML = icon;
      // glide to the new spot instead of jumping
      const from = m.driver.getLngLat();
      const t0 = performance.now();
      cancelAnimationFrame(anim.current);
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 900);
        const e = k * (2 - k);
        m.driver.setLngLat([from.lng + (lng - from.lng) * e, from.lat + (lat - from.lat) * e]);
        if (k < 1) anim.current = requestAnimationFrame(step);
      };
      anim.current = requestAnimationFrame(step);
    }
    m.driver.setRotation(hasHeading(heading) ? heading : 0);

    if (targetAt) {
      const html = `<span class="lm-pin__head">${ICONS[targetIcon] || ICONS.person}</span>`;
      if (!m.target) m.target = new Marker({ element: element("lm-pin", html, words.current?.target), anchor: "bottom" }).setLngLat([targetAt.lng, targetAt.lat]).addTo(map);
      else m.target.setLngLat([targetAt.lng, targetAt.lat]);
    } else if (m.target) {
      m.target.remove();
      m.target = null;
    }

    if (follow.current) frame(map, driverAt, targetAt);
  }, [lat, lng, heading, tLat, tLng, kind, targetIcon]);

  if (!supported || failed) {
    return (
      <div className="lm lm--fallback">
        <p>{labels?.fallback}</p>
        <a href={`https://www.google.com/maps/search/?api=1&query=${driver.lat},${driver.lng}`} target="_blank" rel="noreferrer" className="lm__link">
          {labels?.openMaps}
        </a>
      </div>
    );
  }

  return (
    <div className="lm">
      <div ref={box} className="lm__canvas" />
      {!following && (
        <button
          type="button"
          className="lm__center"
          onClick={() => {
            follow.current = true;
            setFollowing(true);
            if (mapRef.current) frame(mapRef.current, driver, target);
          }}
        >
          {labels?.center}
        </button>
      )}
    </div>
  );
}

function frame(map, driver, target) {
  if (target) {
    const bounds = new LngLatBounds([driver.lng, driver.lat], [driver.lng, driver.lat]).extend([target.lng, target.lat]);
    map.fitBounds(bounds, { padding: { top: 56, bottom: 44, left: 44, right: 56 }, maxZoom: 16, duration: 900 });
  } else {
    map.easeTo({ center: [driver.lng, driver.lat], zoom: Math.max(map.getZoom(), 15), duration: 900 });
  }
}
