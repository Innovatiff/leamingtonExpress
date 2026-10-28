import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Archive, ArrowCounterClockwise, ChatsCircle, EnvelopeSimple, Phone, Trash, WhatsappLogo } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/context/ToastContext";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, Tabs, useAdminCity, useConfirm } from "../components/AdminUI";
import { cityOf, dateTime, matches, phonePretty, recordDate, telHref, timeAgo, useCollection, waHref } from "../lib";

const TOPICS = { tienda: "Store", ride: "Ride", viajes: "Travel", grupo: "Group trip", otro: "Other" };
const FILTERS = {
  new: { label: "New", test: (m) => (m.status || "new") === "new" },
  read: { label: "Read", test: (m) => m.status === "read" },
  archived: { label: "Archived", test: (m) => m.status === "archived" },
  all: { label: "All", test: () => true },
};

export default function Messages() {
  const { city } = useAdminCity();
  const { status, data, error } = useCollection("messages");
  const [params, setParams] = useSearchParams();
  const filter = FILTERS[params.get("f")] ? params.get("f") : "new";
  const openId = params.get("id");
  const [query, setQuery] = useState("");

  const messages = useMemo(
    () => data.filter((m) => cityOf(m) === city).map((m) => ({ ...m, _date: recordDate(m) })).sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0)),
    [data, city],
  );
  const counts = useMemo(() => Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, messages.filter(f.test).length])), [messages]);
  const list = messages.filter((m) => FILTERS[filter].test(m) && matches(query, m.name, m.phone, m.email, m.message));
  const current = openId ? data.find((m) => m.id === openId) : null;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: key === "f" });
  };

  return (
    <div className="ad-page">
      <PageHead title="Messages" subtitle="From the contact form on the website." />
      <ErrorNote error={error} />
      <div className="ad-toolbar">
        <Tabs label="Message filters" value={filter} onChange={(k) => setParam("f", k === "new" ? "" : k)} tabs={Object.entries(FILTERS).map(([key, f]) => ({ key, label: f.label, count: counts[key] }))} />
        <SearchInput value={query} onChange={setQuery} placeholder="Name, phone, text…" />
      </div>
      <Card flush>
        <div className="ad-table-wrap">
          <table className="ad-table ad-table--click">
            <thead>
              <tr>
                <th>From</th>
                <th>Topic</th>
                <th>Message</th>
                <th>Received</th>
              </tr>
            </thead>
            {status === "loading" ? (
              <LoadingRows cols={4} rows={4} />
            ) : (
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} onClick={() => setParam("id", m.id)} className={(m.status || "new") === "new" ? "is-unread" : ""}>
                    <td>
                      <button type="button" className="ad-rowlink" onClick={() => setParam("id", m.id)}>
                        {m.name || "—"}
                      </button>
                      <span className="ad-cell-sub">{phonePretty(m.phone) || m.email}</span>
                    </td>
                    <td>
                      <Pill tone="neutral">{TOPICS[m.topic] || m.topic || "Other"}</Pill>
                    </td>
                    <td className="ad-msg-cell">{m.message}</td>
                    <td>{timeAgo(m._date)}</td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {status !== "loading" && !list.length && <Empty icon={ChatsCircle} title="No messages here" />}
      </Card>
      <MessageDrawer key={openId || "closed"} message={current} onClose={() => setParam("id", "")} />
    </div>
  );
}

function MessageDrawer({ message, onClose }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const m = message;

  // Opening a new message marks it as read
  useEffect(() => {
    if (m && (m.status || "new") === "new") admin.updateRecord("messages", m.id, { status: "read" }).catch(() => {});
  }, [m]);

  if (!m) return confirmDialog;
  const setStatus = async (status, text) => {
    try {
      await admin.updateRecord("messages", m.id, { status });
      toast.success(text);
      if (status === "archived") onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not update the message.");
    }
  };
  const remove = async () => {
    const ok = await confirm({ title: "Delete this message?", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await admin.deleteRecord("messages", m.id);
      toast.success("Message deleted");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the message.");
    }
  };
  const first = (m.name || "").split(" ")[0];
  const reply = m.lang === "en" ? `Hi ${first}, thanks for writing to us. ` : `¡Hola ${first}! Gracias por escribirnos. `;

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={m.name || "Message"}
        className="ad-drawer"
        footer={
          <div className="ad-drawer__actions">
            {m.status === "archived" ? (
              <Button variant="secondary" size="sm" icon={ArrowCounterClockwise} onClick={() => setStatus("read", "Moved back to inbox")}>
                Move to inbox
              </Button>
            ) : (
              <Button variant="secondary" size="sm" icon={Archive} onClick={() => setStatus("archived", "Message archived")}>
                Archive
              </Button>
            )}
            <Button variant="ghost" size="sm" icon={Trash} className="ad-danger-text" onClick={remove}>
              Delete
            </Button>
          </div>
        }
      >
        <div className="ad-detail">
          <div className="ad-detail__meta">
            <Pill tone="neutral">{TOPICS[m.topic] || m.topic || "Other"}</Pill>
            <span>{dateTime(recordDate(m))}</span>
          </div>
          <p className="ad-message">{m.message}</p>
          <section className="ad-detail__sec">
            <h3>Reply</h3>
            <div className="ad-contact">
              {m.phone && (
                <>
                  <Button href={waHref(m.phone, reply)} target="_blank" rel="noreferrer" size="sm" icon={WhatsappLogo}>
                    WhatsApp
                  </Button>
                  <Button href={telHref(m.phone)} size="sm" variant="secondary" icon={Phone}>
                    {phonePretty(m.phone)}
                  </Button>
                </>
              )}
              {m.email && (
                <Button href={`mailto:${m.email}?body=${encodeURIComponent(reply)}`} size="sm" variant="secondary" icon={EnvelopeSimple}>
                  {m.email}
                </Button>
              )}
            </div>
          </section>
        </div>
      </Drawer>
      {confirmDialog}
    </>
  );
}
