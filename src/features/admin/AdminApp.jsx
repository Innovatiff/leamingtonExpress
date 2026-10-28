import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { GoogleLogo, LockKey, ShieldWarning, SignIn } from "@phosphor-icons/react";
import * as backend from "@backend";
import Logo from "@/components/brand/Logo";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Misc";
import { IS_DEMO } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useSeo } from "@/lib/seo";
import AdminLayout from "./AdminLayout";
import { closeCollections } from "./lib";
import Dashboard from "./pages/Dashboard";
import "./admin.css";

const Orders = lazy(() => import("./pages/Orders"));
const Rides = lazy(() => import("./pages/Rides"));
const Bookings = lazy(() => import("./pages/Bookings"));
const Products = lazy(() => import("./pages/Products"));
const ProductEditor = lazy(() => import("./pages/ProductEditor"));
const Trips = lazy(() => import("./pages/Trips"));
const TripEditor = lazy(() => import("./pages/TripEditor"));
const Discounts = lazy(() => import("./pages/Discounts"));
const Messages = lazy(() => import("./pages/Messages"));
const Settings = lazy(() => import("./pages/Settings"));
const Employees = lazy(() => import("./pages/Employees"));

function useBodyTheme() {
  useEffect(() => {
    document.body.className = "theme-light theme-admin";
  }, []);
}

/** Who may enter: the owner UID(s) in config/firebase.js or anyone listed in express_admins. */
function useAdminCheck(uid) {
  const [result, setResult] = useState({ uid: null, ok: false });
  useEffect(() => {
    if (!uid) return undefined;
    let alive = true;
    backend
      .checkAdmin(uid)
      .then((ok) => alive && setResult({ uid, ok }))
      .catch(() => alive && setResult({ uid, ok: false }));
    return () => {
      alive = false;
    };
  }, [uid]);
  return result.uid === uid ? result.ok : null;
}

export default function AdminApp() {
  const { user, loading, signOut } = useAuth();
  const isAdmin = useAdminCheck(user?.uid);
  useBodyTheme();
  useSeo({ title: "Admin", noindex: true });

  const logout = async () => {
    closeCollections();
    await signOut();
  };

  if (loading || (user && isAdmin === null)) {
    return (
      <div className="ad-gate">
        <Spinner label="Loading…" />
      </div>
    );
  }
  if (!user) return <AdminLogin />;
  if (!isAdmin) return <NoAccess email={user.email} uid={user.uid} onSignOut={logout} />;

  return (
    <Routes>
      <Route element={<AdminLayout onSignOut={logout} />}>
        <Route index element={<Dashboard />} />
        <Route path="pedidos" element={<Lazy el={<Orders />} />} />
        <Route path="rides" element={<Lazy el={<Rides />} />} />
        <Route path="reservas" element={<Lazy el={<Bookings />} />} />
        <Route path="empleados" element={<Lazy el={<Employees />} />} />
        <Route path="productos" element={<Lazy el={<Products />} />} />
        <Route path="productos/nuevo" element={<Lazy el={<ProductEditor />} />} />
        <Route path="productos/:id" element={<Lazy el={<ProductEditor />} />} />
        <Route path="viajes" element={<Lazy el={<Trips />} />} />
        <Route path="viajes/nuevo" element={<Lazy el={<TripEditor />} />} />
        <Route path="viajes/:id" element={<Lazy el={<TripEditor />} />} />
        <Route path="cupones" element={<Lazy el={<Discounts />} />} />
        <Route path="mensajes" element={<Lazy el={<Messages />} />} />
        <Route path="ajustes" element={<Lazy el={<Settings />} />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

function Lazy({ el }) {
  return (
    <Suspense
      fallback={
        <div className="ad-page-loading">
          <Spinner label="Loading…" />
        </div>
      }
    >
      {el}
    </Suspense>
  );
}

function AdminLogin() {
  const { signIn, signInWithGoogle, sendReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      const code = String(err?.code || "");
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")
          ? "Wrong email or password."
          : code.includes("too-many-requests")
            ? "Too many attempts. Try again in a few minutes."
            : code.includes("popup")
              ? "The Google window was closed before finishing."
              : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-gate">
      <div className="ad-login">
        <Logo tone="light" />
        <div>
          <h1 className="ad-login__title">
            <LockKey size={22} weight="bold" /> Admin
          </h1>
          <p className="muted">Orders, rides, travel bookings and products.</p>
        </div>
        {IS_DEMO && backend.signInDemoAdmin && (
          <Notice tone="info">
            Demo mode — explore the admin with sample data.
            <Button size="sm" className="ad-login__demo" onClick={() => run(backend.signInDemoAdmin)} loading={busy}>
              Enter demo
            </Button>
          </Notice>
        )}
        <form
          className="ad-login__form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => signIn(email, password));
          }}
        >
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="success">{info}</Notice>}
          <Button type="submit" block size="lg" icon={SignIn} loading={busy}>
            Sign in
          </Button>
        </form>
        <div className="ad-login__alt">
          <Button variant="secondary" block icon={GoogleLogo} onClick={() => run(signInWithGoogle)} disabled={busy}>
            Continue with Google
          </Button>
          <button
            type="button"
            className="ad-link"
            onClick={() => {
              if (!email) {
                setError("Type your email first, then press “Forgot password”.");
                return;
              }
              run(async () => {
                await sendReset(email);
                setInfo("We sent you an email to reset your password.");
              });
            }}
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}

function NoAccess({ email, uid, onSignOut }) {
  return (
    <div className="ad-gate">
      <div className="ad-login">
        <ShieldWarning size={40} weight="duotone" className="ad-login__warn" />
        <h1 className="ad-login__title">No admin access</h1>
        <p className="muted">
          <strong>{email}</strong> is signed in but isn’t an administrator.
        </p>
        <p className="small muted">
          To give this account access, create the document <code>express_admins/{uid}</code> in Firestore (any content, e.g. <code>{"{ role: \"admin\" }"}</code>).
        </p>
        <div className="ad-login__alt">
          <Button variant="secondary" block onClick={onSignOut}>
            Sign in with another account
          </Button>
          <Button variant="ghost" block to="/">
            Back to the website
          </Button>
        </div>
      </div>
    </div>
  );
}
