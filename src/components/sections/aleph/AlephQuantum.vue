<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { afterPaint } from "../../../lib/schedule";
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
// Cleared on unmount, so a scene scheduled for after the paint is not built
// into a section that has already gone.
let alive = true;
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
 * Two blocks: what a hub is and what it holds, then what the affiliate network
 * does and what that adds up to. It ends on the four R's, below.
 *
 * There are no figures in it any more — every one was taken out. A `stat`
 * piece still renders if one is added back: the figure at the display size,
 * because a number at eighty reads as the point being made and the same
 * number at twenty reads as a caption to something else on the screen.
 */
const pieces: readonly Piece[] = [
  {
    kind: "say",
    lead: "By connecting\nyour care history,\nwe build one\ncontinuous health record.",
  },
  {
    // The heading is the claim itself now; the line that used to sit under it
    // said the same thing again, so it went.
    kind: "say",
    label: "The hub",
    lead: "One centrally owned\ndiagnostic hub\nper cluster.",
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
    label: "The YOOJ Affiliate Network",
    items: [
      "Centralized negotiation.",
      "Generic-first dispensing.",
      "Better procurement.",
      "Extended credit.",
    ],
  },
  {
    kind: "say",
    lead: "Better economics.\nAt network scale.",
  },
];

/**
 * The four R's: what joining the network does to a clinic.
 *
 * Four words that share their first letter, and are set to make the most of
 * it. Ranged left in a centred column, their capitals stack into a spine of
 * four R's in the page's rose, and each word is drawn out of its own R. They
 * arrive one by one — the R first, out of the distance the way everything in
 * this corridor arrives, then the rest of the word unfurling from it — and the
 * newest is the one lit, until the fourth lands and all four light together.
 * Then the set is carried past the camera, the same exit every statement
 * before it takes, and the light comes up behind it.
 */
const RS = ["Rebuild", "Refurbish", "Revive", "Rebrand"] as const;

/**
 * Where everything sits in the section.
 *
 * Stepped rather than overlapped. Each window is a fraction shorter than the
 * distance between them, so one pass is finished and gone before the next
 * begins — anything else puts two statements on screen together, each at half
 * strength, and the reader is left to work out which of them they are reading.
 *
 * The R's are one window three and a half statements long: four words have to
 * land in turn and then be seen together. Everything spoken is gone by
 * `WORDS_END`, which is where the light takes the frame.
 */
const LEAD = 0.04;
const RS_STEPS = 3.4;
const WORDS_END = 0.935;
const STEP = (WORDS_END - LEAD) / (pieces.length + RS_STEPS);
const SPAN = STEP * 0.97;
const RS_FROM = LEAD + pieces.length * STEP;

/**
 * One pass of the camera.
 *
 * Scale climbs the whole way through, because a thing coming toward you never
 * pauses — but gently, so the growth across the hold is something the reader
 * feels rather than fights. Focus and opacity move together and spend most of
 * the pass at rest.
 */
/**
 * How far a piece travels toward the reader, by frame width.
 *
 * The piece is a fixed fraction of the viewport, so its box scales past the
 * frame edge whenever the scale does. On a wide screen the whole arc stays
 * inside; on a phone the same arc carried the text 24px past the edge *while
 * it was still sharp and fully opaque* — so the reader was being shown a
 * sentence with its ends cut off, which is the one thing this beat cannot
 * afford. A shorter throw keeps the arc inside the frame, and because it also
 * starts nearer its full size, the column is wider when it is being read, not
 * narrower.
 */
const narrow = ref(false);
const narrowQuery =
  typeof window !== "undefined" ? window.matchMedia("(max-width: 48rem)") : null;
const readNarrow = () => { narrow.value = !!narrowQuery?.matches; };
readNarrow();
narrowQuery?.addEventListener("change", readNarrow);
onBeforeUnmount(() => narrowQuery?.removeEventListener("change", readNarrow));

const fly = (i: number) => {
  const t = clamp01((p.value - (LEAD + i * STEP)) / SPAN);
  const arrive = ease(clamp01(t / 0.26));
  const leave = ease(clamp01((t - 0.72) / 0.28));
  const sharp = arrive * (1 - leave);
  const from = narrow.value ? 0.7 : 0.56;
  const throw_ = narrow.value ? 0.66 : 1.0;
  return {
    t,
    sharp,
    scale: from + t * throw_,
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

/* ---------------------------------------------------------------- the R's */

/**
 * The R's window, and the set as a whole.
 *
 * `t` runs across their own window. Each word has a slot of `R_SLOT` of it, so
 * the fourth has landed by 0.7; all four are lit by 0.8, stand together until
 * 0.86, and are carried off across the last seventh. The set comes gently
 * closer the whole time it is on screen, as everything in the corridor does —
 * a block that held dead still would read as a caption laid over the travel
 * rather than as something in it.
 */
const R_AT = 0.04;
const R_SLOT = 0.17;

const rs = computed(() => {
  const t = clamp01((p.value - RS_FROM) / (STEP * RS_STEPS));
  const leave = ease(clamp01((t - 0.86) / 0.14));
  const scale = 0.92 + t * 0.14 + leave * 0.5;
  return {
    t,
    leave,
    shown: ease(clamp01((t - R_AT) / 0.05)) * (1 - leave),
    lit: ease(clamp01((t - 0.72) / 0.08)),
    style: {
      opacity: (1 - leave).toFixed(3),
      transform: `translate3d(-50%, -50%, 0) scale(${scale.toFixed(3)})`,
      filter: leave > 0.001 ? `blur(${(leave * leave * 14).toFixed(2)}px)` : "none",
    },
  };
});

/**
 * One word at a time.
 *
 * `land` is its R arriving out of the distance, `unfurl` the rest of the word
 * drawn out of it a beat later, and `pulse` the light the R gives off as it
 * lands. `dim` is the word stepping back once the next one arrives — and
 * coming forward again when all four light up together.
 */
const rWords = computed(() => RS.map((_, k) => {
  const { t, lit } = rs.value;
  const at = R_AT + k * R_SLOT;
  const land = ease(clamp01((t - at) / 0.07));
  const unfurl = ease(clamp01((t - at - 0.035) / 0.11));
  const pulse = clamp01((t - at - 0.02) / 0.14);
  const next = k < RS.length - 1 ? ease(clamp01((t - at - R_SLOT) / 0.08)) : 0;
  return {
    opacity: (1 - next * (1 - lit) * 0.64).toFixed(3),
    cap: {
      opacity: land.toFixed(3),
      transform: `scale(${(0.5 + land * 0.5).toFixed(3)})`,
      filter: land < 0.999 ? `blur(${((1 - land) * (1 - land) * 12).toFixed(2)}px)` : "none",
    },
    halo: {
      opacity: (Math.sin(pulse * Math.PI) * 0.8).toFixed(3),
      transform: `translate(-50%, -50%) scale(${(0.35 + pulse * 1.45).toFixed(3)})`,
    },
    unfurl: unfurl.toFixed(4),
  };
}));

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

  const plate = canvas.value;

  // Built once the page has painted, not inside the route change's own
  // task, and told where the reader has got to by then. See lib/schedule.
  afterPaint(() => {
    if (!alive) return;
    const built = new QuantumScene(plate, {
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
      /**
       * Let go as the last statement leaves, so the R's land in open sky.
       * Held until the end, the outline was still being drawn through the
       * four words while they were read — a bright contour across the middle
       * of "Refurbish" at exactly the moment it was arriving.
       */
      release: RS_FROM - 0.03,
    });
    scene = built;
    built.start();
    window.addEventListener("resize", built.resize);
    built.setProgress(p.value);
  }, 2);

  if (prefersReduced()) {
    p.value = 0.2;
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
  alive = false;
  trigger?.kill();
  if (scene) window.removeEventListener("resize", scene?.resize);
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
           it. It goes with the pieces and leaves before the R's. -->
      <StepRing
        class="aq__ring"
        :index="step.index"
        :total="pieces.length"
        :progress="step.progress"
        light
        :style="{ opacity: beat(0.03, 0.07) * (1 - rs.shown) * (1 - sky()) }"
      />

      <!-- The four R's, one by one, after the last statement. Each word is
           split at its R for the eye; the whole word is what is read out. -->
      <ul
        class="aq__rs"
        :style="{ ...rs.style, '--glow': rs.lit.toFixed(3) }"
        :aria-hidden="rs.shown < 0.5"
      >
        <li
          v-for="(word, k) in RS"
          :key="word"
          class="aq__rword"
          :style="{ opacity: rWords[k].opacity }"
        >
          <span class="aq__vh">{{ word }}</span>
          <span class="aq__rcap" aria-hidden="true">
            <i class="aq__rhalo" :style="rWords[k].halo" />
            <span class="aq__rglyph" :style="rWords[k].cap">{{ word.charAt(0) }}</span>
          </span>
          <span
            class="aq__rrest"
            aria-hidden="true"
            :style="{ '--u': rWords[k].unfurl }"
          >{{ word.slice(1) }}</span>
        </li>
      </ul>

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
 * Seventeen viewports, and it starts more than one before it appears to.
 *
 * The length is set by the content rather than chosen. Six pieces have to
 * arrive, hold still long enough to be read, and leave, one after another with
 * no two on screen together — and a pass that is over in less than a viewport
 * and a half of travel goes by faster than the sentence inside it can be
 * finished. At this height each piece gets a viewport and a half, and the
 * four R's five, which is a read rather than a glimpse. Take a piece out and
 * this has to come down by a hundred and fifty with it, or every other
 * statement slows down to fill the gap.
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
  /**
   * The join, measured in stages - never in travel.
   *
   * This overlap exists so this section's stage pins *before* the one above
   * it lets go: a sticky stage releases 100vh before its section ends, so
   * anything less than one whole viewport of overlap leaves a band where
   * neither stage is held and the reader scrolls past bare ground. That band
   * is what reads as the page changing screens mid-section.
   *
   * It is therefore `--vh`, not `--sv`. The scroll-length scale shortens
   * travel on a phone, and briefly took this with it - 120 became 66, which
   * is less than the one stage the release costs, and opened a 34vh hole
   * between the burst and the corridor on exactly the frames the scale
   * applies to. The stage panes are unscaled for the same reason.
   */
  margin-top: -120vh;
  margin-top: calc(var(--vh, 1vh) * -120);
  height: 1680vh;
  height: calc(var(--sv) * 1680);
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
  // Paired with the shortened throw above: 78 x 1.24 is a hair under the
  // frame, so the sharp phase is never clipped.
  @media (max-width: 48rem) {
    width: 78vw;
    &.is-payoff { width: 78vw; }
  }
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

/* ---------------------------------------------------------------- the R's */

/**
 * Four lines, ranged left, the column centred on the frame.
 *
 * Sized off the height as well as the width, because it is four lines at a
 * line-height of one: keyed to width alone, a short laptop screen had the set
 * taller than half its frame. The ceiling keeps a wide desktop from turning
 * the words into a wall.
 */
.aq__rs {
  position: absolute;
  left: var(--mid);
  top: var(--mid);
  z-index: 4;
  display: grid;
  justify-items: start;
  gap: 0.06em;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: clamp(3rem, min(14vw, 12vh), 7rem);
  line-height: 1;
  letter-spacing: var(--ls-display);
  font-weight: 200;
  color: #FFFFFF;
  white-space: nowrap;
  transform-origin: 50% 50%;
  will-change: transform, opacity, filter;
}

.aq__rword {
  display: flex;
  align-items: baseline;
  transition: opacity 0.5s var(--e-out-quart);
}

// The capital: the page's rose, and a light of its own that grows as the set
// completes. Its box is what the halo is centred on.
.aq__rcap {
  position: relative;
  display: inline-block;
}

.aq__rglyph {
  position: relative;
  z-index: 1;
  display: inline-block;
  color: #FEB3B8;
  text-shadow: 0 0 0.3em rgb(254 179 184 / calc(0.08 + var(--glow, 0) * 0.42));
  transform-origin: 50% 62%;
  will-change: transform, opacity, filter;
}

// The light an R gives off as it lands: soft, rose, and gone by the time the
// rest of its word has been drawn.
.aq__rhalo {
  position: absolute;
  left: 50%;
  top: 56%;
  z-index: 0;
  width: 1.9em;
  height: 1.9em;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(254 179 184 / 0.4) 0%, rgb(254 179 184 / 0.12) 38%, transparent 68%);
  opacity: 0;
  pointer-events: none;
  will-change: transform, opacity;
}

/**
 * The rest of the word, drawn out of its R.
 *
 * A soft-edged mask sweeping left to right, with the letters easing out from
 * behind the capital as it goes: the word reads as growing from its R rather
 * than as a second thing arriving beside it. The gradient's edge is thirty
 * percent of the word wide, which is what keeps the sweep from reading as a
 * wipe.
 */
.aq__rrest {
  --u: 0;
  display: inline-block;
  -webkit-mask-image: linear-gradient(90deg, #000 calc(var(--u) * 130% - 30%), transparent calc(var(--u) * 130%));
  mask-image: linear-gradient(90deg, #000 calc(var(--u) * 130% - 30%), transparent calc(var(--u) * 130%));
  transform: translate3d(calc((1 - var(--u)) * -0.16em), 0, 0);
  will-change: transform;
}

// Read out whole; the split is for the eye.
.aq__vh {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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
  .aq__rs {
    position: relative;
    left: auto;
    top: auto;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;

    li, .aq__payoff { opacity: 1 !important; transform: none !important; }
  }

  // The R's stand whole: every capital landed, every word drawn out.
  .aq__rglyph { opacity: 1 !important; transform: none !important; filter: none !important; }
  .aq__rhalo { display: none; }
  .aq__rrest { --u: 1 !important; }

  // No rising light without motion; the sections simply meet.
  .aq__bloom, .aq__dawn { display: none; }

  .aq__here { position: relative; left: auto; bottom: auto; }
}
</style>
