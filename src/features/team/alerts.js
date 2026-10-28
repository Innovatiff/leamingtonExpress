// New-job alerts for the employee app: a short chime, a vibration and — when
// the app is in the background — a system notification.
import { readJSON, writeJSON } from "@/lib/storage";

const SOUND_KEY = "lx_team_sound";
let ctx = null;

/** Browsers only allow sound after a tap: call this from the first tap in the app. */
export function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
  } catch {
    /* no audio on this device */
  }
}

export const soundOn = () => readJSON(SOUND_KEY, true) !== false;
export const setSoundOn = (on) => writeJSON(SOUND_KEY, Boolean(on));

/** Two rising notes, easy to hear in a car. */
export function chime() {
  if (!soundOn()) return;
  try {
    unlockAudio();
    if (!ctx) return;
    const start = ctx.currentTime + 0.02;
    [
      [880, 0],
      [1318.5, 0.18],
      [1760, 0.36],
    ].forEach(([freq, at]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.35, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.35);
    });
  } catch {
    /* ignore */
  }
}

export function notificationState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

export async function askNotifications() {
  if (!("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Sound + vibration now; a system notification too if the app isn't on screen. */
export async function alertNewJob(title, body) {
  chime();
  try {
    navigator.vibrate?.([250, 120, 250]);
  } catch {
    /* ignore */
  }
  if (!document.hidden || notificationState() !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag: "lx-new-job", renotify: true, icon: "/apps/team-192.png", badge: "/apps/team-192.png", data: { url: "/equipo" } });
    else new Notification(title, { body, icon: "/apps/team-192.png" });
  } catch {
    /* ignore */
  }
}
