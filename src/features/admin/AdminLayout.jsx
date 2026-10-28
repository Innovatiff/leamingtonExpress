import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  AirplaneTilt,
  ArrowSquareOut,
  ChatsCircle,
  Car,
  ClipboardText,
  GearSix,
  List,
  MapTrifold,
  Package,
  SignOut,
  SquaresFour,
  Ticket,
  X,
} from "@phosphor-icons/react";
import * as backend from "@backend";
import { Pin } from "@/components/brand/Logo";
import { CITIES } from "@/config/cities";
import { CITY, IS_DEMO } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { readJSON, writeJSON } from "@/lib/storage";
import { AdminCityContext } from "./components/AdminUI";
import { cityOf, useCollection } from "./lib";

const CITY_KEY = "lx_admin_city";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: SquaresFour, end: true },
  { to: "/admin/pedidos", label: "Orders", icon: ClipboardText, badge: "orders" },
  { to: "/admin/rides", label: "Rides", icon: Car, badge: "rides" },
  { to: "/admin/reservas", label: "Travel bookings", icon: AirplaneTilt, badge: "bookings" },
  { section: "Catalog" },
  { to: "/admin/productos", label: "Products", icon: Package },
  { to: "/admin/viajes", label: "Trips", icon: MapTrifold },
  { to: "/admin/cupones", label: "Discount codes", icon: Ticket },
  { section: "Customers" },
  { to: "/admin/mensajes", label: "Messages", icon: ChatsCircle, badge: "messages" },
  { to: "/admin/ajustes", label: "Settings", icon: GearSix },
];

/** Work waiting for the team — shown as badges in the menu. */
function useBadges(city) {
  const orders = useCollection("orders").data;
  const rides = useCollection("rides").data;
  const bookings = useCollection("bookings").data;
  const messages = useCollection("messages").data;
  return useMemo(() => {
    const here = (r) => cityOf(r) === city;
    return {
      orders: orders.filter((o) => here(o) && o.status !== "Cancelled" && o.status !== "Closed" && o.fulfilment !== "Fulfilled").length,
      rides: rides.filter((r) => here(r) && r.status === "requested").length,
      bookings: bookings.filter((b) => here(b) && b.status === "pending").length,
      messages: messages.filter((m) => here(m) && (m.status || "new") === "new").length,
    };
  }, [orders, rides, bookings, messages, city]);
}

export default function AdminLayout({ onSignOut }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [city, setCityState] = useState(() => {
    const saved = readJSON(CITY_KEY, null);
    return CITIES[saved] ? saved : CITY.id;
  });
  const setCity = useCallback((next) => {
    setCityState(next);
    writeJSON(CITY_KEY, next);
  }, []);
  const badges = useBadges(city);
  const cityCtx = useMemo(() => ({ city, setCity }), [city, setCity]);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <AdminCityContext.Provider value={cityCtx}>
      <div className={`ad ${menuOpen ? "is-menu-open" : ""}`}>
        <aside className="ad-side" aria-label="Admin menu">
          <div className="ad-side__brand">
            <Pin size={30} tone="light" />
            <div>
              <strong>Express Admin</strong>
              <span>{IS_DEMO ? "Demo data" : backend.MODE === "firebase" ? "Live data" : ""}</span>
            </div>
            <button type="button" className="ad-side__close icon-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
          </div>

          <label className="ad-side__city">
            <span>City</span>
            <select value={city} onChange={(e) => setCity(e.target.value)}>
              {Object.values(CITIES).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand}
                  {c.active ? "" : " (coming soon)"}
                </option>
              ))}
            </select>
          </label>

          <nav className="ad-nav">
            {NAV.map((item) =>
              item.section ? (
                <span key={item.section} className="ad-nav__section">
                  {item.section}
                </span>
              ) : (
                <NavLink key={item.to} to={item.to} end={item.end} className="ad-nav__link">
                  <item.icon size={20} weight="duotone" />
                  <span>{item.label}</span>
                  {item.badge && badges[item.badge] > 0 && <span className="ad-nav__badge">{badges[item.badge]}</span>}
                </NavLink>
              ),
            )}
          </nav>

          <div className="ad-side__foot">
            <Link to="/" className="ad-nav__link" target="_blank" rel="noreferrer">
              <ArrowSquareOut size={20} weight="duotone" />
              <span>View website</span>
            </Link>
            <div className="ad-side__user">
              <span className="ad-side__avatar" aria-hidden="true">
                {(user?.email || "A").charAt(0).toUpperCase()}
              </span>
              <span className="ad-side__email">{user?.email}</span>
              <button type="button" className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
                <SignOut size={18} weight="bold" />
              </button>
            </div>
          </div>
        </aside>
        <div className="ad-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />

        <div className="ad-main">
          <header className="ad-top">
            <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
              <List size={22} weight="bold" />
            </button>
            <span className="ad-top__title">
              <Pin size={22} tone="light" /> Express Admin
            </span>
            <span className="ad-top__city">{CITIES[city]?.name}</span>
          </header>
          <main className="ad-content" id="main">
            <Outlet />
          </main>
        </div>
      </div>
    </AdminCityContext.Provider>
  );
}
