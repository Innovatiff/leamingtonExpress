import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AirplaneTilt,
  Car,
  ChatsCircle,
  CheckCircle,
  EnvelopeSimple,
  House,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Phone,
  Plus,
  Storefront,
  UserCircle,
  WhatsappLogo,
} from "@phosphor-icons/react";
import * as backend from "@backend";
import Button from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Misc";
import { CITY } from "@/config/site";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { useI18n } from "@/i18n";
import { formatDate, formatPhone, phoneDigits } from "@/lib/format";
import { useSeo } from "@/lib/seo";
import { normalize } from "@/lib/text";
import { isEmail, isPhone, maskPhone, phoneDigits10 } from "@/lib/validators";
import "./info.css";

const LEGAL_UPDATED = new Date(2026, 9, 28);
const TOPICS = ["tienda", "ride", "viajes", "grupo", "otro"];

function useAreaList() {
  const { lang } = useI18n();
  return new Intl.ListFormat(lang === "en" ? "en-CA" : "es", { type: "conjunction" }).format(CITY.serviceArea || [CITY.name]);
}

const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

/* ------------------------------------------------------------------------ */
/* Help center                                                               */
/* ------------------------------------------------------------------------ */
const GROUPS = [
  ["store", Storefront],
  ["ride", Car],
  ["travel", AirplaneTilt],
  ["account", UserCircle],
];

export function HelpPage() {
  const { t } = useI18n();
  const settings = useSettings();
  const area = useAreaList();
  const [query, setQuery] = useState("");
  useSeo({ title: t("info.helpTitle"), description: t("info.helpText") });
  const q = normalize(query);
  const groups = GROUPS.map(([key, icon]) => {
    const items = (t(`info.faq.${key}`) || []).map(([question, answer]) => [question, fill(answer, { area })]);
    return { key, icon, items: q ? items.filter(([a, b]) => normalize(`${a} ${b}`).includes(q)) : items };
  }).filter((g) => g.items.length);
  const wa = settings.contact?.whatsapp;

  return (
    <div className="info">
      <section className="info-hero">
        <div className="container container--narrow">
          <h1 className="info-hero__title">{t("info.helpTitle")}</h1>
          <p>{t("info.helpText")}</p>
          <label className="info-search">
            <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("info.helpSearch")} aria-label={t("info.helpSearch")} />
          </label>
        </div>
      </section>
      <div className="container container--narrow info-body">
        {groups.length ? (
          groups.map(({ key, icon: Icon, items }) => (
            <section key={key} className="info-group">
              <h2 className="info-group__title">
                <span>
                  <Icon size={20} weight="duotone" />
                </span>
                {t(`info.groups.${key}`)}
              </h2>
              <div className="info-faq">
                {items.map(([question, answer]) => (
                  <details key={question} open={!!q}>
                    <summary>
                      {question}
                      <Plus size={18} weight="bold" />
                    </summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="info-empty">{t("info.helpNoResults")}</p>
        )}

        <section className="info-cta">
          <ChatsCircle size={32} weight="duotone" />
          <div>
            <h2>{t("info.stillNeedHelp")}</h2>
            <p>{t("info.stillNeedHelpText")}</p>
          </div>
          <div className="info-cta__actions">
            {wa && (
              <Button href={`https://wa.me/1${phoneDigits(wa).slice(-10)}`} target="_blank" rel="noreferrer" icon={WhatsappLogo} className="info-wa">
                WhatsApp
              </Button>
            )}
            <Button to="/contacto" variant="secondary">
              {t("nav.contact")}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Contact                                                                   */
/* ------------------------------------------------------------------------ */
export function ContactPage() {
  const { t, lang } = useI18n();
  const settings = useSettings();
  const { info } = useAuth();
  const area = useAreaList();
  const [params] = useSearchParams();
  const contact = settings.contact || {};
  const initialTopic = TOPICS.includes(params.get("tema")) ? params.get("tema") : "otro";
  const [f, setF] = useState(() => ({ name: info.fullName || "", phone: info.phone ? maskPhone(info.phone) : "", email: info.email || "", topic: initialTopic, message: "" }));
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  useSeo({ title: t("info.contactTitle"), description: t("info.contactText") });
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const errors = {
    name: f.name.trim().length < 2 ? t("errors.required") : "",
    phone: f.phone && !isPhone(f.phone) ? t("errors.phone") : "",
    email: f.email.trim() && !isEmail(f.email) ? t("errors.email") : "",
    reach: !f.phone && !f.email.trim() ? t("info.phoneOrEmail") : "",
    message: f.message.trim().length < 5 ? t("errors.required") : "",
  };
  const show = (k) => (touched ? errors[k] : "");

  async function submit(e) {
    e.preventDefault();
    if (Object.values(errors).some(Boolean)) {
      setTouched(true);
      return;
    }
    setSending(true);
    setError("");
    try {
      await backend.createMessage({
        name: f.name.trim().slice(0, 80),
        phone: phoneDigits10(f.phone),
        email: f.email.trim().toLowerCase().slice(0, 120),
        topic: f.topic,
        message: f.message.trim().slice(0, 2000),
        city: CITY.id,
        lang,
      });
      setSent(true);
    } catch (err) {
      console.error("Message failed", err);
      setError(t("info.sendError"));
    } finally {
      setSending(false);
    }
  }

  const cards = [
    contact.whatsapp && { icon: WhatsappLogo, title: t("info.contactWhatsapp"), value: formatPhone(contact.whatsapp), text: t("info.contactWhatsappText"), href: `https://wa.me/1${phoneDigits(contact.whatsapp).slice(-10)}`, external: true, tone: "wa" },
    contact.phone && { icon: Phone, title: t("info.contactPhone"), value: formatPhone(contact.phone), href: `tel:+1${phoneDigits(contact.phone).slice(-10)}` },
    contact.email && { icon: EnvelopeSimple, title: t("info.contactEmail"), value: contact.email, href: `mailto:${contact.email}` },
    { icon: MapPin, title: t("info.contactArea"), value: area, text: contact.address || "" },
  ].filter(Boolean);

  return (
    <div className="info">
      <div className="container info-contact">
        <header className="page-head">
          <h1 className="page-head__title">{t("info.contactTitle")}</h1>
          <p className="page-head__text">{t("info.contactText")}</p>
        </header>
        <div className="info-contact__grid">
          <ul className="info-cards">
            {cards.map((c) => {
              const body = (
                <>
                  <span className={`info-card__icon ${c.tone === "wa" ? "is-wa" : ""}`}>
                    <c.icon size={24} weight="duotone" />
                  </span>
                  <span className="info-card__body">
                    <span className="info-card__title">{c.title}</span>
                    <strong>{c.value}</strong>
                    {c.text && <span className="info-card__text">{c.text}</span>}
                  </span>
                </>
              );
              return (
                <li key={c.title}>
                  {c.href ? (
                    <a className="info-card" href={c.href} {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                      {body}
                    </a>
                  ) : (
                    <div className="info-card">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>

          <section className="info-form">
            {sent ? (
              <div className="info-sent">
                <CheckCircle size={52} weight="fill" />
                <h2>{t("info.sentTitle")}</h2>
                <p className="muted">{t("info.sentText")}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSent(false);
                    setTouched(false);
                    set({ message: "" });
                  }}
                >
                  {t("info.sendAnother")}
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <h2 className="info-form__title">{t("info.formTitle")}</h2>
                <p className="muted">{t("info.formText")}</p>
                <div className="form-grid">
                  <TextField className="span-2" label={t("info.name")} value={f.name} onChange={(e) => set({ name: e.target.value })} error={show("name")} autoComplete="name" maxLength={80} />
                  <TextField label={t("info.phone")} inputMode="tel" value={f.phone} onChange={(e) => set({ phone: maskPhone(e.target.value) })} error={show("phone")} autoComplete="tel-national" />
                  <TextField label={t("info.email")} type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} error={show("email")} autoComplete="email" />
                  {show("reach") && <p className="field__error span-2">{errors.reach}</p>}
                  <SelectField className="span-2" label={t("info.topic")} value={f.topic} onChange={(e) => set({ topic: e.target.value })} options={TOPICS.map((k) => ({ value: k, label: t(`info.topics.${k}`) }))} />
                  <TextAreaField
                    className="span-2"
                    label={t("info.message")}
                    placeholder={t("info.messagePlaceholder")}
                    rows={5}
                    value={f.message}
                    onChange={(e) => set({ message: e.target.value })}
                    error={show("message")}
                    maxLength={2000}
                  />
                </div>
                {error && <Notice tone="error">{error}</Notice>}
                <Button type="submit" size="lg" icon={PaperPlaneTilt} loading={sending}>
                  {sending ? t("info.sending") : t("info.send")}
                </Button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Privacy / terms                                                           */
/* ------------------------------------------------------------------------ */
export function LegalPage({ kind }) {
  const { t, lang } = useI18n();
  const title = t(kind === "privacy" ? "info.privacyTitle" : "info.termsTitle");
  const sections = t(`info.${kind}`) || [];
  useSeo({ title });
  const vars = { brand: CITY.brand, city: CITY.name };
  return (
    <div className="info">
      <article className="container container--narrow info-legal">
        <h1 className="page-head__title">{title}</h1>
        <p className="muted small">{t("info.updated", { date: formatDate(LEGAL_UPDATED, lang, { day: "numeric", month: "long", year: "numeric" }) })}</p>
        <nav className="info-toc" aria-label={title}>
          {sections.map(([heading], i) => (
            <a key={heading} href={`#s${i + 1}`}>
              {i + 1}. {heading}
            </a>
          ))}
        </nav>
        {sections.map(([heading, body], i) => (
          <section key={heading} id={`s${i + 1}`} className="info-legal__sec">
            <h2>
              {i + 1}. {heading}
            </h2>
            <p>{fill(body, vars)}</p>
          </section>
        ))}
        <p className="info-legal__contact">
          <Link to="/contacto">{t("nav.contact")} →</Link>
        </p>
      </article>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* 404                                                                       */
/* ------------------------------------------------------------------------ */
export function NotFoundPage() {
  const { t } = useI18n();
  useSeo({ title: t("info.notFoundTitle"), noindex: true });
  return (
    <div className="info">
      <div className="container info-404">
        <span className="info-404__code" aria-hidden="true">
          404
        </span>
        <h1 className="page-head__title">{t("info.notFoundTitle")}</h1>
        <p className="muted">{t("info.notFoundText")}</p>
        <div className="info-404__links">
          <Button to="/" icon={House}>
            {t("info.goHome")}
          </Button>
          <Button to="/tienda" variant="secondary" icon={Storefront}>
            {t("nav.store")}
          </Button>
          <Button to="/ride" variant="secondary" icon={Car}>
            {t("nav.ride")}
          </Button>
          <Button to="/viajes" variant="secondary" icon={AirplaneTilt}>
            {t("nav.travel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
