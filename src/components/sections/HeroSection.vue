<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import gsap from "gsap";
import { RouterLink } from "vue-router";
import BrandMark from "../ui/BrandMark.vue";
import { ScrollTrigger, prefersReduced } from "../../composables/useMotion";
import { isDevice } from "../../composables/useViewport";
import { FrameSequence } from "../../lib/frame-sequence";
import { HANDS_COUNT, handsFrame, heroImageReady } from "../../lib/hero-image";

/**
 * The first screen: the promise, and two hands that close on it as the reader
 * moves.
 *
 * The statement is the landing. Everything else on the screen is quiet around
 * it: the lockup above, and nothing more. The ground is alive the way every ground
 * on the site is - a soft light walking slowly across the blush - and the
 * page's thread, which falls from the lockup behind the words and into the
 * hands, carries a drop of light down its length every few seconds: the eye
 * is led from the name, through the promise, to the thing the reader is about
 * to do.
 *
 * The hands are a film, and only its first third is on the first screen: a
 * hem at the foot of the statement until the reader moves. The scroll plays
 * them together - fingers meeting, one hand closing over the other, held -
 * while the statement falls back behind them, drifting slower than the page
 * and fading, so the drawing has the screen by the time the clasp completes.
 * The film runs the full width at its own proportions and is multiplied onto
 * the ground, so its paper is the page.
 */

const film = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const mark = ref<HTMLElement | null>(null);
const title = ref<HTMLElement | null>(null);
const say = ref<HTMLElement | null>(null);
const mag = ref<HTMLElement | null>(null);

/**
 * The call to action ("Start your YOOJ journey") is HIDDEN FOR NOW
 * (2026-09-24). Its markup, pull and styles are all still here; set this to
 * true to bring it back under the statement.
 */
const SHOW_CTA = false;

let sequence: FrameSequence | null = null;
let trigger: ScrollTrigger | null = null;

/**
 * Whether the entrance has played. The page says when - the moment the gate
 * has lifted - and a reader who asked for less motion simply arrives on the
 * finished frame.
 */
const reduced = prefersReduced();
const shown = ref(reduced);

defineExpose({ play: () => { shown.value = true; } });

/** The statement, a word at a time: each is its own entrance. */
const lineOne = ["Better", "health", "for", "more", "lives"];

/* ------------------------------------------------------ the control's pull */

/**
 * The call to action leans toward the pointer as it approaches - a little,
 * and on a spring - so the one thing on the screen that can be pressed is also
 * the one thing that answers the hand before it is pressed.
 */
let pullX: ((v: number) => void) | null = null;
let pullY: ((v: number) => void) | null = null;

const pull = (event: PointerEvent) => {
  if (event.pointerType !== "mouse" || !mag.value || !pullX || !pullY) return;
  const r = mag.value.getBoundingClientRect();
  pullX((event.clientX - (r.left + r.width / 2)) * 0.2);
  pullY((event.clientY - (r.top + r.height / 2)) * 0.34);
};

const letGo = () => { pullX?.(0); pullY?.(0); };

/* --------------------------------------------------- the statement falls */

/**
 * As the hands rise, the words fall back: they travel slower than the page,
 * so they read as further away than the drawing coming up over them, and
 * fade as the clasp closes. Written straight to the element - this runs on
 * every scroll frame and has no business in the component's state.
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * The same gesture on a phone, measured rather than proportioned.
 *
 * On a wide screen the statement drifts in the middle of a frame whose top
 * corners hold two small marks, and it can fade across most of the film. On a
 * phone the header is a bar the width of the screen and the statement is set
 * the full width of the column, so the same timing slid half-struck words
 * under the menu word. Here the whole first screen - lockup, thread, words
 * and control - falls back as one, at a little under half the page's
 * speed, and is gone by the time its first line would reach the bar. The
 * distance is read off the layout (`measure`), so it holds on any phone.
 */
const HANDHELD_LAG = 0.4;

/** The stacked first screen: held upright, or a phone on its side. See the styles. */
const stackedScreen = () => isDevice("portrait") || isDevice("short");

/** Where the statement's first line stands, in document pixels, at rest. */
let restTop = 0;
/** The foot of the lockup, the same way. */
let markFoot = 0;
/** The height of the fixed bar the words must not reach. */
let band = 56;
/** Whether the last frame was written in the handheld way, so a rotation can undo it. */
let wroteHandheld = false;

/** Top of an element in the document, from the layout - transforms ignored. */
const docTop = (el: HTMLElement) => {
  let y = 0;
  let n: HTMLElement | null = el;
  while (n) {
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return y;
};

const measure = () => {
  if (title.value) restTop = docTop(title.value);
  if (mark.value) markFoot = docTop(mark.value) + mark.value.offsetHeight;
  band = document.querySelector<HTMLElement>(".head")?.offsetHeight || 56;
};

const recede = (p: number, scroll: number) => {
  const el = say.value;
  if (!el) return;

  if (stackedScreen() && frame.value) {
    if (!wroteHandheld) {
      el.style.transform = "";
      el.style.opacity = "";
      wroteHandheld = true;
    }
    const keep = 1 - HANDHELD_LAG;
    const travel = Math.max(80, (restTop - band) / keep);
    frame.value.style.transform = `translate3d(0, ${(scroll * HANDHELD_LAG).toFixed(1)}px, 0)`;
    frame.value.style.opacity = (1 - smooth(clamp01(scroll / travel))).toFixed(3);
    // The lockup sits nearest the bar and reaches it first: it leaves on its
    // own, sooner, and the header's own mark takes over from it.
    if (mark.value) {
      const lead = Math.max(32, (markFoot - band) / keep);
      mark.value.style.opacity = (1 - smooth(clamp01(scroll / lead))).toFixed(3);
    }
  } else {
    if (wroteHandheld) {
      if (frame.value) { frame.value.style.transform = ""; frame.value.style.opacity = ""; }
      if (mark.value) mark.value.style.opacity = "";
      wroteHandheld = false;
    }
    const fade = clamp01((p - 0.12) / 0.62);
    el.style.transform = `translate3d(0, ${(p * 11).toFixed(3)}vh, 0)`;
    el.style.opacity = (1 - smooth(fade)).toFixed(3);
  }
};

onMounted(() => {
  if (mag.value && !reduced) {
    pullX = gsap.quickTo(mag.value, "x", { duration: 0.65, ease: "power3.out" });
    pullY = gsap.quickTo(mag.value, "y", { duration: 0.65, ease: "power3.out" });
  }

  if (!canvas.value || !film.value) return;
  try {
    sequence = new FrameSequence(canvas.value, {
      url: (i) => handsFrame(i),
      count: HANDS_COUNT,
      // The clasp sits a little right of centre in the film; a phone, which
      // sees only a slice of the width, is given that slice.
      focusX: 0.52,
      focusY: 0.5,
    });
  } catch {
    return;
  }

  const seq = sequence;
  window.addEventListener("resize", seq.resize);
  // Dev-only handle, for headless checks of which frame is on the canvas.
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__hands = seq;

  if (reduced) {
    // The finished clasp, and nothing to scrub.
    void seq.prime(HANDS_COUNT - 1);
    return;
  }

  // The opening frame first - the gate has already waited for it, so it is in
  // the cache - and the rest of the film behind it, coarse to fine.
  void heroImageReady.then(() => seq.prime(0)).then(() => seq.loadAll());

  measure();
  ScrollTrigger.addEventListener("refresh", measure);

  trigger = ScrollTrigger.create({
    trigger: film.value,
    // From the page's first pixel of travel: the hands begin to move the
    // moment the reader does.
    start: 0,
    // Complete as the film's centre reaches the upper third of the screen.
    end: "center 30%",
    onUpdate: (self) => {
      seq.setProgress(self.progress);
      recede(self.progress, self.scroll());
    },
    // Re-measured with everything else on a refresh; the film's height is a
    // share of the width, so a resize moves where the clasp completes.
    invalidateOnRefresh: true,
  });
});

onBeforeUnmount(() => {
  trigger?.kill();
  ScrollTrigger.removeEventListener("refresh", measure);
  if (mag.value) gsap.killTweensOf(mag.value);
  if (sequence) window.removeEventListener("resize", sequence.resize);
  sequence?.dispose();
});
</script>

<template>
  <section id="top" class="hero" :class="{ 'is-shown': shown }">
    <!-- The light on the ground, walking slowly across the blush. Kept above
         the drawing: multiplied into the paper it would tint the hands. -->
    <div class="hero__light" aria-hidden="true"><i /></div>

    <!-- The first screen: everything above the film. In the flow rather than
         laid over it, so whatever the copy needs on a given screen, the film
         starts below it instead of under it. -->
    <div ref="frame" class="hero__frame">
      <!-- The header's own mark stands down while this one is on screen;
           see SiteHeader's `markHidden`. The inner span is what the scroll
           fades on a phone; the entrance belongs to the paragraph. -->
      <p class="hero__brand" aria-hidden="true">
        <span ref="mark" class="hero__brand-in">
          <BrandMark class="hero__glyph" />
          <span class="hero__name">YOOJ</span>
        </span>
      </p>

      <!-- The page's thread: down from the lockup, behind the statement, and
           one long step sideways into the run that carries it through the
           hands. The second stroke is the drop of light that travels it. -->
      <div class="hero__thread" aria-hidden="true">
        <svg viewBox="0 0 100 1000" preserveAspectRatio="none" focusable="false">
          <path class="hero__strand" d="M 99.5 0 V 830 C 99.5 930 0.5 900 0.5 1000" />
          <path class="hero__drop" d="M 99.5 0 V 830 C 99.5 930 0.5 900 0.5 1000" pathLength="1000" />
        </svg>
      </div>

      <div ref="say" class="hero__say">
        <h1 ref="title" class="hero__title">
          <span class="hero__line">
            <template v-for="(word, i) in lineOne" :key="word">
              <span class="hero__word" :style="{ '--i': i }">{{ word }}</span>{{ i < lineOne.length - 1 ? " " : "" }}
            </template>
          </span>
          <span class="hero__line hero__line--strong">
            <span class="hero__word" :style="{ '--i': lineOne.length }">everyday.</span>
          </span>
        </h1>

        <div v-if="SHOW_CTA" class="hero__cta">
          <RouterLink
            to="/solutions"
            class="hero__go"
            data-cursor="scale"
            @pointermove="pull"
            @pointerleave="letGo"
          >
            <span ref="mag" class="hero__go-mag">
              <span class="hero__go-halo" aria-hidden="true" />
              <span class="hero__go-body">
                <span class="hero__go-label">Start your YOOJ journey</span>
                <span class="hero__go-disc" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 12h14M13 5.5 19.5 12 13 18.5" /></svg>
                  <svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 12h14M13 5.5 19.5 12 13 18.5" /></svg>
                </span>
              </span>
            </span>
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- The film: full width, hemming the foot of the first screen and
         carrying on well below it. The thread's straight run goes through it,
         so the two can never come apart whatever the copy above has pushed
         the film down by. -->
    <div ref="film" class="hero__film" aria-hidden="true">
      <canvas ref="canvas" class="hero__canvas" />
      <span class="hero__run" />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

/**
 * The first screen is the statement; the film is what is under it.
 *
 * `--film-top` is where the drawing starts, and it is set so that just under a
 * third of the film is on the first screen - the hands are a hem, not a
 * picture, until the reader moves. The floor beneath it is the only guard: on
 * a window too short to hold both, the statement keeps its room and the film
 * shows whatever is left.
 *
 * The section is that first screen plus the rest of the film's run below it:
 * the two stand in the flow, one after the other, so on a screen where the
 * copy needs more room than `--film-top` gives it (a phone on its side) the
 * film simply starts lower, rather than the note being printed over it.
 */
.hero {
  /// The first screen.
  --screen: calc(var(--vh, 1vh) * 100);
  /// The film: its own proportions (1280 x 696), the full width.
  --film-h: calc(100vw * 696 / 1280);
  --film-shown: 0.3;
  --film-top: max(
    calc(var(--screen) - var(--film-shown) * var(--film-h)),
    calc(var(--screen) * 0.62)
  );

  /// The statement, capped against the height as well as the width, so a
  /// long, shallow window cannot set a headline taller than its room.
  --say: min(5.6vw, calc(var(--vh, 1vh) * 11.5));
  /// The lockup, and the space kept above it.
  --brand: clamp(1.05rem, 1.62vw, 1.85rem);
  --brand-top: clamp(1.35rem, 3.1vh, 2.3rem);
  /// Where the thread stands: under the right end of the lockup.
  --thread-x: clamp(1.45rem, 2.5vw, 3rem);
  /// The call to action's height; everything in it is measured off this.
  --go-h: clamp(3.6rem, 7.2vh, 4.6rem);

  position: relative;
  min-height: var(--screen);
  overflow: hidden;
  isolation: isolate;
  // Blush at the head of the screen, clearing to white just above the hands,
  // and white all the way down past them.
  background: linear-gradient(
    to bottom,
    #FEB4B8 0,
    #FDC2C6 calc(var(--film-top) * 0.16),
    #FDD6DA calc(var(--film-top) * 0.44),
    #FCE8EB calc(var(--film-top) * 0.63),
    #FDF3F4 calc(var(--film-top) * 0.78),
    #FFFFFF calc(var(--film-top) * 0.93)
  );
}

/* -------------------------------------------------------------- the light */

/**
 * One layer, two lights, walking a slow ellipse: a white bloom high on the
 * left behind the lockup, and a rose one on the right that spans both halves
 * of the hero - centred on the seam where the blush clears to the drawing, so
 * it carries down out of the statement and across the hands in one piece.
 * Under the film, deliberately: the film is multiplied onto whatever is below
 * it, so where the rose light lies the paper takes it up and the hands are lit
 * by it too. The same idea as every other ground on the site - the light
 * moves, the ground does not - done as a transform on one element so it never
 * repaints anything.
 *
 * Its box overhangs the hero on every side, so the walk never brings an edge
 * into view; the lights are placed in the box's own coordinates, offset by
 * that overhang.
 */
.hero__light {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  i {
    --over-x: 10vw;
    --over-y: calc(var(--vh, 1vh) * 18);

    position: absolute;
    left: calc(var(--over-x) * -1);
    right: calc(var(--over-x) * -1);
    top: calc(var(--over-y) * -1);
    height: calc(var(--film-top) + var(--film-h) * 0.8 + var(--over-y) * 2);
    background:
      radial-gradient(
        40vw calc(var(--vh, 1vh) * 34) at calc(var(--over-x) + 24vw) calc(var(--over-y) + var(--vh, 1vh) * 20),
        rgb(255 255 255 / 0.62),
        rgb(255 255 255 / 0) 70%
      ),
      radial-gradient(
        46vw calc(var(--vh, 1vh) * 42) at calc(var(--over-x) + 80vw) calc(var(--over-y) + var(--film-top)),
        rgb(252 150 162 / 0.46),
        rgb(252 150 162 / 0) 72%
      );
    opacity: 0;
    transition: opacity 2.4s var(--e-out-quart) 0.2s;
    animation: hero-walk 22s var(--e-in-out-quad) infinite alternate;
  }
}

.is-shown .hero__light i { opacity: 1; }

@keyframes hero-walk {
  0%   { transform: translate3d(-4%, -2%, 0) scale(1); }
  50%  { transform: translate3d(5%, 3%, 0) scale(1.06); }
  100% { transform: translate3d(-2%, 5%, 0) scale(1.02); }
}

/* --------------------------------------------------------------- the film */

.hero__film {
  position: relative;
  height: var(--film-h);
  z-index: 1;
  pointer-events: none;
  // The frames are drawn on white paper; multiplied, the paper is the page.
  mix-blend-mode: multiply;
  opacity: 0;
  transform: translate3d(0, 2.5%, 0);
  transition:
    opacity 1.4s var(--e-out-quart) 0.1s,
    transform 1.8s var(--e-out-expo) 0.1s;
}

.is-shown .hero__film { opacity: 1; transform: none; }

.hero__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* ------------------------------------------------------------ the words */

/**
 * The first screen's composition: everything above the film. A column - the
 * lockup at the top, the statement standing in the room that is left - so it
 * holds its proportions on a window of any shape.
 */
.hero__frame {
  position: relative;
  z-index: 2;
  min-height: var(--film-top);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--brand-top) var(--gutter) 0;
  pointer-events: none;
}

.hero__brand {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: var(--brand);
  line-height: 1;
  letter-spacing: 0.16em;
  // The J's own sidebearing is the only thing on the right of a tracked word;
  // pulled back, the lockup is optically centred rather than measured.
  text-indent: 0.16em;
  color: var(--c-wine);
}

.hero__brand-in {
  display: inline-flex;
  align-items: center;
  gap: 0.42em;
}

.hero__glyph {
  width: 1.22em;
  height: 1.22em;
  flex: none;
}

.hero__name { display: block; }

// Behind the statement, not over it: at this size a hairline across the
// letters reads as a strike, and behind them it is a thread they hang on.
.hero__thread {
  position: absolute;
  z-index: 1;
  left: calc(50% + 3px);
  top: calc(var(--brand-top) + var(--brand) * 1.5);
  bottom: 0;
  width: var(--thread-x);
  clip-path: inset(0 0 100% 0);
  transition: clip-path 1.5s var(--e-in-out-quart) 0.3s;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    overflow: visible;
  }

  path {
    fill: none;
    vector-effect: non-scaling-stroke;
  }
}

.hero__strand {
  stroke: rgb(var(--rgb-ink) / 0.24);
  stroke-width: 1;
}

/**
 * The drop: a short bright length of the same path, run from the lockup to
 * the head of the film in the first part of a cycle; the run below picks it
 * up for the second part. `pathLength` makes the numbers the path's own,
 * whatever height the thread has been stretched to.
 */
.hero__drop {
  stroke: rgb(var(--rgb-action) / 0.9);
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-dasharray: 70 1100;
  stroke-dashoffset: 70;
  opacity: 0;
}

.is-shown .hero__drop {
  opacity: 1;
  animation: hero-drop 6.4s linear 2.8s infinite;
}

@keyframes hero-drop {
  0%   { stroke-dashoffset: 70; animation-timing-function: cubic-bezier(0.55, 0, 0.4, 1); }
  36%  { stroke-dashoffset: -1000; }
  100% { stroke-dashoffset: -1000; }
}

// The straight run: from the head of the film, through the hands, to the foot
// of the section. Its own drop continues the thread's.
.hero__run {
  position: absolute;
  z-index: 1;
  left: calc(50% + 2.5px);
  top: 0;
  bottom: 0;
  width: 1px;
  overflow: hidden;
  background: rgb(var(--rgb-ink) / 0.24);
  pointer-events: none;
  transform: scaleY(0);
  transform-origin: top center;
  transition: transform 1.6s var(--e-in-out-quart) 1.2s;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgb(var(--rgb-action) / 0) 0, rgb(var(--rgb-action) / 0.9) 5%, rgb(var(--rgb-action) / 0) 11%);
    transform: translate3d(0, -12%, 0);
    opacity: 0;
  }
}

.is-shown {
  .hero__thread { clip-path: inset(0); }
  .hero__run { transform: none; }
  .hero__run::after { animation: hero-run 6.4s linear 2.8s infinite; }
}

@keyframes hero-run {
  0%, 35%  { transform: translate3d(0, -12%, 0); opacity: 0; }
  36%      { transform: translate3d(0, -12%, 0); opacity: 1; animation-timing-function: cubic-bezier(0.3, 0, 0.5, 1); }
  78%      { transform: translate3d(0, 100%, 0); opacity: 1; }
  79%, 100% { transform: translate3d(0, 100%, 0); opacity: 0; }
}

// The statement and its control, standing in the room the lockup leaves and
// biased a little below its middle.
.hero__say {
  position: relative;
  z-index: 2;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1.8rem, 5.4vh, 3.4rem);
  padding-top: clamp(1.5rem, 7vh, 5rem);
}

/**
 * Weighted for the size it is set at: at display size Montserrat's 300 goes
 * spindly and its 800 lands as a slab, so the pair is taken one step in from
 * each end - which reads as the same light-to-heavy relationship the headings
 * below have at theirs.
 */
.hero__title {
  text-align: center;
  font-family: var(--font-say);
  font-weight: 400;
  font-size: var(--say);
  line-height: 1.08;
  letter-spacing: -0.016em;
  color: var(--c-wine);
}

.hero__line {
  display: block;
  white-space: nowrap;
}

.hero__line--strong { font-weight: 700; }

/**
 * A word at a time: each comes up out of focus and sharpens as it lands, on a
 * stagger in reading order. The blur is what makes it read as the words
 * arriving rather than as boxes sliding.
 */
.hero__word {
  display: inline-block;
  opacity: 0;
  filter: blur(14px);
  transform: translate3d(0, 0.34em, 0) scale(1.04);
  transition:
    opacity 1.1s var(--e-out-quart),
    filter 1.3s var(--e-out-quart),
    transform 1.5s var(--e-out-expo);
  transition-delay: calc(0.14s + var(--i) * 0.075s);
}

.is-shown .hero__word {
  opacity: 1;
  filter: none;
  transform: none;
}

/* --------------------------------------------------------- the control */

.hero__cta {
  display: flex;
  justify-content: center;
}

.hero__go {
  pointer-events: auto;
  display: inline-flex;
  // A generous hit area round the capsule, so the pull begins before the
  // pointer is actually on it.
  padding: 0.9rem 1.4rem;
  margin: -0.9rem -1.4rem;
  color: #FFFFFF;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;

  &:focus-visible {
    outline: none;

    .hero__go-body { outline: 2px solid rgb(var(--rgb-action) / 0.6); outline-offset: 4px; }
  }
}

.hero__go-mag {
  position: relative;
  display: inline-flex;
  will-change: transform;
}

// The breath: a ring leaving the capsule every few seconds, so the one control
// on the screen is found without being shouted.
.hero__go-halo {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  pointer-events: none;
}

.is-shown .hero__go-halo { animation: hero-halo 3.6s var(--e-out-quart) 2.2s infinite; }

@keyframes hero-halo {
  0%       { box-shadow: 0 0 0 0 rgb(var(--rgb-action) / 0.34); }
  72%, 100% { box-shadow: 0 0 0 1.1rem rgb(var(--rgb-action) / 0); }
}

/**
 * The capsule. Lit from above - a hairline of light along its top edge and a
 * shade along its foot - and set down with a long wine shadow, so it reads as
 * an object on the page rather than a fill in it.
 */
.hero__go-body {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: clamp(0.9rem, 1.2vw, 1.3rem);
  height: var(--go-h);
  padding: 0 calc(var(--go-h) * 0.09) 0 calc(var(--go-h) * 0.5);
  border-radius: 999px;
  overflow: hidden;
  background:
    linear-gradient(135deg, #C21C4E 0%, #9E1235 44%, #750227 100%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.24),
    inset 0 -0.9rem 1.4rem -1rem rgb(var(--rgb-ink) / 0.5),
    0 1.6rem 2.8rem -1.3rem rgb(117 2 39 / 0.62),
    0 0.35rem 0.9rem -0.35rem rgb(117 2 39 / 0.4);
  transition: box-shadow 0.6s var(--e-out-expo);

  // The sheen: a band of light drawn across on the way in.
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, rgb(255 255 255 / 0) 30%, rgb(255 255 255 / 0.3) 50%, rgb(255 255 255 / 0) 70%);
    transform: translate3d(-120%, 0, 0);
    transition: transform 1s var(--e-out-quart);
    pointer-events: none;
  }
}

.hero__go:hover .hero__go-body {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.3),
    inset 0 -0.9rem 1.4rem -1rem rgb(var(--rgb-ink) / 0.5),
    0 2.2rem 3.4rem -1.3rem rgb(117 2 39 / 0.72),
    0 0.45rem 1.1rem -0.35rem rgb(117 2 39 / 0.45);

  &::before { transform: translate3d(120%, 0, 0); }
}

.hero__go-label {
  position: relative;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: clamp(0.95rem, 1.1vw, 1.15rem);
  letter-spacing: 0.012em;
  white-space: nowrap;
}

// The arrow in its own disc: on the way in one arrow leaves to the right and
// the next arrives from the left, so the disc reads as moving on.
.hero__go-disc {
  position: relative;
  display: grid;
  place-items: center;
  width: calc(var(--go-h) * 0.78);
  height: calc(var(--go-h) * 0.78);
  border-radius: 50%;
  overflow: hidden;
  background: #FFF4F5;
  color: var(--c-indigo);
  box-shadow: 0 0.3rem 0.8rem -0.3rem rgb(var(--rgb-ink) / 0.45);
  transition: transform 0.7s var(--e-out-expo);

  svg {
    grid-area: 1 / 1;
    width: 42%;
    height: 42%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: transform 0.6s var(--e-out-expo);
  }

  svg + svg { transform: translate3d(-170%, 0, 0); }
}

.hero__go:hover .hero__go-disc {
  transform: scale(1.06);

  svg:first-child { transform: translate3d(170%, 0, 0); }
  svg + svg { transform: none; }
}

/* ------------------------------------------------------- the entrance */

.hero__brand,
.hero__cta {
  translate: 0 0.9rem;
  transition:
    opacity 1.1s var(--e-out-quart),
    translate 1.1s var(--e-out-quart);
}

.hero__brand,
.hero__cta { opacity: 0; }

.hero__cta { transition-delay: 0.62s; }

.is-shown {
  .hero__brand,
  .hero__cta { opacity: 1; translate: none; }
}

/**
 * Held upright: the same screen, stacked.
 *
 * The lockup at the head, clear of the header's bar; the thread hanging from
 * it to the statement; the control under that; and the hands the hem below -
 * taller than the film's own shape and cropped to the clasp, so the arms run
 * off both sides as they do on a wide screen, and a little more of them on
 * the first screen than a desktop shows, because a phone's first screen is
 * most of what it sees of them before they move.
 *
 * Whatever height is left over goes two parts to the thread and one under the
 * statement: the statement always hangs from the thread, and on a tall phone
 * sits low enough that the words and the hands read together.
 */
@include portrait {
  .hero {
    --film-h: min(max(calc(100vw * 696 / 1280), calc(var(--screen) * 0.5)), 128vw);
    --film-shown: 0.42;
    --film-top: max(
      calc(var(--screen) - var(--film-shown) * var(--film-h)),
      calc(var(--screen) * 0.5)
    );
    // A phone's width, a short phone's height, and - the third term - a
    // tablet's: at 8.8vw on a tablet held upright the first line ran from
    // gutter to gutter.
    --say: min(8.8vw, calc(var(--vh, 1vh) * 5.2), calc(1.4rem + 3.2vw));
    --brand: clamp(1rem, 4.8vw, 1.5rem);
    --brand-top: clamp(3.9rem, calc(var(--vh, 1vh) * 8), 6.5rem);
    --go-h: 3.5rem;
    background: linear-gradient(
      to bottom,
      #FEB4B8 0,
      #FDC2C6 calc(var(--film-top) * 0.18),
      #FDD6DA calc(var(--film-top) * 0.46),
      #FCE8EB calc(var(--film-top) * 0.64),
      #FDF3F4 calc(var(--film-top) * 0.79),
      #FFFFFF calc(var(--film-top) * 0.94)
    );
  }

  // The share of the spare height that sits under the statement.
  .hero__frame::after {
    content: "";
    flex: 1 1 0;
  }

  /**
   * The thread, as a pendant: from under the lockup to just over the
   * statement, and no further.
   *
   * Behind a centred column it ran down the middle of every line, which at a
   * phone's measure reads as a rule dividing the words rather than a thread
   * they hang on. It carries the same drop of light, and the drop hands on to
   * the run through the hands at the same beat as on a wide screen.
   */
  .hero__thread {
    position: relative;
    left: auto;
    top: auto;
    bottom: auto;
    flex: 2 1 0;
    align-self: center;
    width: 1px;
    min-height: clamp(1.5rem, calc(var(--vh, 1vh) * 4.5), 3rem);
    // Long enough to take its two parts of the spare height on a phone. At
    // 18vh it ran out, and the rest collected under the statement as a blank
    // band between the words and the hands.
    max-height: calc(var(--vh, 1vh) * 30);
    margin: clamp(0.55rem, calc(var(--vh, 1vh) * 1.5), 0.9rem) 0 clamp(0.75rem, calc(var(--vh, 1vh) * 2), 1.15rem);
    // On the run's line: both are a hairline 2.5px right of centre.
    translate: 3px 0;
    overflow: hidden;
    background: rgb(var(--rgb-ink) / 0.24);

    svg { display: none; }

    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      height: 40%;
      background: linear-gradient(to bottom, rgb(var(--rgb-action) / 0), rgb(var(--rgb-action) / 0.9) 55%, rgb(var(--rgb-action) / 0));
      transform: translate3d(0, -100%, 0);
      opacity: 0;
    }
  }

  .is-shown .hero__thread::after { animation: hero-pendant 6.4s linear 2.8s infinite; }

  .hero__say {
    flex: none;
    gap: clamp(1.25rem, calc(var(--vh, 1vh) * 3.4), 2.1rem);
    padding-top: 0;
  }

  .hero__title { line-height: 1.12; }

  // A phone cannot hold the line unbroken; it sets itself in the column.
  .hero__line { white-space: normal; }

  .hero__go-label { font-size: 0.95rem; }
}

// The pendant's drop: down its length in the first stretch of the cycle, when
// the wide screen's drop runs down the thread, so the run below takes over at
// the same moment on both.
@keyframes hero-pendant {
  0%        { transform: translate3d(0, -100%, 0); opacity: 1; animation-timing-function: cubic-bezier(0.55, 0, 0.4, 1); }
  36%       { transform: translate3d(0, 250%, 0); opacity: 1; }
  37%, 100% { transform: translate3d(0, 250%, 0); opacity: 0; }
}

/**
 * A phone on its side.
 *
 * The wide composition in a frame a third of its height. The long thread
 * stands down - in a band this shallow it is a rule through the words rather
 * than a line they hang on - and the run through the hands remains. The
 * statement stands in the middle of the room between the lockup and the film.
 */
@include short {
  .hero {
    --film-top: max(
      calc(var(--screen) - var(--film-shown) * var(--film-h)),
      calc(var(--screen) * 0.72)
    );
    --say: min(5.4vw, calc(var(--vh, 1vh) * 10.5));
    --go-h: 3rem;
  }

  .hero__thread { display: none; }

  // Clear of the header's bar, which on a wide phone is the desktop's: the
  // readout in the right-hand corner would otherwise touch the first line.
  .hero__say {
    gap: clamp(0.9rem, calc(var(--vh, 1vh) * 4.2), 1.4rem);
    padding-top: clamp(1.4rem, calc(var(--vh, 1vh) * 7), 2.2rem);
  }

  .hero__go-label { font-size: 0.9rem; }
}

/**
 * A finger has no hover: the sheen and the arrow's hand-over stay for the
 * pointer, and a press on a phone is answered by the page changing instead of
 * by a hover state left stuck on the capsule.
 */
@include touch {
  .hero__go:hover .hero__go-body {
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.24),
      inset 0 -0.9rem 1.4rem -1rem rgb(var(--rgb-ink) / 0.5),
      0 1.6rem 2.8rem -1.3rem rgb(117 2 39 / 0.62),
      0 0.35rem 0.9rem -0.35rem rgb(117 2 39 / 0.4);

    &::before { transform: translate3d(-120%, 0, 0); }
  }

  .hero__go:hover .hero__go-disc {
    transform: none;

    svg:first-child { transform: none; }
    svg + svg { transform: translate3d(-170%, 0, 0); }
  }

  .hero__go:active .hero__go-body { transform: scale(0.97); }
  .hero__go-body { transition: box-shadow 0.6s var(--e-out-expo), transform 0.2s var(--e-out-quart); }
}

@media (prefers-reduced-motion: reduce) {
  .hero__light i { animation: none; }

  .is-shown .hero__drop,
  .is-shown .hero__run::after,
  .is-shown .hero__thread::after,
  .is-shown .hero__go-halo { animation: none; }

  .hero__word { filter: none; transition: none; }
}
</style>
