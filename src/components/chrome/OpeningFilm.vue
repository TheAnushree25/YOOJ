<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { cinema } from "../../lib/session";
import { soundOn } from "../../lib/sound";

/**
 * The opening film: the page's entrance, between the gate and the hero.
 *
 * Eight seconds of a clinic being remade, played once, full frame, with the
 * page held still beneath it. It is a fixed layer rather than a section, and
 * that is the whole design: the hero stays exactly where it is, laid out at
 * the top of a document that has not moved, and the film is a curtain in
 * front of it. When the reader scrolls, the curtain lifts and the hero is
 * simply there - no section to slide in, no trigger to re-measure, and
 * nothing behind the hero's transparent stage for it to show through.
 *
 * Four states, in order: held (behind the gate, on its first frame), playing,
 * over (the film has finished and the cue is up) and leaving (the curtain is
 * on its way up). The page owns the scroll lock, the sound and the hero's
 * entrance; this layer only says when.
 */

defineProps<{ src: string; poster: string }>();

const emit = defineEmits<{
  /** The file can play through - or has failed, which is also an answer. */
  ready: [];
  /** The film has finished; the cue is on its way up. */
  over: [];
  /** The reader has asked to go on: the curtain is lifting off the hero. */
  leave: [];
  /** The film stopped working partway. The page should carry on without it. */
  skip: [];
  /** The layer has left the screen and can be taken down. */
  done: [];
}>();

/** How long the curtain takes to lift. `$wipe` in the stylesheet is this number. */
const WIPE_MS = 1350;

const video = ref<HTMLVideoElement | null>(null);
const cue = ref<HTMLButtonElement | null>(null);

const over = ref(false);
const cueUp = ref(false);
const leaving = ref(false);
const skipping = ref(false);

/**
 * What the cue asks for. Like the gate's "Click" against "Tap": the question
 * is whether the pointer can hover, not how wide the screen is.
 */
const coarse =
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
const cueWord = coarse ? "Swipe to begin" : "Scroll to begin";

/* ------------------------------------------------------------ readiness */

let readySaid = false;
let failed = false;
let started = false;
let torn = false;

const sayReady = () => {
  if (readySaid) return;
  readySaid = true;
  emit("ready");
};

const onError = () => {
  if (torn) return;
  failed = true;
  sayReady();
  // Broke while playing: nothing left to wait for, on with the page.
  if (started && !over.value) skip();
};

/* --------------------------------------------------------------- playing */

/**
 * Unlock the element inside the reader's press.
 *
 * A browser lets a video sound only if the reader started it, and it decides
 * that at the element: once `play()` has been called from a gesture, the
 * element may be played again from anywhere. The gate takes most of a second
 * to leave, and starting the film for real here would spend its first frames
 * behind a dissolving ground - so it is started and stopped in the same
 * breath, and started properly once the gate has gone. Nothing is seen: the
 * layer is still under the gate.
 */
const prime = () => {
  const v = video.value;
  if (!v || failed) return;
  v.muted = !soundOn.value;
  const p = v.play();
  if (!p) { v.pause(); return; }
  p.then(() => {
    // Unless the real start has already overtaken this, in which case the
    // film is playing and must be left alone.
    if (started) return;
    v.pause();
    v.currentTime = 0;
  }).catch(() => { /* refused here; the real start tries again, silent if it must */ });
};

let ceiling: ReturnType<typeof setTimeout> | null = null;
let cueTimer: ReturnType<typeof setTimeout> | null = null;
let doneTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * A hard ceiling on the film, so a stalled network can never hold the page.
 *
 * Its own length plus a margin for buffering, counted from when it started.
 * Landing here means the film did not reach its end on its own; it is put on
 * its last frame and the page goes on.
 */
const armCeiling = () => {
  const v = video.value;
  const left = v && Number.isFinite(v.duration) ? Math.max(0, v.duration - v.currentTime) : 10;
  ceiling = setTimeout(finish, (left + 6) * 1000);
};

/**
 * Play, from the first frame. Resolves false if it cannot be played at all,
 * so the page can carry on as if there were no film.
 */
const start = async (): Promise<boolean> => {
  const v = video.value;
  if (!v || failed) return false;
  started = true;
  try {
    v.currentTime = 0;
    v.muted = !soundOn.value;
    await v.play();
  } catch {
    // Refused with sound: a browser that did not take the press as one.
    // Silent is better than absent.
    try {
      v.muted = true;
      await v.play();
    } catch {
      started = false;
      return false;
    }
  }
  armCeiling();
  return true;
};

/** The film is over, however it got there. The last frame holds. */
const finish = () => {
  if (over.value || torn) return;
  if (ceiling) { clearTimeout(ceiling); ceiling = null; }
  const v = video.value;
  if (v && !v.ended) {
    try {
      v.pause();
      if (Number.isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.05);
    } catch { /* the frame it is on will do */ }
  }
  over.value = true;
  emit("over");
  // A beat on the last frame before anything is asked. The chrome comes back
  // with the cue, not before it, so the screen changes once rather than twice.
  cueTimer = setTimeout(async () => {
    cueTimer = null;
    cinema.value = false;
    cueUp.value = true;
    listen();
    // After the render: until the class lands the button is still
    // `visibility: hidden`, and a hidden control refuses focus.
    await nextTick();
    if (!torn) cue.value?.focus({ preventScroll: true });
  }, 420);
};

/* --------------------------------------------------------------- leaving */

/**
 * What counts as asking to go on: a wheel turned down, a finger drawn up, the
 * keys that scroll a page, or the cue itself. A wheel turned up is nothing -
 * there is nothing above the top of the page.
 */
const onWheel = (e: WheelEvent) => { if (e.deltaY > 0) leave(); };

let touchY = 0;
const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? 0; };
const onTouchMove = (e: TouchEvent) => {
  const y = e.touches[0]?.clientY ?? touchY;
  if (touchY - y > 14) leave();
};

const SCROLL_KEYS = new Set(["ArrowDown", "PageDown", "End", " ", "Spacebar"]);
const onKey = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (!SCROLL_KEYS.has(e.key)) return;
  e.preventDefault();
  leave();
};

const listen = () => {
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("keydown", onKey);
};

const unlisten = () => {
  window.removeEventListener("wheel", onWheel);
  window.removeEventListener("touchstart", onTouchStart);
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("keydown", onKey);
};

/** The curtain lifts. Once. */
const leave = () => {
  if (leaving.value || skipping.value || !cueUp.value) return;
  leaving.value = true;
  unlisten();
  emit("leave");
  doneTimer = setTimeout(() => emit("done"), WIPE_MS + 40);
};

/** Out of the way, quickly and without ceremony. */
const skip = () => {
  if (leaving.value || skipping.value) return;
  skipping.value = true;
  unlisten();
  if (ceiling) { clearTimeout(ceiling); ceiling = null; }
  if (cueTimer) { clearTimeout(cueTimer); cueTimer = null; }
  cinema.value = false;
  emit("skip");
  doneTimer = setTimeout(() => emit("done"), 650);
};

/**
 * A tab switched away from mid-film. Some browsers pause a video when its tab
 * is hidden and do not start it again; the film has the press on record, so
 * it may be.
 */
const onVisibility = () => {
  const v = video.value;
  if (document.hidden || !v || !started || over.value) return;
  if (v.paused && !v.ended) void v.play().catch(() => {});
};

// The reader's choice, followed while the film runs: the M key and the pulse
// both write it.
watch(soundOn, (on) => { if (video.value) video.value.muted = !on; });

onMounted(() => {
  // The film has the screen from here: chrome down, document held.
  cinema.value = true;
  document.documentElement.classList.add("is-cinema");
  document.addEventListener("visibilitychange", onVisibility);

  /**
   * Readiness, with a floor.
   *
   * `canplaythrough` is the honest signal, and it never comes on a browser
   * that will not fetch a video before it is asked to play - a phone on data,
   * most of the time. So if nothing is being fetched a moment after mount,
   * there is nothing to wait for and the gate is told so. Anything still
   * loading gets the gate's own ceiling.
   */
  setTimeout(() => {
    const v = video.value;
    if (v && v.networkState !== HTMLMediaElement.NETWORK_LOADING) sayReady();
  }, 1500);
});

onBeforeUnmount(() => {
  torn = true;
  unlisten();
  if (ceiling) clearTimeout(ceiling);
  if (cueTimer) clearTimeout(cueTimer);
  if (doneTimer) clearTimeout(doneTimer);
  document.removeEventListener("visibilitychange", onVisibility);
  document.documentElement.classList.remove("is-cinema");
  cinema.value = false;
  // Let the decoder go. Detaching the element alone leaves the file open in
  // some browsers; emptying it is what releases it.
  const v = video.value;
  if (v) {
    try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* already gone */ }
  }
});

defineExpose({ prime, start });
</script>

<template>
  <div
    class="film"
    :class="{ 'is-over': over, 'is-cue': cueUp, 'is-leaving': leaving, 'is-skipping': skipping }"
  >
    <!-- The picture and its ground, counter-moved as the curtain lifts so the
         page reads as rising over the film rather than the film sliding off. -->
    <div class="film__frame">
      <div class="film__ground" aria-hidden="true" />
      <div class="film__picture">
        <video
          ref="video"
          class="film__video"
          :src="src"
          :poster="poster"
          preload="auto"
          playsinline
          disablepictureinpicture
          disableremoteplayback
          aria-hidden="true"
          @canplaythrough="sayReady"
          @ended="finish"
          @error="onError"
        />
      </div>
      <div class="film__veil" aria-hidden="true" />
    </div>

    <!-- The cue. The ring the reader pressed to come in, small, with a thread
         falling from it: on every beat the ring lets go and a drop runs down
         the line, the way the page is about to go. It is also the control. -->
    <button
      ref="cue"
      class="cue"
      type="button"
      :aria-label="cueWord"
      :tabindex="cueUp ? 0 : -1"
      data-cursor="scale"
      @click="leave"
    >
      <span class="cue__word" aria-hidden="true">{{ cueWord }}</span>
      <span class="cue__ring" aria-hidden="true">
        <i class="cue__wave" />
        <i class="cue__wave cue__wave--late" />
        <i class="cue__seed" />
      </span>
      <span class="cue__line" aria-hidden="true"><i class="cue__drop" /></span>
    </button>
  </div>
</template>

<style scoped lang="scss">
// The beat everything in the cue is cut to - the pulse's own, so the corner
// and the cue keep time.
$beat: 2.4s;
// How long the curtain takes to lift. WIPE_MS in the script is this number.
$wipe: 1.35s;

// Between the page and its chrome: over the content, under the header, the
// pulse, the menu and the gate.
.film {
  position: fixed;
  inset: 0;
  z-index: 55;
  overflow: hidden;
  isolation: isolate;
  // The curtain's shadow on the page. Outside the frame until it lifts, and
  // then on the hero beneath its edge - which is what makes it a layer over
  // the page rather than a picture sliding off it.
  box-shadow: 0 2rem 6rem rgb(var(--rgb-void) / 0.55);
  transition: transform $wipe var(--e-out-quart);

  &.is-leaving { transform: translate3d(0, -100%, 0); }

  // Taken down quietly, when there is nothing to lift off.
  &.is-skipping {
    transition: opacity 0.6s var(--e-out-quart);
    opacity: 0;
    pointer-events: none;
  }
}

.film__frame {
  position: absolute;
  inset: 0;
  transition: transform $wipe var(--e-out-quart);

  // Against the curtain, at a fraction of its speed: the picture drifts up
  // while the edge crosses it faster, and the page reads as rising over the
  // film. Clipped by the layer, so nothing of it outlives the lift.
  .is-leaving & { transform: translate3d(0, 38%, 0); }
}

// The site's dark ground, for the bars a portrait frame leaves around the
// picture. The film was shot on the same wine, lit from the same corner.
.film__ground {
  position: absolute;
  inset: 0;
  background: var(--ground-dark);
  background-size: 190% 190%;
  background-position: 78% 26%;
}

// The picture. A slow push-in once the film has stopped, so the held frame
// under the cue is a picture that is still alive rather than one that froze.
.film__picture {
  position: absolute;
  inset: 0;
  transition: transform 10s var(--e-out-quad);

  .is-over & { transform: scale(1.045); }
}

.film__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;

  /**
   * Portrait: the picture at a size that keeps its subject, with soft edges.
   *
   * Filled to a phone's height, a sixteen-by-nine frame shows its middle
   * quarter and the clinic is a wall. Fitted to the width, it is a strip in
   * the middle of a dark screen. At 140vw the picture keeps the clinic whole
   * - it stands in the middle seven tenths of the frame - and its top and
   * bottom are faded into the page's ground rather than cut against it.
   */
  @media (orientation: portrait) {
    inset: auto;
    top: 50%;
    left: 50%;
    width: 140vw;
    height: calc(140vw * 9 / 16);
    transform: translate(-50%, -50%);
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent);
  }
}

// Two veils in one: a darkening of the foot of the frame, up with the cue so
// the cue has ground under it; and the whole picture dimming as it leaves.
.film__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgb(var(--rgb-void) / 0.6) 0%,
    rgb(var(--rgb-void) / 0.26) 18%,
    transparent 42%
  );
  opacity: 0;
  transition: opacity 1.2s var(--e-out-quart);

  .is-cue & { opacity: 1; }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgb(var(--rgb-void) / 0.55);
    opacity: 0;
    transition: opacity $wipe var(--e-out-quart);
  }

  .is-leaving &::after { opacity: 1; }
}

/* ------------------------------------------------------------------ the cue */

.cue {
  position: absolute;
  left: 50%;
  bottom: calc(clamp(1.4rem, 4.2vh, 2.8rem) + env(safe-area-inset-bottom, 0px));
  z-index: 2;
  display: grid;
  justify-items: center;
  gap: 0.95rem;
  transform: translateX(-50%);
  // Not there until the film is over - and not pressable or tabbable either.
  // The parts make their own entrances below; the whole simply exists.
  opacity: 0;
  visibility: hidden;
  pointer-events: none;

  .is-cue & {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }

  // Gone the moment the curtain moves; it has been answered.
  .is-leaving & {
    opacity: 0;
    transition: opacity 0.35s var(--e-out-quart);
  }

  &:focus-visible {
    outline: none;
    .cue__ring { box-shadow: 0 0 0 3px rgb(var(--rgb-accent) / 0.45); }
  }

  &:hover .cue__ring,
  &:focus-visible .cue__ring {
    border-color: var(--c-bone);
    background: rgb(var(--rgb-bone) / 0.08);
  }

  &:hover .cue__word { color: var(--c-bone); }
}

.cue__word {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: rgb(var(--rgb-bone) / 0.78);
  white-space: nowrap;
  // Tracking is trailing space; this puts the letters, not the box, on the
  // centre line the ring and the thread hang from.
  padding-left: var(--ls-label);
  opacity: 0;
  transform: translateY(0.9rem);
  transition:
    opacity 1.05s var(--e-out-quart),
    transform 1.05s var(--e-out-quart),
    color var(--t-hover) var(--e-none);

  .is-cue & { opacity: 1; transform: none; }
}

// The gate's ring, small: the one the reader pressed to come in, asking once
// more. A seed at its centre, and a wave let go of it on every beat.
.cue__ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-bone) / 0.55);
  opacity: 0;
  transform: translateY(0.9rem);
  transition:
    opacity 1.05s var(--e-out-quart) 0.12s,
    transform 1.05s var(--e-out-quart) 0.12s,
    border-color var(--t-hover) var(--e-none),
    background-color var(--t-hover) var(--e-none);

  > * { grid-area: 1 / 1; }

  .is-cue & { opacity: 1; transform: none; }
}

.cue__seed {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--c-accent);
  animation: cue-seed $beat var(--e-out-quart) infinite;
}

.cue__wave {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid var(--c-accent);
  opacity: 0;
  animation: cue-wave $beat var(--e-out-quart) infinite;
}

.cue__wave--late { animation-delay: 0.26s; }

// The thread: a hairline falling from the ring toward the foot of the frame,
// drawn downward when the cue arrives, and a lit drop running its length on
// every beat. The direction the page is about to go, shown rather than said.
.cue__line {
  --len: clamp(4.4rem, 9vh, 6.4rem);
  position: relative;
  width: 1px;
  height: var(--len);
  background: rgb(var(--rgb-bone) / 0.2);
  overflow: hidden;
  transform: scaleY(0);
  transform-origin: top center;
  transition: transform 1.25s var(--e-out-expo) 0.26s;

  .is-cue & { transform: none; }
}

.cue__drop {
  --tail: 2.6rem;
  position: absolute;
  left: 0;
  top: calc(var(--tail) * -1);
  width: 1px;
  height: var(--tail);
  background: linear-gradient(to bottom, transparent, var(--c-accent) 70%, var(--c-bone));
  opacity: 0;
  animation: cue-fall $beat var(--e-in-out-cubic) 1.2s infinite;
}

// The seed thumps as the drop is released.
@keyframes cue-seed {
  0%, 30%, 100% { transform: scale(1); }
  6%            { transform: scale(1.7); }
}

@keyframes cue-wave {
  0%        { transform: scale(1);   opacity: 0.6; }
  60%, 100% { transform: scale(2.4); opacity: 0; }
}

// Down the line and out of the bottom of it, then a rest until the next beat.
@keyframes cue-fall {
  0%        { transform: translateY(0); opacity: 0; }
  10%       { opacity: 1; }
  62%       { transform: translateY(calc(var(--len) + var(--tail))); opacity: 1; }
  63%, 100% { transform: translateY(calc(var(--len) + var(--tail))); opacity: 0; }
}

// The film is not shown at all under reduced motion (see HomeView); this only
// keeps the layer itself still if it is ever mounted there.
@media (prefers-reduced-motion: reduce) {
  .cue__seed, .cue__wave, .cue__drop { animation: none; }
}
</style>
