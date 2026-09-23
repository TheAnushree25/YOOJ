<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { ScrollTrigger, prefersReduced } from "../../composables/useMotion";
import { isJumping } from "../../composables/useSmoothScroll";

/**
 * The solution: the clinic film, where the page says what YOOJ does.
 *
 * Eight seconds of a tired clinic becoming a YOOJ one, and for those eight
 * seconds it is the whole screen. When the reader scrolls down into it the
 * section glides the last stretch into place, the page stops answering the
 * wheel, the chrome stands down, and the film runs edge to edge from its first
 * frame. Nothing is printed over the transformation; a hairline along the foot
 * of the screen is the only sign that it will end. As the new clinic settles,
 * the ground darkens along the bottom of the frame and the heading lands there,
 * and then the page is the reader's again, resting on the film's last frame.
 *
 * The heading is a lower third, as it would be in a film, because a full-bleed
 * picture leaves no clear sky: at sixteen by ten the roofline stands a sixth of
 * the way down the screen and two lines of heading need a quarter. At the foot
 * of the frame it sits over the floor and the lower glass - the parts the film
 * is not about - and never across the sign, which is.
 *
 * Silent, always. The picture makes the argument on its own - and the file
 * itself carries no sound track (removed 2026-09-23, picture stream copied
 * bit for bit), so no browser and no older build can ever play one. The
 * site's own bed is lib/sound's, and is untouched by this section.
 *
 * The page owns the hold and the chrome; this section only says when (`hold`
 * and `release`), as the gate does.
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

/**
 * How long before the end the heading lands: as the last of the new clinic
 * resolves, so the words arrive with the thing they describe rather than over
 * the transformation.
 */
const TELL_BEFORE_END = 1.9;

const root = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const bar = ref<HTMLElement | null>(null);

let trigger: ScrollTrigger | null = null;
let ceiling: ReturnType<typeof setTimeout> | null = null;
let torn = false;
let ticking = 0;

const clearTimers = () => {
  if (ceiling) { clearTimeout(ceiling); ceiling = null; }
  if (ticking) { cancelAnimationFrame(ticking); ticking = 0; }
};

/**
 * The film's own clock, drawn along the foot of the screen and used to land
 * the heading. Read every frame rather than on `timeupdate`, which fires four
 * times a second and would step the line visibly.
 */
const tick = () => {
  const v = video.value;
  if (!v || state.value !== "playing") { ticking = 0; return; }
  const length = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 8;
  const at = Math.min(1, v.currentTime / length);
  if (bar.value) bar.value.style.transform = `scaleX(${at.toFixed(4)})`;
  if (!told.value && v.currentTime >= length - TELL_BEFORE_END) told.value = true;
  ticking = requestAnimationFrame(tick);
};

/**
 * Start the element inside the reader's press at the gate.
 *
 * A muted video may be played from anywhere, but some browsers only begin
 * fetching one that has been asked to play, and this gets the download started
 * at the gate rather than when the reader arrives at the section.
 */
const prime = () => {
  const v = video.value;
  if (!v || state.value !== "idle") return;
  v.volume = 0;
  v.muted = true;
  const p = v.play();
  if (!p) { v.pause(); return; }
  p.then(() => {
    if (state.value === "playing") return;
    v.pause();
    v.currentTime = 0;
  }).catch(() => { /* refused here; the real start tries again */ });
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
  if (bar.value) bar.value.style.transform = "scaleX(1)";
  state.value = "done";
  told.value = true;
  emit("release");
};

const timeout = (ms: number) => new Promise<"late">((r) => setTimeout(() => r("late"), ms));

/**
 * The page is held and the section is in place: play, from the first frame.
 *
 * Silent, and not at all if it cannot start within a few seconds, because the
 * page is being held while it tries.
 */
const start = async () => {
  const v = video.value;
  if (!v || state.value !== "arriving") return;
  try { v.currentTime = 0; } catch { /* the first frame will do */ }
  v.volume = 0;
  v.muted = true;

  const attempt = async () => {
    try {
      await v.play();
    } catch {
      return false;
    }
    // Started only after the page had stopped waiting for it: stop it again,
    // or it would run on unseen under the still.
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
  ticking = requestAnimationFrame(tick);
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
  if (!ticking) ticking = requestAnimationFrame(tick);
};

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
      <!-- The site's dark ground: all that shows before the first frame has
           painted, so the screen is never a blank while the film loads. -->
      <div class="tw__wash ground-drift" aria-hidden="true" />

      <div class="tw__picture">
        <video
          ref="video"
          class="tw__video"
          :src="props.src"
          :poster="props.poster"
          preload="none"
          muted
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

      <!-- What the building stands on when the picture is a plate rather than
           the whole screen (held upright). -->
      <div class="tw__base" aria-hidden="true" />

      <!-- The ground rising along the foot of the frame for the heading. -->
      <div class="tw__scrim" aria-hidden="true" />

      <div class="tw__copy">
        <p class="tw__eyebrow">The solution</p>
        <h2 class="tw__title">
          <span class="tw__line"><span>Bring care to the</span></span>
          <span class="tw__line tw__line--strong"><span>town</span></span>
        </h2>
      </div>

      <!-- The film's length, while it has the screen. -->
      <div class="tw__clock" aria-hidden="true"><i ref="bar" /></div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.tw {
  position: relative;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
}

.tw__stage {
  --u: min(calc(100vw / 831), calc(var(--vh, 1vh) * 100 / 618));

  position: relative;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  background: var(--g-bg);
}

.tw__wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-dark);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
}

/**
 * The film, edge to edge.
 *
 * Covered rather than fitted: nothing of the stage shows round it, at any
 * shape of screen. On a screen wider than sixteen by nine it is cropped top
 * and bottom, and the crop is weighted a little toward the top of the frame -
 * the sky and the sign are what the film is about, the floor is not.
 */
.tw__picture {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.tw__video,
.tw__still {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: 50% 42%;
}

.tw__still {
  opacity: 0;
  pointer-events: none;

  .is-done &,
  .is-passed & { opacity: 1; }
}

// Only the upright plate stands on a base; full-bleed, the floor is the frame.
.tw__base { display: none; }

/**
 * The ground, rising along the foot of the frame.
 *
 * In the site's own darkest wine rather than black, so the lower third reads as
 * the page coming up into the picture rather than as a shadow over it. It comes
 * in with the heading: over the transformation the film has the whole screen.
 */
.tw__scrim {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    to top,
    rgb(var(--rgb-void) / 0.86) 0%,
    rgb(var(--rgb-void) / 0.62) 16%,
    rgb(var(--rgb-deep) / 0.3) 34%,
    rgb(var(--rgb-deep) / 0) 56%
  );
  opacity: 0;
  transition: opacity 1.6s var(--e-out-quart);

  .is-told & { opacity: 1; }
}

/* -------------------------------------------------------------- the words */

.tw__copy {
  position: absolute;
  left: 0;
  right: 0;
  bottom: clamp(3.2rem, 11vh, 7.5rem);
  z-index: 3;
  pointer-events: none;
  padding-inline: var(--gutter);
  color: #FFFFFF;
  text-align: center;
}

.tw__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 1.1em;
  margin-bottom: clamp(0.9rem, 2.4vh, 1.5rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: rgb(var(--rgb-bone) / 0.78);
  opacity: 0;
  transform: translate3d(0, 0.8rem, 0);
  transition: opacity 1.1s var(--e-out-quart), transform 1.1s var(--e-out-quart);

  // A short rule either side: a title card's mark.
  &::before,
  &::after {
    content: "";
    width: clamp(1.4rem, 2.6vw, 2.6rem);
    height: 1px;
    background: rgb(var(--rgb-bone) / 0.45);
  }

  .is-told & { opacity: 1; transform: none; }
}

.tw__title {
  font-family: var(--font-say);
  font-weight: 300;
  font-size: clamp(2.3rem, calc(40.6 * var(--u)), 5.4rem);
  line-height: 1.12;
  letter-spacing: -0.01em;
  text-shadow: 0 0.1em 1.4em rgb(var(--rgb-void) / 0.35);
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
 * The film's clock: a hairline along the very foot of the screen, filling as
 * it plays. The page is held for these eight seconds, and a hold with no sign
 * of its end reads as the page having stopped working.
 */
.tw__clock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  height: 2px;
  background: rgb(var(--rgb-bone) / 0.14);
  opacity: 0;
  transition: opacity 0.6s var(--e-out-quart);

  i {
    position: absolute;
    inset: 0;
    background: rgb(var(--rgb-bone) / 0.85);
    transform: scaleX(0);
    transform-origin: left center;
  }

  .is-playing & { opacity: 1; }
}

/**
 * Portrait: a film sixteen by nine cannot be covered onto a phone without
 * keeping only its middle quarter, where the clinic is a door. It stands as a
 * wide plate across the middle of the phone instead, dissolving at its top
 * and foot into the ground, and the heading has the ground below it.
 */
@media (orientation: portrait) {
  // A pixel of a 390-wide phone, capped by the page a browser actually shows
  // (760 tall) rather than the phone's whole screen, which set the heading at
  // four-fifths of its size on a real phone.
  .tw__stage {
    --m: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 760));
    /// The plate's height: half again the width at sixteen by nine, but never
    /// more than half the screen, or on a tablet it reached the heading.
    --plate-h: min(calc(150vw * 9 / 16), calc(var(--vh, 1vh) * 52));
    --plate-top: calc(var(--vh, 1vh) * 16);
  }

  // Held at one pose rather than drifting: the film is a plate in the middle
  // of it here, and a ground moving behind a still picture reads as a wobble.
  .tw__wash {
    background-position: 78% 26%;
    animation: none;
  }

  /**
   * The plate dissolves into the ground at its head only. Its foot used to
   * dissolve as well, and the building's own floor went with it - on a phone
   * the clinic read as a blur hanging in the ground rather than a building
   * standing on it. The foot is now a hard edge, with a contact shadow where
   * the building meets it, on the base below.
   */
  .tw__picture {
    inset: auto;
    left: 50%;
    top: var(--plate-top);
    width: calc(var(--plate-h) * 16 / 9);
    height: var(--plate-h);
    transform: translateX(-50%);
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 16%);
    mask-image: linear-gradient(to bottom, transparent, #000 16%);

    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 12%;
      background: linear-gradient(to top, rgb(var(--rgb-void) / 0.32), rgb(var(--rgb-void) / 0));
      pointer-events: none;
    }
  }

  // A plinth the width of the screen: a top edge that catches the light, a
  // face in the site's deep wine, and a soft shadow thrown onto the ground.
  .tw__base {
    display: block;
    position: absolute;
    z-index: 2;
    left: 0;
    right: 0;
    top: calc(var(--plate-top) + var(--plate-h));
    height: clamp(0.85rem, 3.6vw, 1.35rem);
    background:
      linear-gradient(to bottom, rgb(255 255 255 / 0.3) 0, rgb(255 255 255 / 0.3) 1px, rgb(255 255 255 / 0) 1px),
      linear-gradient(to bottom, #6A0E2E 0%, #3C010E 100%);
    box-shadow: 0 0.9rem 1.8rem -0.4rem rgb(var(--rgb-void) / 0.55);
    pointer-events: none;
  }

  .tw__video,
  .tw__still { object-position: 50% 50%; }

  .tw__scrim { display: none; }

  .tw__copy { bottom: calc(var(--vh, 1vh) * 14); }

  .tw__title {
    font-size: max(27px, calc(34 * var(--m)));
    line-height: 1.24;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tw__eyebrow,
  .tw__scrim,
  .tw__line > span { transition: none; }
}
</style>
