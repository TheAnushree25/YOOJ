import { ref } from "vue";
import { entered } from "./session";

/**
 * The site's sound: one bed, under everything after the gate.
 *
 * It goes through a Web Audio graph rather than an `<audio>` element, for two
 * reasons that matter here: a buffer source loops without the gap an mp3
 * element leaves at the join, and a gain node can be ramped — so the bed
 * arrives and leaves as a fade rather than a switch, and nothing ever clicks.
 *
 * Module scope, like the gate itself: the bed belongs to the visit, not the
 * page, and has to keep playing straight through a route change.
 *
 * A browser will not start sound before the reader has touched the page, so
 * the file is fetched and decoded while the gate is up and the clock is
 * started inside the press that lifts it. The loading screen itself is silent.
 */

const KEY = "yooj:sound";
const AMBIENT = "/audio/ambient-loop.mp3";

/** Under the page, not over it. */
const AMBIENT_LEVEL = 0.32;

const readPreference = (): boolean => {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
};
const writePreference = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode; the choice lasts the session */ }
};

/** The reader's choice. Remembered between visits. */
export const soundOn = ref<boolean>(readPreference());

/** Whether the bed is actually sounding — what the toggle's bars answer to. */
export const ambientLive = ref(false);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const decoded = new Map<string, Promise<AudioBuffer>>();
let ambient: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

const context = (): AudioContext | null => {
  if (ctx) return ctx;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  // A tab in the background goes quiet rather than carrying on unheard, and
  // comes back up when the reader does.
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !master) return;
    ramp(master.gain, document.hidden ? 0 : 1, 0.5);
  });
  return ctx;
};

/** Fetched and decoded once; the promise is the cache. */
const buffer = (url: string): Promise<AudioBuffer> => {
  const c = context();
  if (!c) return Promise.reject(new Error("Web Audio unavailable"));
  let pending = decoded.get(url);
  if (!pending) {
    pending = fetch(url).then((r) => r.arrayBuffer()).then((bytes) => c.decodeAudioData(bytes));
    decoded.set(url, pending);
  }
  return pending;
};

const ramp = (param: AudioParam, to: number, seconds: number) => {
  if (!ctx) return;
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(to, now + seconds);
};

/**
 * Start the file on its way while the gate is still up. Decoding does not need
 * the clock running, so this happens before the reader has done anything — by
 * the time they press, there is nothing left to wait for.
 */
export const preloadSound = () => {
  if (!soundOn.value) return;
  buffer(AMBIENT).catch(() => {});
};

/** The bed, rising over two and a half seconds. */
export const startAmbient = async () => {
  if (!soundOn.value || ambient) return;
  const c = context();
  if (!c || !master) return;
  // Inside the reader's press, which is what lets the clock run at all.
  void c.resume().catch(() => {});
  try {
    const buf = await buffer(AMBIENT);
    // The choice may have changed while the file decoded.
    if (ambient || !soundOn.value) return;
    const source = c.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    const gain = c.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(master);
    source.start();
    ambient = { source, gain };
    ambientLive.value = true;
    ramp(gain.gain, AMBIENT_LEVEL, 2.5);
  } catch { /* no bed; the page is still the page */ }
};

/** The bed, leaving. Faded out and only then stopped, so it never clicks. */
export const stopAmbient = (seconds = 0.6) => {
  if (!ambient || !ctx) return;
  const { source, gain } = ambient;
  ambient = null;
  ambientLive.value = false;
  ramp(gain.gain, 0, seconds);
  source.stop(ctx.currentTime + seconds + 0.05);
};

/**
 * The toggle. Turning sound on after the gate has already lifted starts the
 * bed there and then; turning it on while the gate is still up only records
 * the choice, because the loading screen is the one place the bed does not
 * belong.
 */
export const setSound = (on: boolean) => {
  soundOn.value = on;
  writePreference(on);
  if (on) {
    if (entered.value) void startAmbient();
  } else {
    stopAmbient();
  }
};

export const toggleSound = () => setSound(!soundOn.value);

/**
 * The one control left: M mutes and unmutes.
 *
 * The visible toggle was taken out of the header by request. A site that
 * plays sound still owes the reader a way to stop it, so the key stays —
 * ignored while they are typing into a field.
 */
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    toggleSound();
  });
}
