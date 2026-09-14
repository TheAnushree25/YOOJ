<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { QuantumScene } from "../../../webgl/QuantumScene";
import { onDark } from "../../../lib/session";
import StepRing from "../../ui/StepRing.vue";

/**
 * The corridor, and what is said inside it.
 *
 * The reader travels into the mark while the argument is put to them one piece
 * at a time. Each piece is flown through the frame on the z axis — small and
 * out of focus in the distance, brought to a hold where it is sharp and still
 * long enough to be read, then past the camera and gone.
 *
 * The hold is the whole of it. An earlier cut had focus peak at a single
 * instant in each pass, which meant a statement was legible at one scroll
 * position and a smear on either side of it: technically present, and unread.
 * Pieces now arrive, stop, and leave — and strictly in turn, so the next has
 * not begun before the last has finished.
 */

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const p = ref(0);

let trigger: ReturnType<typeof scrubThrough> = null;
let scene: QuantumScene | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

/* --------------------------------------------------------------- the words */

interface Piece {
  kind: "list" | "stat" | "say" | "payoff";
  label?: string;
  lead?: string;
  copy?: string;
  value?: string;
  of?: string;
  items?: readonly string[];
  lines?: readonly string[];
}

/**
 * The argument, in order.
 *
 * Two blocks: what the supply chain does and what it is worth, then what a hub
 * is and what it holds. The figures are set at the display size because they
 * are the claim rather than a footnote to it — a number at eighty reads as the
 * point being made, the same number at twenty reads as a caption to something
 * else on the screen.
 */
const pieces: readonly Piece[] = [
  {
    kind: "say",
    lead: "By connecting\nyour care history,\nwe build one\ncontinuous health record.",
  },
  {
    kind: "say",
    lead: "One hub.\nMany points of care.",
    label: "The hub",
    copy: "One centrally owned diagnostic hub per town or city cluster.",
  },
  {
    kind: "list",
    label: "Inside the hub",
    items: [
      "MD pathologist",
      "Full pathology lab",
      "X-ray",
      "Ultrasound",
      "2–8°C cold chain",
      "Barcoded samples",
      "Mapped to JeevanBhar IDs",
    ],
  },
  {
    kind: "payoff",
    lines: ["Care stays local.", "Infrastructure scales centrally."],
  },
  {
    kind: "list",
    label: "The YOOJ supply chain",
    items: [
      "Centralized negotiation.",
      "Generic-first dispensing.",
      "Better procurement.",
      "Extended credit.",
    ],
  },
  {
    kind: "stat",
    value: "8–12%",
    of: "Better generic medicine pricing through bulk negotiation",
  },
  {
    kind: "stat",
    value: "45–60 days",
    of: "Potential distributor credit terms through YOOJ versus typical individual terms",
  },
  {
    kind: "say",
    lead: "Better economics.\nAt network scale.",
  },
  {
    kind: "stat",
    value: "₹35 / test",
    of: "Sample collection and handling fee structure",
  },
  {
    kind: "stat",
    value: "8–12%",
    of: "Generic procurement advantage",
  },
  {
    kind: "stat",
    value: "₹50K–₹75K",
    of: "Projected total monthly monetary benefit to an affiliate",
  },
];

/**
 * Where each piece sits in the section.
 *
 * Stepped rather than overlapped. Each window is a fraction shorter than the
 * distance between them, so one pass is finished and gone before the next
 * begins — anything else puts two statements on screen together, each at half
 * strength, and the reader is left to work out which of them they are reading.
 */
const LEAD = 0.04;
// The count and the light that follows it take the last fifth of the section,
// so the six pieces are laid out across what is left rather than across all of
// it — otherwise the last of them is still leaving while the number runs up.
const TAIL = 0.21;
const STEP = (1 - LEAD - TAIL) / pieces.length;
const SPAN = STEP * 0.97;

/**
 * One pass of the camera.
 *
 * Scale climbs the whole way through, because a thing coming toward you never
 * pauses — but gently, so the growth across the hold is something the reader
 * feels rather than fights. Focus and opacity move together and spend most of
 * the pass at rest.
 */
const fly = (i: number) => {
  const t = clamp01((p.value - (LEAD + i * STEP)) / SPAN);
  const arrive = ease(clamp01(t / 0.26));
  const leave = ease(clamp01((t - 0.72) / 0.28));
  const sharp = arrive * (1 - leave);
  return {
    t,
    sharp,
    scale: 0.56 + t * 1.0,
    blur: (1 - sharp) * (1 - sharp) * 14,
  };
};

const passes = computed(() => pieces.map((_, i) => fly(i)));

/**
 * Which statement the ring is counting, and how far through it the reader is.
 *
 * The pieces are strictly sequential — one has to finish before the next
 * starts — so the last one with any progress at all is the one being read,
 * and its own progress is the arc. Between two pieces the arc simply sits at
 * full, which is what a finished step should look like until the next one
 * takes over.
 */
const step = computed(() => {
  let index = 0;
  let progress = 0;
  passes.value.forEach((f, i) => {
    if (f.t > 0) { index = i; progress = f.t; }
  });
  return { index, progress };
});

/**
 * A list arrives a line at a time.
 *
 * The order is the argument — each line follows from the one above it, so
 * showing the block whole would be showing the conclusion alongside its
 * premise. They are staggered across the first half of the hold and then leave
 * together with the piece that carries them.
 */
const linePose = (pass: ReturnType<typeof fly>, i: number, n: number) => {
  // Finished staggering well before the hold ends, or the last line of a seven
  // item list is on screen for a third of the time the first one had.
  const at = 0.16 + (i / Math.max(1, n)) * 0.22;
  const on = ease(clamp01((pass.t - at) / 0.07));
  return {
    opacity: on * pass.sharp,
    transform: `translate3d(0, ${((1 - on) * 0.85).toFixed(2)}rem, 0)`,
  };
};

/**
 * The count.
 *
 * A number that has to be arrived at rather than stated: the reader watches it
 * run up and stop, which is a different claim from the same figure simply
 * appearing. Each column is a strip of digits behind a window, offset by its
 * own place value — so the units spin, the tens turn, and the thousands barely
 * move, which is what an odometer does and why one reads as a count rather
 * than as a number changing.
 *
 * The figure and its caption are the only invented content on the page and
 * they are meant to be replaced: nothing in the deck is a per-second rate.
 */
const COUNT = { to: 10, unit: "+", of: "Affiliates — the threshold before a diagnostic hub opens" };
/** One wheel per digit of the target, most significant first. */
const PLACES = Array.from({ length: String(COUNT.to).length }, (_, i) => i).reverse();

const counter = computed(() => {
  const from = LEAD + pieces.length * STEP;
  /**
   * A long window, and a gentle ramp across nearly all of it.
   *
   * Both halves of this were too quick. The window was a third again of a
   * single statement's, and the ramp was a cube — which front-loads a
   * deceleration so hard that most of the count was over in the first fifth of
   * it and the rest was a wheel creeping the last digit home. Two and a fifth
   * statements' worth of travel, climbed on a much shallower curve, and the
   * number is genuinely counting for the whole time it is on screen.
   */
  const t = clamp01((p.value - from) / (STEP * 2.2));
  const arrive = ease(clamp01(t / 0.16));
  const leave = ease(clamp01((t - 0.84) / 0.16));
  /**
   * Settled well before it leaves.
   *
   * Running the climb to the end of the window meant the wheels reached ten at
   * the moment the whole thing started fading — the reader watched a number
   * count and never saw it arrive, which is the one frame the beat exists for.
   * Finished at two thirds, it then simply stands there reading ten for the
   * better part of a viewport before it goes.
   */
  const run = 1 - Math.pow(1 - clamp01(t / 0.66), 1.8);
  return { shown: arrive * (1 - leave), value: run * COUNT.to, t };
});

/** Each column's continuous position, in digit-heights. */
const column = (place: number) =>
  (counter.value.value / Math.pow(10, place)) % 10;

/**
 * The light that ends the section.
 *
 * It comes up from below and floods the frame, which is the one move that can
 * take a page from a dark room to a white one without either a cut or a fade
 * to grey through the middle. The field is still falling through it as it
 * goes, so the change reads as something happening in the room rather than as
 * a layer being drawn over it.
 */
const dawn = () => beat(0.95, 1.0);
const bloom = () => beat(0.925, 1.0);

/** How far the ground has deepened as the reader travels further in. */
const sky = () => beat(0.3, 0.86);

onMounted(() => {
  if (!root.value || !canvas.value) return;

  scene = new QuantumScene(canvas.value, {
    // The mark itself, read off the artwork. Swapping the file swaps what the
    // reader flies through; nothing in the scene knows what shape it is.
    src: "/aleph/mark.svg",
    /**
     * Four copies, not six.
     *
     * Six put four contours across the middle of the frame at once and the
     * mark stopped reading as a mark — it became a maze of pipes with text
     * over it. Fewer copies at wider spacing is the whole difference between
     * a corridor and a tangle: there is still always one at the focal
     * distance and one passing, which is all the depth the effect needed.
     */
    shells: 4,
    traced: 3000,
    motes: 3200,
    ink: "#FFF5F6",
    accent: "#FEB3B8",
    /**
     * The sky. A dozen comets, each in flight for half its own cycle, so
     * three or four are usually crossing and the rest are resting.
     */
    comets: 14,
  });
  scene.start();
  window.addEventListener("resize", scene.resize);

  if (prefersReduced()) {
    p.value = 0.2;
    scene.setProgress(0.2);
    onDark.value = true;
    return;
  }

  trigger = scrubThrough(root.value, (v, active) => {
    p.value = v;
    scene?.setProgress(v);
    // Dark from the first frame to the last: this section is entered on the
    // room the one above ends in and never returns to the pale page.
    if (active) onDark.value = true;
  }, { start: "top top", end: "bottom bottom" });
});

onBeforeUnmount(() => {
  trigger?.kill();
  if (scene) window.removeEventListener("resize", scene.resize);
  scene?.dispose();
});
</script>

<template>
  <section id="aleph-quantum" ref="root" class="aq">
    <div class="aq__stage" :style="{ opacity: beat(0, 0.03) }">
      <!-- The room this section is entered in. Painted with the same stack the
           section above ends on, so the join is not a place where anything
           changes. -->
      <div class="aq__room ground-drift" aria-hidden="true" />
      <!-- And the ground it deepens into, over the top of it. -->
      <div class="aq__sky ground-drift--slow" :style="{ opacity: sky() }" aria-hidden="true" />

      <canvas ref="canvas" class="aq__field" />

      <!-- Every piece is centred on the frame and carried past the reader by
           its own transform. -->
      <div
        v-for="(piece, i) in pieces"
        :key="i"
        class="aq__piece"
        :class="`is-${piece.kind}`"
        :style="{
          opacity: passes[i].sharp,
          transform: `translate3d(-50%, -50%, 0) scale(${passes[i].scale.toFixed(3)})`,
          filter: `blur(${passes[i].blur.toFixed(2)}px)`,
        }"
        :aria-hidden="passes[i].sharp < 0.5"
      >
        <p v-if="piece.label" class="aq__label">{{ piece.label }}</p>

        <p v-if="piece.lead" class="aq__lead">{{ piece.lead }}</p>

        <template v-if="piece.kind === 'stat'">
          <p class="aq__figure">{{ piece.value }}</p>
          <p class="aq__of">{{ piece.of }}</p>
        </template>

        <ul v-if="piece.items" class="aq__list">
          <li
            v-for="(item, n) in piece.items"
            :key="n"
            :style="linePose(passes[i], n, piece.items.length)"
          >{{ item }}</li>
        </ul>

        <p v-if="piece.copy" class="aq__copy">{{ piece.copy }}</p>

        <p
          v-for="(line, n) in piece.lines ?? []"
          :key="`l${n}`"
          class="aq__payoff"
          :style="linePose(passes[i], n, piece.lines?.length ?? 1)"
        >{{ line }}</p>
      </div>

      <!-- The reference's ring: a hairline circle at the right, drawing an arc
           as the current statement is read, with the statement's number in
           it. It goes with the pieces and leaves before the count. -->
      <StepRing
        class="aq__ring"
        :index="step.index"
        :total="pieces.length"
        :progress="step.progress"
        light
        :style="{ opacity: beat(0.03, 0.07) * (1 - counter.shown) * (1 - sky()) }"
      />

      <!-- The count, on its own after the six pieces. -->
      <div
        class="aq__count"
        :style="{
          opacity: counter.shown,
          transform: `translate3d(-50%, -50%, 0) scale(${(0.72 + counter.t * 0.5).toFixed(3)})`,
        }"
        :aria-hidden="counter.shown < 0.5"
      >
        <p class="aq__odo">
          <span v-for="place in PLACES" :key="place" class="aq__wheel">
            <span
              class="aq__strip"
              :style="{ transform: `translate3d(0, ${-column(place) * (100 / 11)}%, 0)` }"
            ><i v-for="d in 11" :key="d">{{ (d - 1) % 10 }}</i></span>
          </span>
        <span v-if="COUNT.unit" class="aq__unit">{{ COUNT.unit }}</span>
        </p>
        <p class="aq__of">{{ COUNT.of }}</p>
      </div>

      <!-- The light, rising. -->
      <div
        class="aq__bloom"
        :style="{ opacity: bloom(), transform: `translate3d(-50%, 0, 0) scale(${(0.4 + bloom() * 2.4).toFixed(3)})` }"
        aria-hidden="true"
      />
      <div class="aq__dawn" :style="{ opacity: dawn() }" aria-hidden="true" />

      <p class="aq__here" :style="{ opacity: 1 - dawn() }">Superposition</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
/**
 * Twelve viewports and a bit, and it starts more than one before it appears to.
 *
 * The length is set by the content rather than chosen. Six pieces have to
 * arrive, hold still long enough to be read, and leave, one after another with
 * no two on screen together — and a pass that is over in less than a viewport
 * and a half of travel goes by faster than the sentence inside it can be
 * finished. At this height each piece holds sharp for about seventy
 * viewport-heights of scrolling, which is a read rather than a glimpse.
 *
 * The negative margin is the join. A sticky stage releases over the last
 * viewport of its own section, so the dispersal above would otherwise spend
 * 100vh sliding up and out before this section's top even reached the fold — a
 * viewport of dead scroll between the burst and what follows it. A hundred is
 * not enough on its own, though: pinning at the same instant the section above
 * unpins leaves this stage still fading up while that one has already begun to
 * move. The extra twenty buys the cross-fade somewhere to happen while both
 * stages are still held.
 */
.aq {
  position: relative;
  // Above the section it is taking the frame from, so the release is hidden
  // rather than merely coincident with it.
  z-index: 1;
  margin-top: -120vh;
  margin-top: calc(var(--vh, 1vh) * -120);
  height: 2300vh;
  height: calc(var(--vh, 1vh) * 2300);
}

.aq__stage {
  --ga-dot: #FEB3B8;
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
  // Everything that flies is placed against the centre of this frame.
  --mid: 50%;
}

// The same stack the section above ends on. Restated rather than shared,
// because the two are different elements in different stacking contexts and a
// token would not have made the join any more reliable than a copy does.
.aq__room {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-dark);
  // Declared here, beside the shorthand, and not in the drift class.
  // `background:` resets `background-size` to auto, and a scoped rule outranks
  // an unscoped one — so the size set on .ground-drift was being thrown away
  // and a gradient exactly the size of its own box has nowhere to move to. The
  // position animated correctly and nothing on screen changed.
  background-size: 190% 190%;
}

// Deeper in: the low light drops back and the top of the frame goes almost
// black, which is what lets a pale disc read as a light rather than as one more
// mote in a lit room.
.aq__sky {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(60% 30% at 50% 112%, rgba(254, 179, 184, 0.3) 0%, transparent 70%),
    linear-gradient(180deg, #14030A 0%, #2A0712 52%, #3C010E 100%);
  // Declared here, beside the shorthand, and not in the drift class.
  // `background:` resets `background-size` to auto, and a scoped rule outranks
  // an unscoped one — so the size set on .ground-drift was being thrown away
  // and a gradient exactly the size of its own box has nowhere to move to. The
  // position animated correctly and nothing on screen changed.
  background-size: 165% 165%;
}

.aq__field {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}

/* -------------------------------------------------------------- the pieces */

.aq__piece {
  position: absolute;
  left: var(--mid);
  top: var(--mid);
  z-index: 4;
  width: min(34rem, 62vw);

  // The payoff is set at the heading step, and two full sentences at sixty do
  // not fit a column measured for twenty-six — it breaks mid-sentence and the
  // second line lands under the first as a fragment.
  &.is-payoff { width: min(46rem, 78vw); }
  text-align: center;
  color: #FFFFFF;
  transform-origin: 50% 50%;
  will-change: transform, opacity, filter;

  @media (max-width: 60rem) { width: 82vw; }
}

// 10 / 15 at 1.6px tracking, which is the page's own label step.
.aq__label {
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
  margin: 0 0 clamp(1.2rem, 3.4vh, 2rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.8);

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--ga-dot);
  }
}

// The heading step, and the only place a line break is authored into the copy.
.aq__lead {
  margin: 0 0 clamp(1rem, 3vh, 1.8rem);
  white-space: pre-line;
  font-size: var(--ta-payoff);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
}

// 80 / 80 at -2px, which is the page's display step. A figure set at the size
// of a headline is the whole argument of its beat.
.aq__figure {
  margin: 0;
  font-size: var(--ta-display);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
  font-variant-numeric: tabular-nums;
}

.aq__of {
  margin: 0.7rem auto 0;
  max-width: 20rem;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.92);
}

// Ranged left inside a centred column. A list of consequences set centred
// reads as a poem; the straight left edge is what makes it read as a sequence.
.aq__list {
  display: grid;
  gap: clamp(0.5rem, 1.5vh, 0.9rem);
  margin: 0;
  padding: 0;
  list-style: none;
  text-align: left;
  justify-items: start;
  justify-content: center;

  li {
    font-size: var(--ta-lead);
    line-height: var(--la-lead);
    font-weight: 300;
    will-change: transform, opacity;
  }
}

.aq__copy {
  margin: 0;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  color: rgb(255 255 255 / 0.9);
}

.aq__payoff {
  margin: 0 0 0.2em;
  font-size: var(--ta-payoff);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
  will-change: transform, opacity;
}

// Right of the frame, on the centre line, as the reference sets it.
.aq__ring {
  position: absolute;
  right: var(--gutter);
  top: 50%;
  translate: 0 -50%;
  z-index: 5;
  transition: opacity 0.4s var(--e-out-quart);

  @media (max-width: 60rem) { display: none; }
}

/* --------------------------------------------------------------- the count */

.aq__count {
  position: absolute;
  left: var(--mid);
  top: var(--mid);
  z-index: 4;
  text-align: center;
  color: #FFFFFF;
  transform-origin: 50% 50%;
  will-change: transform, opacity;
}

.aq__odo {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0;
  font-size: clamp(4rem, 9vw, 8.5rem);
  line-height: 1;
  letter-spacing: var(--ls-display);
  font-weight: 200;
  font-variant-numeric: tabular-nums;
}

// The window. One digit tall, and what makes the strip behind it read as a
// wheel rather than as a list sliding past.
// The sign after the wheels, set as the wheels are.
.aq__unit {
  display: block;
  margin-left: 0.04em;
  line-height: 1;
  // The plus sits on the maths axis, a hair under the centre of a lining
  // figure. Level with the wheels, not with the baseline.
  transform: translateY(-0.02em);
}

.aq__wheel {
  display: block;
  overflow: hidden;
  height: 1em;
  // Tabular figures are all one width, so the window can be too — otherwise
  // the columns jostle as a 1 rolls past an 8.
  width: 0.62em;
}

// Eleven cells for ten digits: the last is a second zero, so the wrap from
// nine back round happens inside the strip and never as a jump.
.aq__strip {
  display: block;
  height: 1100%;
  will-change: transform;

  i {
    display: block;
    height: calc(100% / 11);
    font-style: normal;
  }
}

/* ---------------------------------------------------------------- the dawn */

// The light itself: a soft disc rising from below the frame and growing
// through it. Kept separate from the flat wash so the bloom can lead and the
// page can follow it up to white.
.aq__bloom {
  position: absolute;
  left: 50%;
  bottom: -42vh;
  z-index: 3;
  width: 120vh;
  height: 120vh;
  border-radius: 50%;
  transform-origin: 50% 100%;
  background: radial-gradient(circle at 50% 50%,
    #FFFFFF 0%, rgba(255, 228, 230, 0.92) 26%, rgba(254, 179, 184, 0.5) 52%, transparent 72%);
  will-change: transform, opacity;
  pointer-events: none;
}

// And the page it leaves behind, which is the ground the next section stands
// on — painted here so the hand-over is a continuation rather than a cut.
.aq__dawn {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: linear-gradient(180deg, #FFF5F6 0%, #FFF5F6 58%, #FEC9CD 100%);
  pointer-events: none;
}

.aq__here {
  position: absolute;
  left: var(--gutter);
  bottom: clamp(1.6rem, 4.5vh, 2.8rem);
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
  margin: 0;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.7);

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--ga-dot);
  }
}

@media (prefers-reduced-motion: reduce) {
  // No fly, no blur: the pieces stack and are simply read. The stage stops
  // being a held frame and becomes a column, which is the only honest way to
  // present six things that otherwise occupy the same square of screen.
  //
  // The overlap goes with it: with nothing sticky there is no release to cover,
  // and a negative margin would simply pull this section over the one above.
  .aq {
    height: auto;
    margin-top: 0;
  }

  .aq__stage {
    position: relative;
    height: auto;
    display: grid;
    justify-items: center;
    gap: clamp(3rem, 9vh, 6rem);
    padding: var(--stack) var(--gutter);
    opacity: 1 !important;
  }

  .aq__piece,
  .aq__count {
    position: relative;
    left: auto;
    top: auto;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;

    li, .aq__payoff { opacity: 1 !important; transform: none !important; }
  }

  // No rising light without motion; the sections simply meet.
  .aq__bloom, .aq__dawn { display: none; }

  .aq__here { position: relative; left: auto; bottom: auto; }
}
</style>
