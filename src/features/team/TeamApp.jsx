import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import {
  BellRinging,
  Briefcase,
  CheckCircle,
  ClockCounterClockwise,
  ListChecks,
  Power,
  ShieldWarning,
  SignIn,
  SignOut,
  SpeakerHigh,
  Translate,
  UserCircle,
} from "@phosphor-icons/react";
import * as team from "@backend/team";
import { Pin } from "@/components/brand/Logo";
import InstallApp from "@/components/InstallApp";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { EmptyState, Notice, Spinner } from "@/components/ui/Misc";
import { IS_DEMO } from "@/config/site";
import { useToast } from "@/context/ToastContext";
import { useI18n } from "@/i18n";
import { bookingIsOpen, vehicleText } from "@/lib/dispatch";
import { formatDate, money } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { initials } from "@/lib/text";
import { alertNewJob, askNotifications, chime, notificationState, setSoundOn, soundOn, unlockAudio } from "./alerts";
import JobDetail from "./JobDetail";
import { JobCard, ridePrice, TeamContext, useTeam } from "./jobs";
import { skillsOf, useJobs, useStaff, useTeamAuth } from "./useTeam";
import "./team.css";

/* ------------------------------ Sign in ------------------------------ */
function TeamLogin() {
  const { t, toggle } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const demoStaff = IS_DEMO && team.demoStaffList ? team.demoStaffList() : [];

  const run = async (fn) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await fn();
    } catch (err) {
      const code = String(err?.code || "");
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") || code.includes("invalid-email")
          ? t("team.wrongLogin")
          : code.includes("too-many-requests")
            ? t("team.tooMany")
            : code.includes("user-disabled")
              ? t("team.inactiveText")
              : t("team.loginError"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="team-gate">
      <div className="team-login">
        <div className="team-login__brand">
          <span className="team-login__pin">
            <Pin size={34} tone="light" />
          </span>
          <div>
            <strong>{t("team.appName")}</strong>
            <span>{t("team.tagline")}</span>
          </div>
        </div>
        <div>
          <h1 className="team-login__title">{t("team.signInTitle")}</h1>
          <p className="muted">{t("team.signInText")}</p>
        </div>
        {demoStaff.length > 0 && (
          <Notice tone="info">
            {t("team.demoTitle")}
            <div className="team-login__demo">
              {demoStaff.map((s) => (
                <Button key={s.id} size="sm" variant="secondary" onClick={() => run(() => team.teamSignIn(s.email))} disabled={busy}>
                  {s.name.split(" ")[0]} · {skillsOf(s).map((k) => t(`team.skills.${k}`)).join(", ")}
                </Button>
              ))}
            </div>
          </Notice>
        )}
        <form
          className="team-login__form"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => team.teamSignIn(email, password));
          }}
        >
          <TextField label={t("team.email")} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          <TextField label={t("team.password")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required={!IS_DEMO} />
          {error && <Notice tone="error">{error}</Notice>}
          {info && <Notice tone="success">{info}</Notice>}
          <Button type="submit" block size="lg" icon={SignIn} loading={busy}>
            {t("team.signIn")}
          </Button>
        </form>
        <div className="team-login__alt">
          <button
            type="button"
            className="team-link"
            onClick={() => {
              if (!email) {
                setError(t("team.forgotNeedEmail"));
                return;
              }
              run(async () => {
                await team.teamSendReset(email);
                setInfo(t("team.resetSent"));
              });
            }}
          >
            {t("team.forgot")}
          </button>
          <button type="button" className="team-link" onClick={toggle}>
            <Translate size={16} weight="bold" /> {t("nav.otherLangLong")}
          </button>
        </div>
        <TeamInstall />
      </div>
    </div>
  );
}

function NotStaff({ email, inactive }) {
  const { t } = useI18n();
  return (
    <div className="team-gate">
      <div className="team-login">
        <ShieldWarning size={44} weight="duotone" className="team-warn" />
        <h1 className="team-login__title">{inactive ? t("team.inactiveTitle") : t("team.notStaffTitle")}</h1>
        <p className="muted">{inactive ? t("team.inactiveText") : t("team.notStaffText", { email })}</p>
        <Button block variant="secondary" icon={SignOut} onClick={team.teamSignOut}>
          {t("team.useOther")}
        </Button>
      </div>
    </div>
  );
}

function TeamInstall() {
  const { t } = useI18n();
  return (
    <InstallApp
      id="team"
      icon="/apps/team-192.png"
      strings={{
        title: t("track.install.title", { brand: t("team.appName") }),
        text: t("team.tagline"),
        button: t("track.install.button"),
        iosTitle: t("track.install.iosTitle"),
        iosSteps: t("track.install.iosSteps"),
        later: t("track.install.later"),
        how: t("track.install.how"),
      }}
    />
  );
}

/* ------------------------------- Pages -------------------------------- */
function OpenJobs() {
  const { t } = useI18n();
  const { staff, jobs, setOnline, busy } = useTeam();
  const [filter, setFilter] = useState("all");
  const kinds = jobs.skills.filter((k) => filter === "all" || filter === k);
  const count = (k) => jobs.open[k].length;
  const total = jobs.skills.reduce((n, k) => n + count(k), 0);
  const active = jobs.skills.flatMap((k) => jobs.active[k].map((j) => ({ k, j }))).slice(0, 1)[0];

  return (
    <div className="team-page">
      <p className="team-hello">{t("team.hello", { name: String(staff.name || "").split(" ")[0] })}</p>

      {active && (
        <section>
          <h2 className="team-h2">{t("team.activeNow")}</h2>
          <JobCard kind={active.k} job={active.j} mine />
        </section>
      )}

      {!staff.online ? (
        <div className="team-offline">
          <Power size={34} weight="duotone" />
          <h2>{t("team.offlineTitle")}</h2>
          <p className="muted">{t("team.offlineText")}</p>
          <Button size="lg" onClick={() => setOnline(true)} loading={busy === "online"}>
            {t("team.goOnline")}
          </Button>
        </div>
      ) : (
        <>
          {jobs.skills.length > 1 && (
            <div className="team-filters" role="group">
              <button type="button" className={filter === "all" ? "is-active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                {t("travel.typeAll")} <span>{total}</span>
              </button>
              {jobs.skills.map((k) => (
                <button key={k} type="button" className={filter === k ? "is-active" : ""} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {t(`team.skills.${k}`)} <span>{count(k)}</span>
                </button>
              ))}
            </div>
          )}
          {!jobs.ready ? (
            <div className="team-center">
              <Spinner />
            </div>
          ) : kinds.some((k) => count(k)) ? (
            <div className="team-list">
              {kinds.flatMap((k) => jobs.open[k].map((j) => <JobCard key={`${k}-${j.id}`} kind={k} job={j} />))}
            </div>
          ) : (
            <EmptyState icon={BellRinging} title={t("team.noOpen")} text={t("team.noOpenText")} />
          )}
        </>
      )}
    </div>
  );
}

function MyJobs() {
  const { t } = useI18n();
  const { jobs } = useTeam();
  const list = jobs.skills.flatMap((k) => jobs.active[k].map((j) => ({ k, j })));
  return (
    <div className="team-page">
      <h1 className="team-h1">{t("team.tabs.mine")}</h1>
      {!jobs.ready ? (
        <div className="team-center">
          <Spinner />
        </div>
      ) : list.length ? (
        <div className="team-list">
          {list.map(({ k, j }) => (
            <JobCard key={`${k}-${j.id}`} kind={k} job={j} mine />
          ))}
        </div>
      ) : (
        <EmptyState icon={ListChecks} title={t("team.noMine")} text={t("team.noMineText")} />
      )}
    </div>
  );
}

function History() {
  const { t, lang } = useI18n();
  const { jobs } = useTeam();
  const list = jobs.skills
    .flatMap((k) => jobs.done[k].map((j) => ({ k, j, at: jobs.finishedAt(k, j) })))
    .sort((a, b) => b.at - a.at);
  const rideTotal = jobs.done.rides.reduce((s, r) => s + (Number(r.fare) || 0), 0);
  const days = [];
  for (const item of list) {
    const label = formatDate(item.at, lang, { weekday: "long", day: "numeric", month: "long" });
    if (!days.length || days[days.length - 1].label !== label) days.push({ label, items: [] });
    days[days.length - 1].items.push(item);
  }

  return (
    <div className="team-page">
      <h1 className="team-h1">{t("team.history.title")}</h1>
      <p className="muted">{t("team.history.subtitle")}</p>
      <div className="team-stats">
        {jobs.skills.map((k) => (
          <div key={k}>
            <strong>{jobs.done[k].length}</strong>
            <span>{t(`team.skills.${k}`)}</span>
          </div>
        ))}
        {rideTotal > 0 && (
          <div>
            <strong>{money(rideTotal, { whole: true })}</strong>
            <span>{t("team.skills.rides")} · {t("team.history.total")}</span>
          </div>
        )}
      </div>
      {!list.length ? (
        <EmptyState icon={ClockCounterClockwise} title={t("team.noHistory")} />
      ) : (
        days.map((d) => (
          <section key={d.label} className="team-day">
            <h2 className="team-h2">{d.label}</h2>
            <ul className="team-done">
              {d.items.map(({ k, j }) => (
                <li key={`${k}-${j.id}`}>
                  <Link to={`/equipo/trabajo/${k}/${encodeURIComponent(j.id)}`}>
                    <CheckCircle size={20} weight="fill" />
                    <span>
                      <strong>{k === "rides" ? `${j.pickup?.address || ""} → ${j.dropoff?.address || ""}` : k === "deliveries" ? `${j.orderNumber} · ${j.customerInfo?.city || ""}` : j.title}</strong>
                      <small>
                        {t(`team.skills.${k}`)}
                        {k === "rides" && ridePrice(j) ? ` · ${ridePrice(j)}` : ""}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Profile() {
  const { t, lang, setLang } = useI18n();
  const { staff } = useTeam();
  const [notif, setNotif] = useState(() => notificationState());
  const [sound, setSound] = useState(() => soundOn());
  const v = staff.vehicle || {};
  const skills = skillsOf(staff);

  return (
    <div className="team-page">
      <header className="team-me">
        <span className="team-me__avatar">{staff.photo ? <img src={staff.photo} alt="" /> : initials(staff.name)}</span>
        <div>
          <h1 className="team-h1">{staff.name}</h1>
          <p className="muted">
            {staff.email}
            {staff.phone ? ` · ${staff.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}` : ""}
          </p>
        </div>
      </header>

      <section className="team-card">
        <h2 className="team-h2">{t("team.profile.permissions")}</h2>
        <div className="team-chips">
          {skills.map((k) => (
            <span key={k} className="team-chip">
              <CheckCircle size={16} weight="fill" /> {t(`team.skills.${k}`)}
            </span>
          ))}
        </div>
      </section>

      <section className="team-card">
        <h2 className="team-h2">{t("team.profile.vehicle")}</h2>
        {v.make || v.model || v.plate ? (
          <p className="team-vehicle">
            <strong>{vehicleText(v)}</strong>
            {v.plate && <span className="trk-plate">{v.plate}</span>}
            {v.seats ? <span className="muted">{t("team.profile.seats", { n: v.seats })}</span> : null}
          </p>
        ) : (
          <p className="muted">{t("team.profile.noVehicle")}</p>
        )}
        <p className="muted small">{t("team.profile.changes")}</p>
      </section>

      <section className="team-card">
        <h2 className="team-h2">{t("team.profile.alerts")}</h2>
        <p className="muted small">{t("team.profile.alertsText")}</p>
        <div className="team-row">
          <label className="team-switch">
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSoundOn(e.target.checked);
                setSound(e.target.checked);
              }}
            />
            <SpeakerHigh size={18} weight="bold" /> {t("team.profile.alerts")}
          </label>
          <Button size="sm" variant="secondary" onClick={() => chime()}>
            {t("team.profile.testSound")}
          </Button>
        </div>
        {notif === "default" && (
          <Button size="sm" icon={BellRinging} onClick={async () => setNotif(await askNotifications())}>
            {t("team.profile.alertsEnable")}
          </Button>
        )}
        {notif === "granted" && (
          <p className="team-ok small">
            <CheckCircle size={16} weight="fill" /> {t("team.profile.alertsOn")}
          </p>
        )}
        {notif === "denied" && <p className="muted small">{t("team.profile.alertsBlocked")}</p>}
      </section>

      <section className="team-card">
        <h2 className="team-h2">{t("team.profile.language")}</h2>
        <div className="team-chips">
          {["es", "en"].map((l) => (
            <button key={l} type="button" className={`team-chip ${lang === l ? "is-active" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
              {l === "es" ? "Español" : "English"}
            </button>
          ))}
        </div>
      </section>

      <TeamInstall />

      <Button block variant="secondary" icon={SignOut} onClick={team.teamSignOut}>
        {t("team.signOut")}
      </Button>
    </div>
  );
}

/* -------------------------------- Shell -------------------------------- */
function TeamShell({ staff }) {
  const { t } = useI18n();
  const toast = useToast();
  const jobs = useJobs(staff);
  const [busy, setBusy] = useState("");
  const seen = useRef(null);

  // Sound needs a first tap on the page
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // "I'm still here" every minute while available, so the office sees who's really online
  useEffect(() => {
    if (!staff.online) return undefined;
    const beat = () => !document.hidden && team.heartbeat(staff.uid).catch(() => {});
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [staff.online, staff.uid]);

  // New open jobs → chime, vibrate and (in the background) a notification
  const openIds = useMemo(() => jobs.skills.flatMap((k) => jobs.open[k].map((j) => `${k}:${j.id}`)), [jobs]);
  useEffect(() => {
    if (!jobs.ready) return;
    if (seen.current === null) {
      seen.current = new Set(openIds);
      return;
    }
    const fresh = openIds.filter((id) => !seen.current.has(id));
    seen.current = new Set(openIds);
    if (fresh.length && staff.online) {
      const title = fresh.length === 1 ? t("team.newJob") : t("team.newJobs", { n: fresh.length });
      alertNewJob(title, t("team.appName"));
      toast.info(title);
    }
  }, [openIds, jobs.ready, staff.online, t, toast]);

  const run = useCallback(
    async (key, fn, message) => {
      setBusy(key);
      try {
        await fn();
        if (message) toast.success(message);
        return true;
      } catch (err) {
        console.error(err);
        toast.error(err?.code === "job/taken" ? t("team.taken") : t("team.failed"));
        return false;
      } finally {
        setBusy("");
      }
    },
    [toast, t],
  );

  const act = useMemo(
    () => ({
      accept: (kind, job) =>
        run(
          `accept:${job.id}`,
          () =>
            kind === "rides"
              ? team.acceptRide(job.id, staff)
              : kind === "deliveries"
                ? team.acceptDelivery(job.id, staff)
                : team.acceptDeparture(job.bookings.filter(bookingIsOpen).map((b) => b.id), staff),
          t("team.accepted"),
        ),
      step: (kind, job, to, opts) =>
        run(
          `step:${to}`,
          () =>
            kind === "rides"
              ? team.rideStep(job.id, to)
              : kind === "deliveries"
                ? team.deliveryStepTo(job.id, to, opts)
                : team.departureStep(job.bookings.filter((b) => b.guideUid === staff.uid).map((b) => b.id), to),
          t("team.saved"),
        ),
      release: (kind, job) =>
        run(
          "release",
          () =>
            kind === "rides"
              ? team.releaseRide(job.id)
              : kind === "deliveries"
                ? team.releaseDelivery(job.id)
                : team.releaseDeparture(job.bookings.filter((b) => b.guideUid === staff.uid).map((b) => b.id)),
          t("team.released"),
        ),
    }),
    [run, staff, t],
  );

  const setOnline = useCallback(
    (online) => run("online", () => team.setOnline(staff.uid, online), online ? t("team.nowOnline") : t("team.nowOffline")),
    [run, staff.uid, t],
  );

  const activeCount = jobs.skills.reduce((n, k) => n + jobs.active[k].length, 0);
  const ctx = useMemo(() => ({ staff, jobs, act, busy, setOnline, now: jobs.now }), [staff, jobs, act, busy, setOnline]);

  return (
    <TeamContext.Provider value={ctx}>
      <div className="team">
        <header className="team-top">
          <Link to="/equipo" className="team-top__brand" aria-label={t("team.appName")}>
            <Pin size={26} tone="dark" />
            <span>
              <strong>Express</strong> {t("team.short")}
            </span>
          </Link>
          <button type="button" className={`team-online ${staff.online ? "is-on" : ""}`} role="switch" aria-checked={Boolean(staff.online)} onClick={() => setOnline(!staff.online)} disabled={busy === "online"}>
            <span className="team-online__dot" />
            {staff.online ? t("team.online") : t("team.offline")}
          </button>
        </header>

        <main className="team-main" id="main">
          <Routes>
            <Route index element={<OpenJobs />} />
            <Route path="mis-trabajos" element={<MyJobs />} />
            <Route path="historial" element={<History />} />
            <Route path="perfil" element={<Profile />} />
            <Route path="trabajo/:kind/:id" element={<JobDetail />} />
            <Route path="*" element={<Navigate to="/equipo" replace />} />
          </Routes>
        </main>

        <nav className="team-tabs" aria-label={t("team.appName")}>
          <NavLink to="/equipo" end className={({ isActive }) => (isActive ? "is-active" : "")}>
            <Briefcase size={24} weight="duotone" />
            <span>{t("team.tabs.open")}</span>
          </NavLink>
          <NavLink to="/equipo/mis-trabajos" className={({ isActive }) => (isActive ? "is-active" : "")}>
            <ListChecks size={24} weight="duotone" />
            <span>{t("team.tabs.mine")}</span>
            {activeCount > 0 && <em className="team-tabs__badge">{activeCount}</em>}
          </NavLink>
          <NavLink to="/equipo/historial" className={({ isActive }) => (isActive ? "is-active" : "")}>
            <ClockCounterClockwise size={24} weight="duotone" />
            <span>{t("team.tabs.history")}</span>
          </NavLink>
          <NavLink to="/equipo/perfil" className={({ isActive }) => (isActive ? "is-active" : "")}>
            <UserCircle size={24} weight="duotone" />
            <span>{t("team.tabs.profile")}</span>
          </NavLink>
        </nav>
      </div>
    </TeamContext.Provider>
  );
}

/* ------------------------------- App ---------------------------------- */
export default function TeamApp() {
  const { t } = useI18n();
  const { user, loading } = useTeamAuth();
  const staff = useStaff(user?.uid);
  useSeo({ title: t("team.appName"), noindex: true });

  useEffect(() => {
    document.body.className = "theme-light theme-team";
  }, []);

  if (loading || (user && staff === undefined)) {
    return (
      <div className="team-gate">
        <Spinner label="…" />
      </div>
    );
  }
  if (!user) return <TeamLogin />;
  if (!staff) return <NotStaff email={user.email} />;
  if (staff.active === false) return <NotStaff email={user.email} inactive />;
  return <TeamShell staff={staff} />;
}
