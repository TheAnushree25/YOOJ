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

/**
 * Pending hand-off to silence.
 *
 * Off has to mean *off*: a stopped source inside a running context is silent
 * in the graph but still holds the output device open, which on some hardware
 * - bluetooth especially - is an audible hiss and on all of it is a radio left
 * on. So the context is suspended once the bed has finished fading, and the
 * timer is kept so that unmuting before it fires can cancel it rather than
 * having the context suspended out from under a bed that is already rising.
 */
let hush: ReturnType<typeof setTimeout> | null = null;

const cancelHush = () => {
  if (hush === null) return;
  clearTimeout(hush);
  hush = null;
};

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
    // Nothing to duck or restore while the reader has the sound off, and
    // touching the gain here would resume a context that is deliberately
    // suspended.
    if (!soundOn.value) return;
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

/**
 * Whether the bed is being held back.
 *
 * The opening film carries its own sound, and the bed does not rise under it.
 * Held, `startAmbient` starts nothing - it only wakes the device, in case the
 * call came from a press - and the page lets go when the film is over and
 * starts the bed itself. See HomeView.
 */
let held = false;
export const holdAmbient = (hold: boolean) => { held = hold; };

/**
 * Wake the device inside the press, so a bed started later can sound.
 *
 * A browser only runs an AudioContext that was resumed inside a gesture. When
 * the bed is to start after the film - eight seconds after the last press,
 * from a media event - the clock has to have been started here, where the
 * gesture is; the bed then only connects a source to a context that is
 * already running. Nothing is heard: no source is made.
 */
export const primeSound = () => {
  if (!soundOn.value) return;
  const c = context();
  if (!c) return;
  cancelHush();
  void c.resume().catch(() => {});
};

/** The bed, rising over two and a half seconds. */
export const startAmbient = async () => {
  if (!soundOn.value || ambient) return;
  // Not yet: the film has the room. The press still wakes the device, so the
  // bed can start later from an event that is not one.
  if (held) { primeSound(); return; }
  const c = context();
  if (!c || !master) return;
  // Inside the reader's press, which is what lets the clock run at all - and
  // what brings the context back if a previous mute suspended it.
  cancelHush();

  /**
   * Resume into silence, never into whatever was left running.
   *
   * Suspending stops the clock, so anything the previous mute *scheduled* -
   * the old source's stop, the tail of its fade - is frozen rather than
   * finished. Resuming restarts that clock, and for the instant before the
   * stale stop finally fires, the old bed is audible again: a blip on the
   * press that turns the sound back on, which is the beep.
   *
   * Two guards. The master is pulled to zero *before* the clock restarts, so
   * anything still in the graph resumes into a closed gate; and any stale
   * source is torn down outright rather than waiting on its own schedule.
   */
  discardAmbient();
  master.gain.cancelScheduledValues(0);
  master.gain.value = 0;
  void c.resume().catch(() => {});
  // And back up, once the graph is known to be clean.
  ramp(master.gain, 1, 0.25);
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

/**
 * Tear the bed out of the graph, now, without a fade.
 *
 * `stop()` alone leaves the nodes connected and their scheduled values in
 * place; disconnecting is what guarantees the source cannot be heard again
 * whatever the clock does afterwards. Safe to call when there is no bed.
 */
const discardAmbient = () => {
  if (!ambient) return;
  const { source, gain } = ambient;
  ambient = null;
  ambientLive.value = false;
  try { source.stop(); } catch { /* already stopped */ }
  try { source.disconnect(); gain.disconnect(); } catch { /* already gone */ }
};

/** The bed, leaving. Faded out and only then stopped, so it never clicks. */
export const stopAmbient = (seconds = 0.6) => {
  cancelHush();
  if (!ctx) return;

  if (ambient) {
    const { source, gain } = ambient;
    const leaving = ambient;
    ambient = null;
    ambientLive.value = false;
    ramp(gain.gain, 0, seconds);
    source.stop(ctx.currentTime + seconds + 0.05);

    /**
     * And then torn down for certain.
     *
     * The scheduled stop above is the graceful one - it lands at the end of
     * the fade and never clicks. But a scheduled stop only fires while the
     * clock is running, and the clock is about to be suspended. This is the
     * one that cannot be outrun: it disconnects the nodes on the wall clock,
     * just before the suspend, so nothing is left in the graph to be heard
     * when the context is resumed.
     */
    setTimeout(() => {
      if (ambient === leaving) return;
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); gain.disconnect(); } catch { /* already gone */ }
    }, seconds * 1000 + 120);
  }

  /**
   * And then the device itself.
   *
   * Timed past the end of the fade, because suspending stops the clock: a
   * context suspended mid-ramp keeps the gain it had, and the scheduled stop
   * never arrives - so the bed would be waiting at half volume for whenever
   * the reader turned the sound back on. `soundOn` is re-read at the last
   * moment in case they changed their mind inside the fade.
   */
  hush = setTimeout(() => {
    hush = null;
    if (soundOn.value || !ctx) return;
    void ctx.suspend().catch(() => {});
  }, seconds * 1000 + 250);
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
