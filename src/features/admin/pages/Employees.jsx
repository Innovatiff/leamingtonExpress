import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowSquareOut,
  ChatCircleText,
  CheckCircle,
  Copy,
  IdentificationBadge,
  Lightning,
  Password,
  Trash,
  UploadSimple,
  UserPlus,
} from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Misc";
import { Drawer } from "@/components/ui/Overlay";
import { CITIES } from "@/config/cities";
import { CITY } from "@/config/site";
import { useToast } from "@/context/ToastContext";
import { SKILLS } from "@/lib/dispatch";
import { Card, Empty, ErrorNote, PageHead, Pill, SearchInput, Tabs, Toggle, useAdminCity, useConfirm } from "../components/AdminUI";
import { Avatar, lastSeenText, SKILL_INFO, SkillChips, useStaffList, useTeamWork, VehicleLine } from "../components/Staff";
import { matches, phonePretty, shortDate, waHref } from "../lib";
import { canUpload, uploadImage } from "../upload";

const FILTERS = {
  all: { label: "Team", test: (s) => s.active !== false },
  online: { label: "Online now", test: (s) => s._presence.key === "online" },
  rides: { label: "Rides", test: (s) => s.active !== false && s.can?.rides },
  deliveries: { label: "Deliveries", test: (s) => s.active !== false && s.can?.deliveries },
  trips: { label: "Trips", test: (s) => s.active !== false && s.can?.trips },
  inactive: { label: "Inactive", test: (s) => s.active === false },
};

/** Where employees sign in (the employee app). */
const appUrl = () => `${window.location.origin}/equipo`;

export default function Employees() {
  const { city } = useAdminCity();
  const { status, list, error } = useStaffList();
  const work = useTeamWork();
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get("f")] ? params.get("f") : "all";
  const openId = params.get("id");
  const [query, setQuery] = useState("");
  const [created, setCreated] = useState({ uid: "", password: "" });

  const team = useMemo(() => list.filter((s) => !s.cities?.length || s.cities.includes(city)), [list, city]);
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, team.filter(f.test).length])), [team]);
  const shown = team.filter((s) => FILTERS[filter].test(s) && matches(query, s.name, s.email, s.phone, s.vehicle?.plate));
  const current = openId && openId !== "new" ? list.find((s) => s.uid === openId) : null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "f" });
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Employees"
        subtitle={`${CITIES[city]?.brand} · ${counts.all} on the team · ${counts.online} online now`}
        actions={
          <Button icon={UserPlus} onClick={() => setParam("id", "new")}>
            Add employee
          </Button>
        }
      />
      <ErrorNote error={error} />
      <AppLinkCard />

      <div className="ad-toolbar">
        <Tabs label="Employee filters" value={filter} onChange={(k) => setParam("f", k === "all" ? "" : k)} tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: counts[key] }))} />
        <SearchInput value={query} onChange={setQuery} placeholder="Name, email, phone, plate…" />
      </div>

      {status === "loading" ? (
        <div className="ad-staff-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ad-staff-card is-loading">
              <span className="skeleton" style={{ width: 52, height: 52, borderRadius: 99 }} />
              <span className="skeleton" style={{ height: 14, width: "60%" }} />
              <span className="skeleton" style={{ height: 14, width: "80%" }} />
            </div>
          ))}
        </div>
      ) : shown.length ? (
        <div className="ad-staff-grid">
          {shown.map((s) => (
            <StaffCard key={s.uid} staff={s} work={work.get(s.uid)} onOpen={() => setParam("id", s.uid)} />
          ))}
        </div>
      ) : (
        <Card>
          <Empty
            icon={IdentificationBadge}
            title={team.length ? "Nobody here" : "Add your first employee"}
            text={team.length ? "Try another filter." : "Create their sign-in, choose what they can do (rides, deliveries, trips) and send them the employee app."}
          >
            {!team.length && (
              <Button icon={UserPlus} onClick={() => setParam("id", "new")}>
                Add employee
              </Button>
            )}
          </Empty>
        </Card>
      )}

      {openId === "new" ? (
        <EmployeeDrawer
          key="new"
          city={city}
          onClose={() => setParam("id", "")}
          onCreated={(uid, password) => {
            setCreated({ uid, password });
            setParam("id", uid);
          }}
        />
      ) : current ? (
        <EmployeeDrawer
          key={current.uid}
          staff={current}
          city={city}
          work={work.get(current.uid)}
          created={created.uid === current.uid ? created : null}
          onClose={() => setParam("id", "")}
        />
      ) : openId && (status === "loading" || openId === created.uid) ? (
        <Drawer open onClose={() => setParam("id", "")} title="Employee" className="ad-drawer">
          <div className="ad-page-loading">
            <Spinner label="Loading…" />
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}

function AppLinkCard() {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl());
      toast.success("Link copied");
    } catch {
      toast.error(appUrl());
    }
  };
  return (
    <div className="ad-applink">
      <img src="/apps/team-192.png" alt="" width="44" height="44" />
      <div className="ad-applink__text">
        <strong>Employee app</strong>
        <span>
          Employees sign in at <b>{appUrl().replace(/^https?:\/\//, "")}</b> and install it on their phone. They only see the jobs you allow — never this admin.
        </span>
      </div>
      <div className="ad-applink__actions">
        <Button size="sm" variant="secondary" icon={Copy} onClick={copy}>
          Copy link
        </Button>
        <Button size="sm" variant="ghost" icon={ArrowSquareOut} href="/equipo" target="_blank" rel="noreferrer">
          Open
        </Button>
      </div>
    </div>
  );
}

function StaffCard({ staff: s, work, onOpen }) {
  const jobs = work?.active || [];
  const next = work?.upcoming || [];
  return (
    <button type="button" className={`ad-staff-card ${s.active === false ? "is-inactive" : ""}`} onClick={onOpen}>
      <span className="ad-staff-card__top">
        <Avatar staff={s} size={52} dot={s._presence.key} />
        <span className="ad-staff-card__who">
          <strong>{s.name || "—"}</strong>
          <span>{lastSeenText(s)}</span>
        </span>
        <Pill tone={s._presence.tone}>{s._presence.label}</Pill>
      </span>
      <SkillChips can={s.can} />
      <span className="ad-staff-card__lines">
        <VehicleLine vehicle={s.vehicle} />
        <span>{phonePretty(s.phone)}</span>
      </span>
      <span className="ad-staff-card__foot">
        {jobs.length ? (
          <span className="ad-staff-card__job">
            <Lightning size={14} weight="fill" aria-hidden="true" /> {jobs[0].label}
            {jobs.length > 1 ? ` +${jobs.length - 1}` : ""}
          </span>
        ) : next.length ? (
          <span className="ad-staff-card__next">
            Next: {next[0].label}
            {next.length > 1 ? ` +${next.length - 1}` : ""}
          </span>
        ) : (
          <span>No job right now</span>
        )}
        <span>
          {work?.done || 0} done · 30 days
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Add / edit                                                                */
/* ------------------------------------------------------------------------ */
const toForm = (s, city) => ({
  name: s?.name || "",
  phone: s?.phone ? phonePretty(s.phone) : "",
  email: s?.email || "",
  password: "",
  photo: s?.photo || "",
  can: { rides: !!s?.can?.rides, deliveries: !!s?.can?.deliveries, trips: !!s?.can?.trips },
  vehicle: {
    make: s?.vehicle?.make || "",
    model: s?.vehicle?.model || "",
    color: s?.vehicle?.color || "",
    plate: s?.vehicle?.plate || "",
    seats: s?.vehicle?.seats ? String(s.vehicle.seats) : "",
  },
  cities: s?.cities?.length ? s.cities : [city || CITY.id],
  active: s ? s.active !== false : true,
  notes: s?.notes || "",
});

function newPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
}

function validate(f, isNew) {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Write their full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Write a valid email — it’s how they sign in.";
  if (f.phone.replace(/\D/g, "").slice(-10).length !== 10) e.phone = "Write a 10-digit phone number.";
  if ((isNew || f.password) && f.password.length < 8) e.password = "At least 8 characters.";
  return e;
}

const REASONS = {
  NAME_REQUIRED: ["name", "Write their full name."],
  EMAIL_INVALID: ["email", "Write a valid email."],
  EMAIL_TAKEN: ["email", "Another account already uses this email."],
  ALREADY_STAFF: ["email", "This email already belongs to an employee."],
  PHONE_INVALID: ["phone", "Write a 10-digit phone number."],
  PASSWORD_SHORT: ["password", "At least 8 characters."],
};

function saveError(err) {
  const reason = err?.details?.reason;
  if (REASONS[reason]) return { field: REASONS[reason][0], message: REASONS[reason][1] };
  const code = String(err?.code || "");
  if (code.includes("permission-denied") || code.includes("unauthenticated")) return { message: "Only administrators can manage employees." };
  if (code.includes("not-found") || code.includes("internal") || code.includes("unavailable"))
    return { message: "Couldn’t reach the server. If this keeps happening, deploy the latest Cloud Functions (saveStaff)." };
  return { message: "Could not save. Please try again." };
}

function inviteText(f) {
  const first = f.name.trim().split(/\s+/)[0] || "";
  const jobs = SKILLS.filter((k) => f.can[k]).map((k) => ({ rides: "rides", deliveries: "entregas de la tienda", trips: "viajes" })[k]);
  return [
    `¡Hola ${first}! Ya tienes acceso a la app de empleados de Express${jobs.length ? ` (${jobs.join(", ")})` : ""} 🚗`,
    `1️⃣ Abre ${appUrl()}`,
    `2️⃣ Entra con tu correo ${f.email.trim().toLowerCase()} y la contraseña que te di`,
    `3️⃣ Instálala en tu teléfono: iPhone → Compartir → “Agregar a inicio”. Android → “Instalar app”.`,
    `Activa “Disponible” para recibir trabajos. ¡Bienvenido al equipo!`,
  ].join("\n");
}

function EmployeeDrawer({ staff, city, work, created, onClose, onCreated }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const isNew = !staff;
  const [form, setForm] = useState(() => toForm(staff, city));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState("");
  const fileRef = useRef(null);
  const original = useMemo(() => JSON.stringify(toForm(staff, city)), [staff, city]);
  const dirty = isNew || JSON.stringify(form) !== original;
  const noSkill = !SKILLS.some((k) => form.can[k]);
  const jobs = work?.active || [];

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };
  const setVehicle = (key, value) => setForm((f) => ({ ...f, vehicle: { ...f.vehicle, [key]: value } }));
  const setSkill = (key, on) => setForm((f) => ({ ...f, can: { ...f.can, [key]: on } }));
  const toggleCity = (id) =>
    setForm((f) => {
      const has = f.cities.includes(id);
      const next = has ? f.cities.filter((c) => c !== id) : [...f.cities, id];
      return { ...f, cities: next.length ? next : f.cities };
    });

  const save = async () => {
    const errs = validate(form, isNew);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Check the highlighted fields.");
      return;
    }
    setBusy("save");
    try {
      const res = await admin.saveStaff({
        uid: staff?.uid || "",
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, "").slice(-10),
        password: form.password || undefined,
        photo: form.photo.trim(),
        can: form.can,
        vehicle: { ...form.vehicle, seats: Number(form.vehicle.seats) || 0 },
        cities: form.cities,
        active: form.active,
        notes: form.notes.trim(),
      });
      setForm((f) => ({ ...f, password: "" }));
      toast.success(isNew ? `${form.name.trim().split(/\s+/)[0]} was added to the team` : "Employee saved");
      if (isNew) onCreated?.(res.uid, form.password);
    } catch (err) {
      console.error(err);
      const { field, message } = saveError(err);
      if (field) setErrors((e) => ({ ...e, [field]: message }));
      toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Remove ${staff.name}?`,
      message: `${jobs.length ? `They have ${jobs.length} job${jobs.length === 1 ? "" : "s"} in progress — give ${jobs.length === 1 ? "it" : "them"} to someone else first. ` : ""}Their sign-in to the employee app is deleted. Past rides and deliveries keep their name. To pause someone instead, turn off “Can sign in”.`,
      confirmLabel: "Remove employee",
      danger: true,
    });
    if (!ok) return;
    setBusy("delete");
    try {
      await admin.deleteStaff(staff.uid);
      toast.success("Employee removed");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(saveError(err).message);
      setBusy("");
    }
  };

  const upload = async (file) => {
    if (!file) return;
    setBusy("photo");
    try {
      set("photo", await uploadImage(file, "express/staff", 480));
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={isNew ? "New employee" : staff.name}
        className="ad-drawer"
        footer={
          <div className="ad-drawer__actions">
            {!isNew && (
              <Button variant="ghost" size="sm" icon={Trash} className="ad-danger-text" loading={busy === "delete"} onClick={remove}>
                Remove
              </Button>
            )}
            <Button onClick={save} loading={busy === "save"} disabled={!dirty || !!busy} icon={isNew ? UserPlus : CheckCircle}>
              {isNew ? "Create employee" : "Save changes"}
            </Button>
          </div>
        }
      >
        <div className="ad-detail">
          {!isNew && (
            <div className="ad-detail__meta">
              <Pill tone={staff._presence.tone}>{staff._presence.label}</Pill>
              <span>{lastSeenText(staff)}</span>
            </div>
          )}

          {created && (
            <div className="ad-created" role="status">
              <CheckCircle size={22} weight="fill" />
              <div>
                <strong>{staff.name.split(" ")[0]} can sign in now</strong>
                <span>
                  Send them the app with the WhatsApp message below
                  {created.password ? (
                    <>
                      {" "}
                      and give them their password: <code>{created.password}</code>
                    </>
                  ) : null}
                  .
                </span>
              </div>
            </div>
          )}

          <section className="ad-detail__sec">
            <h3>What can {isNew ? "they" : staff.name.split(" ")[0]} do?</h3>
            <div className="ad-skillpick">
              {Object.entries(SKILL_INFO).map(([key, info]) => (
                <label key={key} className={`ad-skillpick__opt ${form.can[key] ? "is-on" : ""}`}>
                  <input type="checkbox" checked={form.can[key]} onChange={(e) => setSkill(key, e.target.checked)} />
                  <info.icon size={26} weight="duotone" aria-hidden="true" />
                  <span>
                    <strong>{info.label}</strong>
                    <small>{info.text}</small>
                  </span>
                  <CheckCircle size={22} weight="fill" className="ad-skillpick__check" aria-hidden="true" />
                </label>
              ))}
            </div>
            {noSkill && <p className="ad-hint ad-hint--warn">Without at least one, they won’t see any jobs in the app.</p>}
          </section>

          <section className="ad-detail__sec">
            <h3>Profile</h3>
            <div className="ad-photo-row">
              <Avatar staff={{ name: form.name, photo: form.photo }} size={64} />
              <div className="ad-photo-row__tools">
                {canUpload && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
                    <Button size="sm" variant="secondary" icon={UploadSimple} loading={busy === "photo"} onClick={() => fileRef.current?.click()}>
                      {form.photo ? "Change photo" : "Add photo"}
                    </Button>
                  </>
                )}
                {form.photo && (
                  <Button size="sm" variant="ghost" onClick={() => set("photo", "")}>
                    Remove photo
                  </Button>
                )}
                <span className="ad-hint">Customers see the photo and first name of who is coming.</span>
              </div>
            </div>
            {!canUpload && <TextField label="Photo link" optional="optional" placeholder="https://…" value={form.photo} onChange={(e) => set("photo", e.target.value)} />}
            <div className="form-grid">
              <TextField className="span-2" label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} autoComplete="off" />
              <TextField label="Phone" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone} hint="Customers can call or WhatsApp this number." autoComplete="off" />
              <TextField label="Email (to sign in)" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} error={errors.email} autoComplete="off" />
            </div>
          </section>

          <section className="ad-detail__sec">
            <h3>Sign-in</h3>
            <div className="ad-password">
              <TextField
                label={isNew ? "Password" : "New password"}
                optional={isNew ? undefined : "optional"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                error={errors.password}
                hint={isNew ? "At least 8 characters. You give it to them." : "Leave empty to keep their current password."}
                autoComplete="new-password"
                spellCheck={false}
              />
              <Button size="sm" variant="secondary" icon={Password} onClick={() => set("password", newPassword())}>
                Generate
              </Button>
            </div>
            <Toggle
              checked={form.active}
              onChange={(v) => set("active", v)}
              label="Can sign in and receive jobs"
              hint={form.active ? "Turn off to pause someone without deleting them." : "Paused: they are signed out and can’t sign in."}
            />
            {isNew && <p className="ad-hint">If this email already has a customer account, it becomes their employee sign-in too (with this password).</p>}
          </section>

          <section className="ad-detail__sec">
            <h3>Vehicle</h3>
            <div className="form-grid">
              <TextField label="Make" placeholder="Toyota" value={form.vehicle.make} onChange={(e) => setVehicle("make", e.target.value)} />
              <TextField label="Model" placeholder="Sienna" value={form.vehicle.model} onChange={(e) => setVehicle("model", e.target.value)} />
              <TextField label="Color" placeholder="Gris" value={form.vehicle.color} onChange={(e) => setVehicle("color", e.target.value)} />
              <TextField label="Plate" placeholder="CXKP 214" value={form.vehicle.plate} onChange={(e) => setVehicle("plate", e.target.value.toUpperCase())} />
              <TextField label="Passenger seats" type="number" min="0" max="60" inputMode="numeric" value={form.vehicle.seats} onChange={(e) => setVehicle("seats", e.target.value)} />
            </div>
            <p className="ad-hint">Shown to the customer with the plate so they find the right car.</p>
          </section>

          {Object.keys(CITIES).length > 1 && (
            <section className="ad-detail__sec">
              <h3>Cities</h3>
              <div className="ad-pick" role="group" aria-label="Cities">
                {Object.values(CITIES).map((c) => {
                  const on = form.cities.includes(c.id);
                  return (
                    <button key={c.id} type="button" className={`ad-pick__opt ${on ? "is-on" : ""}`} aria-pressed={on} onClick={() => toggleCity(c.id)}>
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="ad-detail__sec">
            <TextAreaField label="Internal note" optional="only you see it" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </section>

          {!isNew && (
            <section className="ad-detail__sec">
              <h3>Work</h3>
              <p className="ad-hint">
                {work?.done || 0} job{work?.done === 1 ? "" : "s"} finished in the last 30 days.
              </p>
              {jobs.length + (work?.upcoming?.length || 0) ? (
                <ul className="ad-joblinks">
                  {jobs.map((j) => (
                    <li key={`${j.kind}-${j.id}`}>
                      <Link to={j.to} className="ad-link">
                        <Lightning size={14} weight="fill" /> Now: {j.label}
                      </Link>
                    </li>
                  ))}
                  {(work?.upcoming || []).map((j) => (
                    <li key={`${j.kind}-${j.id}`}>
                      <Link to={j.to} className="ad-link">
                        Later: {j.label}
                        {j.date ? ` · ${shortDate(j.date)}` : ""}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ad-hint">Nothing in progress right now.</p>
              )}
            </section>
          )}

          {!isNew && staff.phone && (
            <section className="ad-detail__sec">
              <h3>Send them the app</h3>
              <a className="ad-template" href={waHref(staff.phone, inviteText(form))} target="_blank" rel="noreferrer">
                <ChatCircleText size={18} weight="duotone" />
                <span>
                  <strong>Invite on WhatsApp</strong>
                  {inviteText(form)}
                </span>
              </a>
            </section>
          )}
        </div>
      </Drawer>
      {confirmDialog}
    </>
  );
}
