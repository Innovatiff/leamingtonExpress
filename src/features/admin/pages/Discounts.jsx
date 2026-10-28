import { useMemo, useState } from "react";
import { PencilSimple, Plus, Ticket, Trash } from "@phosphor-icons/react";
import * as admin from "@backend/admin";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/context/ToastContext";
import { money, parseMoney, toDate } from "@/lib/format";
import { Card, Empty, ErrorNote, LoadingRows, PageHead, Pill, SearchInput, Toggle, useConfirm } from "../components/AdminUI";
import { matches, shortDate, useCollection } from "../lib";

/** Same fields the previous admin used (Code, Discount, Reusable, Owner, Origin) plus a few new ones. */
function codeState(d) {
  const expires = toDate(d?.expiresAt);
  if (d?.active === false) return { label: "Off", tone: "neutral" };
  if (expires && expires.getTime() < Date.now()) return { label: "Expired", tone: "neutral" };
  if (!d?.Reusable && (Number(d?.usedCount) > 0 || d?.used)) return { label: "Used", tone: "neutral" };
  return { label: "Active", tone: "green" };
}

const EMPTY = { Code: "", Discount: "", Reusable: true, Owner: "", Origin: "Leamington Express", active: true, minSubtotal: "", expiresAt: "" };

export default function Discounts() {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const { status, data, error } = useCollection("discounts");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // { id?, ...fields }

  const list = useMemo(
    () => data.filter((d) => matches(query, d.Code, d.Owner, d.Origin)).sort((a, b) => String(a.Code).localeCompare(String(b.Code))),
    [data, query],
  );

  const toggle = async (d) => {
    try {
      await admin.saveDiscount(d.id, { active: d.active === false });
      toast.success(d.active === false ? `${d.Code} is active` : `${d.Code} turned off`);
    } catch (err) {
      console.error(err);
      toast.error("Could not update the code.");
    }
  };

  const remove = async (d) => {
    const ok = await confirm({ title: `Delete ${d.Code}?`, message: "Customers won't be able to use it anymore.", confirmLabel: "Delete code", danger: true });
    if (!ok) return;
    try {
      await admin.deleteRecord("discounts", d.id);
      toast.success("Code deleted");
    } catch (err) {
      console.error(err);
      toast.error("Could not delete the code.");
    }
  };

  return (
    <div className="ad-page">
      <PageHead
        title="Discount codes"
        subtitle="Codes customers type at checkout. The discount is a fixed amount off the products."
        actions={
          <Button size="sm" icon={Plus} onClick={() => setEditing({ ...EMPTY })}>
            New code
          </Button>
        }
      />
      <ErrorNote error={error} />
      <div className="ad-toolbar">
        <span className="ad-toolbar__note">{data.filter((d) => codeState(d).label === "Active").length} active codes</span>
        <SearchInput value={query} onChange={setQuery} placeholder="Code, owner…" />
      </div>
      <Card flush>
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Code</th>
                <th className="num">Discount</th>
                <th>Use</th>
                <th>Owner</th>
                <th className="num">Times used</th>
                <th>Status</th>
                <th className="ad-actions-col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {status === "loading" ? (
              <LoadingRows cols={7} rows={3} />
            ) : (
              <tbody>
                {list.map((d) => {
                  const st = codeState(d);
                  const expires = toDate(d.expiresAt);
                  return (
                    <tr key={d.id}>
                      <td>
                        <code className="ad-code">{d.Code}</code>
                        {d.Origin && <span className="ad-cell-sub">{d.Origin}</span>}
                      </td>
                      <td className="num strong">{money(parseMoney(d.Discount))}</td>
                      <td>
                        <span className="ad-cell-main">{d.Reusable ? "Many times" : "Once"}</span>
                        <span className="ad-cell-sub">
                          {[Number(d.minSubtotal) > 0 && `min. ${money(d.minSubtotal, { whole: true })}`, expires && `until ${shortDate(expires)}`].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td>{d.Owner || "—"}</td>
                      <td className="num">{Number(d.usedCount) || 0}</td>
                      <td>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                      <td className="ad-actions-col">
                        <div className="ad-row-actions">
                          <Toggle checked={d.active !== false} onChange={() => toggle(d)} label={<span className="sr-only">Active</span>} />
                          <Button
                            variant="ghost"
                            size="sm"
                            square
                            icon={PencilSimple}
                            aria-label={`Edit ${d.Code}`}
                            onClick={() =>
                              setEditing({
                                ...EMPTY,
                                ...d,
                                Discount: String(parseMoney(d.Discount)),
                                minSubtotal: d.minSubtotal ? String(d.minSubtotal) : "",
                                expiresAt: expires ? expires.toISOString().slice(0, 10) : "",
                              })
                            }
                          />
                          <Button variant="ghost" size="sm" square icon={Trash} className="ad-danger-text" aria-label={`Delete ${d.Code}`} onClick={() => remove(d)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
        {status !== "loading" && !list.length && <Empty icon={Ticket} title="No discount codes yet" text="Create one to reward new customers or partners." />}
      </Card>
      {editing && <CodeModal key={editing.id || "new"} initial={editing} existing={data} onClose={() => setEditing(null)} />}
      {confirmDialog}
    </div>
  );
}

function CodeModal({ initial, existing, onClose }) {
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const code = f.Code.trim().toUpperCase();
  const errors = {
    Code: !/^[A-Z0-9_-]{3,24}$/.test(code)
      ? "3–24 letters or numbers, no spaces."
      : existing.some((d) => d.id !== f.id && String(d.Code).trim().toUpperCase() === code)
        ? "Another code already uses this name."
        : "",
    Discount: !(parseMoney(f.Discount) > 0) ? "Enter the amount in dollars." : "",
  };

  const save = async () => {
    if (Object.values(errors).some(Boolean)) {
      setTouched(true);
      return;
    }
    setSaving(true);
    try {
      const doc = {
        Code: code,
        Discount: parseMoney(f.Discount).toFixed(2),
        Reusable: !!f.Reusable,
        Owner: f.Owner.trim(),
        Origin: f.Origin.trim(),
        active: f.active !== false,
        minSubtotal: parseMoney(f.minSubtotal) || 0,
        expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`) : null,
      };
      await admin.saveDiscount(f.id || null, doc);
      toast.success(f.id ? "Code saved" : `Code ${code} created`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Could not save the code.");
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={f.id ? `Edit ${initial.Code}` : "New discount code"}
      footer={
        <div className="ad-modal-actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            {f.id ? "Save" : "Create code"}
          </Button>
        </div>
      }
    >
      <div className="form-grid">
        <TextField label="Code" value={f.Code} onChange={(e) => setF({ ...f, Code: e.target.value.toUpperCase() })} error={touched ? errors.Code : ""} placeholder="BIENVENIDO10" data-autofocus />
        <TextField label="Discount ($)" inputMode="decimal" value={f.Discount} onChange={(e) => setF({ ...f, Discount: e.target.value })} error={touched ? errors.Discount : ""} placeholder="10.00" />
        <TextField label="Owner" optional="optional" value={f.Owner} onChange={(e) => setF({ ...f, Owner: e.target.value })} hint="Who it belongs to (partner, influencer…)." />
        <TextField label="Origin" optional="optional" value={f.Origin} onChange={(e) => setF({ ...f, Origin: e.target.value })} />
        <TextField label="Minimum purchase ($)" optional="optional" inputMode="decimal" value={f.minSubtotal} onChange={(e) => setF({ ...f, minSubtotal: e.target.value })} />
        <TextField label="Valid until" optional="optional" type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
      </div>
      <div className="ad-stack-sm">
        <Toggle checked={!!f.Reusable} onChange={(Reusable) => setF({ ...f, Reusable })} label="Can be used many times" hint="Off = the code works only once." />
        <Toggle checked={f.active !== false} onChange={(active) => setF({ ...f, active })} label="Active" />
      </div>
    </Modal>
  );
}
