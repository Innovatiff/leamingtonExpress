import { useEffect, useMemo, useState } from "react";
import * as team from "@backend/team";
import { bookingIsOpen, deliveryIsOpen, departureKey, rideIsOpen, SKILLS } from "@/lib/dispatch";
import { fromIsoDay, isoDay, toDate } from "@/lib/format";

/* -------------------------------- Auth ---------------------------------- */
export function useTeamAuth() {
  const [user, setUser] = useState(undefined);
  useEffect(() => team.onTeamAuth(setUser), []);
  return { user, loading: user === undefined };
}

/** The signed-in employee's profile (undefined while loading, null if not an employee). */
export function useStaff(uid) {
  const [state, setState] = useState({ uid: null, staff: undefined });
  useEffect(() => {
    if (!uid) return undefined;
    return team.subscribeStaff(
      uid,
      (staff) => setState({ uid, staff }),
      () => setState({ uid, staff: null }),
    );
  }, [uid]);
  return state.uid === uid ? state.staff : undefined;
}

/** A clock that ticks every minute (keeps "today" and "3 min ago" fresh). */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* -------------------------------- Jobs ---------------------------------- */
export const skillsOf = (staff) => SKILLS.filter((s) => staff?.can?.[s]);

/** When a job happens: scheduled time, trip departure, or when it was requested. */
export function jobTime(kind, job) {
  if (kind === "rides") {
    if (job.schedule?.type === "later") {
      const at = toDate(job.schedule.at);
      if (at) return at;
      const [y, m, d] = String(job.schedule.date || "").split("-").map(Number);
      const [hh, mm] = String(job.schedule.time || "").split(":").map(Number);
      if (y) return new Date(y, m - 1, d, hh || 0, mm || 0);
    }
    return toDate(job.createdAt) || new Date(0);
  }
  if (kind === "trips") {
    const day = fromIsoDay(job.date);
    if (!day) return new Date(0);
    const [hh, mm] = String(job.time || "").split(":").map(Number);
    day.setHours(hh || 0, mm || 0, 0, 0);
    return day;
  }
  return toDate(job.createdAt) || new Date(0);
}

/** Bookings of the same trip and date travel together. */
export function toDepartures(bookings) {
  const map = new Map();
  for (const b of bookings) {
    const key = departureKey(b);
    if (!map.has(key)) {
      map.set(key, { id: key, key, tripId: b.tripId, date: b.date, time: b.departureTime || "", title: b.tripTitle || "", destination: b.destination || "", city: b.city, bookings: [] });
    }
    map.get(key).bookings.push(b);
  }
  return [...map.values()].map((d) => {
    const stages = d.bookings.map((b) => b.tripStage || "");
    const stage = stages.every((s) => s === "completed") ? "completed" : stages.some((s) => s === "picked_up") ? "picked_up" : stages.some((s) => s === "assigned") ? "assigned" : "open";
    return { ...d, stage, people: d.bookings.reduce((n, b) => n + (Number(b.adults) || 0) + (Number(b.children) || 0), 0) };
  });
}

const inMyCity = (staff) => (job) => !staff?.cities?.length || staff.cities.includes(job.city || "leamington");
const RIDE_DONE = ["completed", "cancelled"];
const deliveryDone = (o) => o.fulfilment === "Fulfilled" || o.status === "Closed" || o.status === "Cancelled";

/**
 * Live jobs for this employee:
 *   open: jobs nobody took yet (only for what they're allowed to do)
 *   active / done: jobs they took
 */
export function useJobs(staff) {
  const uid = staff?.uid;
  const skills = useMemo(() => skillsOf(staff), [staff]);
  const skillsKey = skills.join(",");
  const [raw, setRaw] = useState({});
  const now = useNow();

  useEffect(() => {
    if (!uid) return undefined;
    const list = skillsKey ? skillsKey.split(",") : [];
    const unsubs = [];
    const put = (key) => (data) => setRaw((r) => ({ ...r, [key]: data }));
    const fail = (key) => (err) => {
      console.warn(`[team] ${key}`, err);
      setRaw((r) => ({ ...r, [key]: [] }));
    };
    for (const skill of list) {
      unsubs.push(team.subscribeOpenJobs(skill, put(`open:${skill}`), fail(`open:${skill}`)));
      unsubs.push(team.subscribeMyJobs(skill, uid, put(`mine:${skill}`), fail(`mine:${skill}`)));
    }
    return () => unsubs.forEach((u) => u());
  }, [uid, skillsKey]);

  return useMemo(() => {
    const here = inMyCity(staff);
    const today = isoDay(new Date(now));
    const ready = skills.every((s) => raw[`open:${s}`] && raw[`mine:${s}`]);
    const get = (key) => (raw[key] || []).filter(here);
    const byTime = (kind) => (a, b) => jobTime(kind, a) - jobTime(kind, b);

    const open = {
      rides: skills.includes("rides") ? get("open:rides").filter(rideIsOpen).sort(byTime("rides")) : [],
      deliveries: skills.includes("deliveries") ? get("open:deliveries").filter(deliveryIsOpen).sort(byTime("deliveries")) : [],
      trips: skills.includes("trips") ? toDepartures(get("open:trips").filter((b) => bookingIsOpen(b) && String(b.date) >= today)).sort(byTime("trips")) : [],
    };
    const mineRides = get("mine:rides");
    const mineDeliveries = get("mine:deliveries");
    const mineTrips = toDepartures(get("mine:trips"));
    const active = {
      rides: mineRides.filter((r) => !RIDE_DONE.includes(r.status)).sort(byTime("rides")),
      deliveries: mineDeliveries.filter((o) => !deliveryDone(o)).sort(byTime("deliveries")),
      trips: mineTrips.filter((d) => d.stage !== "completed").sort(byTime("trips")),
    };
    const since = now - 60 * 24 * 3600 * 1000;
    const finishedAt = (kind, j) =>
      toDate(kind === "rides" ? j.completedAt || j.updatedAt : kind === "deliveries" ? j.deliveredAt || j.updatedAt : j.bookings?.[0]?.completedAt) || jobTime(kind, j);
    const done = {
      rides: mineRides.filter((r) => r.status === "completed").filter((r) => finishedAt("rides", r) >= since),
      deliveries: mineDeliveries.filter((o) => o.fulfilment === "Fulfilled" || o.status === "Closed").filter((o) => finishedAt("deliveries", o) >= since),
      trips: mineTrips.filter((d) => d.stage === "completed").filter((d) => finishedAt("trips", d) >= since),
    };
    return { ready, skills, open, active, done, finishedAt, now };
  }, [raw, skills, staff, now]);
}

/** Find one job (open or mine) for the detail page. */
export function findJob(jobs, kind, id) {
  const pools = [jobs.active[kind], jobs.open[kind], jobs.done[kind]];
  for (const pool of pools) {
    const job = (pool || []).find((j) => j.id === id);
    if (job) return job;
  }
  return null;
}
