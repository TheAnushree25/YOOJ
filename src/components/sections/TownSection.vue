<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ScrollTrigger, prefersReduced } from "../../composables/useMotion";
import { isJumping } from "../../composables/useSmoothScroll";
import { soundOn } from "../../lib/sound";

/**
 * The solution: the clinic film, where the page says what YOOJ does.
 *
 * Eight seconds of a tired clinic becoming a YOOJ one - the same film that
 * used to open the site, moved to where it makes the argument. It is one
 * screen, laid out to the design: the picture full-bleed, and the heading
 * over the sky above the clinic.
 *
 * It plays once, and it plays with the page held. When the reader scrolls
 * down into it the section glides the last stretch into place, the page stops
 * answering the wheel, and the film runs from its first frame with its own
 * sound; the heading comes in as the picture starts to move. When the film is
 * over its last frame stays - which is the design's picture - and the page is
 * the reader's again.
 *
 * The page owns the hold, the chrome and the sound; this section only says
 * when (`hold` and `release`), as the gate does.
 */

const props = defineProps<{
  /** The film. */
  src: string;
  /** Its first frame, shown while the section is on its way up. */
  poster: string;
  /** Its last frame: what the section rests on once the film has played. */
  still: string;
}>();

const emit = defineEmits<{
  /** The reader has arrived. Hold the page on this element, and call `start` once it is in place. */
  hold: [el: HTMLElement];
  /** The film is over, or cannot be played. */
  release: [];
}>();

/**
 * idle      not reached yet: the first frame, no heading
 * arriving  the page is gliding it into place
 * playing   the film is running and the page is held
 * done      it has played; the last frame holds
 * passed    it was never played - the reader was carried past it, or asked
 *           for less motion - and it rests on the last frame as if it had
 */
type State = "idle" | "arriving" | "playing" | "done" | "passed";

const reduced = prefersReduced();
const state = ref<State>(reduced ? "passed" : "idle");
/** The heading is in. */
const told = ref(reduced);

const root = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);

let trigger: ScrollTrigger | null = null;
let ceiling: ReturnType<typeof setTimeout> | null = null;
let tellTimer: ReturnType<typeof setTimeout> | null = null;
let torn = false;

const clearTimers = () => {
  if (ceiling) { clearTimeout(ceiling); ceiling = null; }
  if (tellTimer) { clearTimeout(tellTimer); tellTimer = null; }
};

/**
 * Unlock the element inside the reader's press at the gate.
 *
 * A browser lets a video sound only if the reader started it, and some decide
 * that per element: once `play()` has been called from a gesture, the element
 * may be played again from anywhere. The film is a long way down the page, so
 * it is started and stopped, silently, in the gate's press - which also starts
 * it loading.
 */
const prime = () => {
  const v = video.value;
  if (!v || state.value !== "idle") return;
  v.volume = 0;
  v.muted = !soundOn.value;
  const p = v.play();
  if (!p) { v.pause(); return; }
  p.then(() => {
    if (state.value === "playing") return;
    v.pause();
    v.currentTime = 0;
  }).catch(() => { /* refused here; the real start tries again, silent if it must */ });
};

/** It was never played; rest on the design's frame, heading and all. */
const pass = () => {
  if (state.value !== "idle") return;
  state.value = "passed";
  told.value = true;
};

/** Scrolled into, downward, by the reader - not carried past by the menu. */
const arrive = () => {
  if (state.value !== "idle" || torn) return;
  if (isJumping()) { pass(); return; }
  const el = root.value;
  if (!el) return;
  state.value = "arriving";
  emit("hold", el);
};

/**
 * The film is over, however it got there. If it got there by the ceiling
 * rather than by ending, it is stopped where it is - the still of its last
 * frame is laid over it either way.
 */
const finish = () => {
  if (state.value !== "playing" && state.value !== "arriving") return;
  clearTimers();
  const v = video.value;
  if (v && !v.ended) { try { v.pause(); } catch { /* already stopped */ } }
  state.value = "done";
  told.value = true;
  emit("release");
};

const timeout = (ms: number) => new Promise<"late">((r) => setTimeout(() => r("late"), ms));

/**
 * The page is held and the section is in place: play, from the first frame.
 *
 * With sound if the reader has it on; silent if the browser will not allow
 * that; and not at all if it cannot start within a few seconds, because the
 * page is being held while it tries.
 */
const start = async () => {
  const v = video.value;
  if (!v || state.value !== "arriving") return;
  try { v.currentTime = 0; } catch { /* the first frame will do */ }
  v.volume = 1;
  v.muted = !soundOn.value;

  const attempt = async () => {
    try {
      await v.play();
    } catch {
      try {
        v.muted = true;
        await v.play();
      } catch {
        return false;
      }
    }
    // Started only after the page had stopped waiting for it: stop it again,
    // or it would run on unseen, and aloud, under the still.
    if (state.value !== "arriving") { v.pause(); return false; }
    return true;
  };

  const ok = await Promise.race([attempt(), timeout(4500)]);
  if (torn || state.value !== "arriving") return;
  if (ok !== true) {
    finish();
    return;
  }

  state.value = "playing";
  // The heading follows the picture in, a beat after it starts to move.
  tellTimer = setTimeout(() => { told.value = true; }, 450);
  // A ceiling, so a stalled stream can never keep the page held: the film's
  // own length plus a margin for buffering.
  const left = Number.isFinite(v.duration) ? Math.max(0, v.duration - v.currentTime) : 10;
  ceiling = setTimeout(finish, (left + 6) * 1000);
};

const onError = () => {
  if (state.value === "playing" || state.value === "arriving") finish();
};

/**
 * A tab switched away from mid-film. Some browsers pause a video when its tab
 * is hidden and do not start it again; this one was started by the reader, so
 * it may be.
 */
const onVisibility = () => {
  const v = video.value;
  if (document.hidden || !v || state.value !== "playing") return;
  if (v.paused && !v.ended) void v.play().catch(() => {});
};

// The reader's choice, followed while the film runs: the M key writes it.
watch(soundOn, (on) => { if (video.value && state.value === "playing") video.value.muted = !on; });

/**
 * Start fetching the film once the page itself has finished loading, so it is
 * in hand by the time the reader scrolls down to it without ever competing
 * with the first screen for the network.
 */
const warm = () => {
  const v = video.value;
  if (!v || reduced) return;
  const go = () => { if (!torn && v.preload !== "auto") v.preload = "auto"; };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  const idle = () => (w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 1200));
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
};

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  warm();
  if (reduced || !root.value) return;
  trigger = ScrollTrigger.create({
    trigger: root.value,
    // Most of the way up the screen: late enough that the reader has clearly
    // chosen to come here, early enough that the glide into place is short.
    start: "top 38%",
    onEnter: arrive,
    // Arrived at from below without ever having been reached from above -
    // the menu carried the reader past it. It rests on its last frame.
    onEnterBack: pass,
  });
});

onBeforeUnmount(() => {
  torn = true;
  clearTimers();
  trigger?.kill();
  document.removeEventListener("visibilitychange", onVisibility);
  // Let the decoder go: detaching the element alone leaves the file open in
  // some browsers; emptying it is what releases it.
  const v = video.value;
  if (v) {
    try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* already gone */ }
  }
});

defineExpose({ prime, start });
</script>

<template>
  <section id="town" ref="root" class="tw" :class="[`is-${state}`, { 'is-told': told }]">
    <div class="tw__stage">
      <div class="tw__picture">
        <video
          ref="video"
          class="tw__video"
          :src="props.src"
          :poster="props.poster"
          preload="none"
          playsinline
          disablepictureinpicture
          disableremoteplayback
          aria-hidden="true"
          @ended="finish"
          @error="onError"
        />
        <!-- The last frame as a still, laid over the film once it has played
             (the same picture the film stops on) or when it never will. -->
        <img class="tw__still" :src="props.still" alt="" aria-hidden="true" decoding="async" draggable="false">
      </div>

      <div class="tw__copy">
        <p class="tw__eyebrow">The solution</p>
        <h2 class="tw__title">
          <span class="tw__line"><span>Bring care to the</span></span>
          <span class="tw__line tw__line--strong"><span>town</span></span>
        </h2>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.tw {
  position: relative;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
}

/**
 * The design's frame is 831 x 618 with the film covering it. The heading is
 * set in the design's pixels (`--u`), and placed down the screen as a share
 * of its height - the film always shows its full height, so the heading keeps
 * its place against the clinic's roofline whatever the screen's width.
 */
.tw__stage {
  --u: min(calc(100vw / 831), calc(var(--vh, 1vh) * 100 / 618));

  position: relative;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  // The film's own edges, carried out to the screen's for a screen wider than
  // the film: a near-flat wine down its left side, and a rose falling to wine
  // down its right. Read off the film's first and last columns.
  background:
    linear-gradient(to bottom, #DF929C, #D07A87 25%, #B15668 50%, #9B3C50 75%, #852139) right / 50.5% 100% no-repeat,
    linear-gradient(to bottom, #480413, #38030D) left / 50.5% 100% no-repeat;
}

// Always the film's full height, at the film's own shape. On a screen
// narrower than sixteen by nine it runs off both sides, as it does in the
// design. On a wider one its sides are its own edges carried on - where a
// plain cover would have cut into the sky and pushed the clinic's sign up
// under the heading.
.tw__picture {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: calc(var(--vh, 1vh) * 100 * 16 / 9);
  transform: translateX(-50%);
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 2.5%, #000 97.5%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0, #000 2.5%, #000 97.5%, transparent 100%);
}

.tw__video,
.tw__still {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: center;
}

.tw__still {
  opacity: 0;
  pointer-events: none;

  .is-done &,
  .is-passed & { opacity: 1; }
}

/* -------------------------------------------------------------- the words */

.tw__copy {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  color: #FFFFFF;
  text-align: center;
}

// On the design's baselines: 86 and 144 of 618, in Montserrat's line-height-1
// box, whose baseline is 0.86em down.
.tw__eyebrow {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(13.916% - 0.86 * 18.1 * var(--u));
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(11px, calc(18.1 * var(--u)));
  line-height: 1;
  letter-spacing: 0;
  text-transform: uppercase;
  opacity: 0;
  transform: translate3d(0, calc(12 * var(--u)), 0);
  transition: opacity 1.1s var(--e-out-quart), transform 1.1s var(--e-out-quart);

  .is-told & { opacity: 1; transform: none; }
}

.tw__title {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(23.3% - (25.5 + 0.36 * 40.6) * var(--u));
  font-family: var(--font-say);
  font-weight: 300;
  font-size: calc(40.6 * var(--u));
  line-height: calc(51 * var(--u));
  letter-spacing: 0;
}

.tw__line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.12em;
  margin-bottom: -0.12em;

  > span {
    display: block;
    transform: translate3d(0, 110%, 0);
    transition: transform 1.25s var(--e-out-quart) 0.12s;
  }

  & + & > span { transition-delay: 0.26s; }

  .is-told & > span { transform: none; }
}

.tw__line--strong { font-weight: 800; }

/**
 * Portrait: the film at a size that keeps the clinic whole.
 *
 * Filled to a phone's height, a sixteen-by-nine picture shows its middle
 * quarter and the clinic is a door. At 150vw it stands in the middle of the
 * screen with its top and bottom faded into the site's dark ground, and the
 * heading has the ground above it to itself.
 */
@media (orientation: portrait) {
  .tw__stage {
    --m: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 844));
    background: var(--ground-dark);
    background-size: 190% 190%;
    background-position: 78% 26%;
  }

  .tw__picture {
    top: auto;
    bottom: calc(var(--vh, 1vh) * 12);
    width: 150vw;
    height: calc(150vw * 9 / 16);
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 16%, #000 84%, transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 16%, #000 84%, transparent);
  }

  .tw__eyebrow {
    top: calc(var(--vh, 1vh) * 16);
    font-size: calc(14 * var(--m));
  }

  .tw__title {
    top: calc(var(--vh, 1vh) * 16 + 40 * var(--m));
    font-size: calc(34 * var(--m));
    line-height: calc(42 * var(--m));
  }
}

@media (prefers-reduced-motion: reduce) {
  .tw__eyebrow,
  .tw__line > span { transition: none; }
}
</style>
