<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { scramble } from "../../../composables/useScramble";
import { pageScrollTo } from "../../../composables/useSmoothScroll";

/**
 * The Aleph page opens.
 *
 * Two beats in one held frame. The statement is centred and settles out of
 * noise; then it leaves upward and the questions begin arriving, one card at a
 * time, each lighting a word at a time as the reader travels.
 *
 * Sticky stage rather than a pinned ScrollTrigger, for the reason recorded
 * across the front page: a pinned element becomes `fixed`, reports an offset
 * of zero, and re-measures its own start as the top of the document on any
 * refresh landing while the pin is applied.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

const title = ["Your care,", "mapped."];

const statement =
  "Behind every YOOJ visit is a connected system designed to move the patient "
  + "from consultation to medicines to diagnostics and back again — without "
  + "rebuilding the entire journey each time.";

/** Mock copy, to the reference's own lengths. */
const questions = [
  "Where does the consultation go?",
  "Where does the prescription go?",
  "Where does the medicine come from?",
  "Where does the sample go?",
  "Who connects the result back to the patient?",
  "What makes the next visit better than the last?",
];

const words = questions.map((q) => q.split(" "));

/** The statement holds the frame, then clears out of the questions' way. */
const TITLE_END = 0.22;
const SLICE = (1 - TITLE_END) / questions.length;

const active = () =>
  Math.min(questions.length - 1, Math.max(0, Math.floor((p.value - TITLE_END) / SLICE)));

const through = () => clamp01((p.value - TITLE_END - active() * SLICE) / SLICE);

/**
 * A word's brightness in the card being read.
 *
 * The leading edge runs a fifth of the line ahead of itself, so a few words
 * are always part-lit in front of the ones already read — a hard edge reads as
 * a wipe, this reads as an eye moving along the line.
 */
const lit = (i: number, total: number) => {
  const head = clamp01(through() / 0.72) * (total * 1.2);
  return 0.3 + clamp01((head - i) / (total * 0.2)) * 0.7;
};

/** Where a card sits: being read, waiting off to the right, or gone. */
/**
 * How far the deck is inset, by frame width.
 *
 * On a wide frame the card is 31.5rem inside a 78rem deck, so nudging it 14%
 * of its own width to the right sets it against the deck's left third - the
 * inset is the composition. On a phone the card *is* the deck: the same 14%
 * is 14% of the full width, so the card was shoved off the right edge and the
 * question read as if it had been cropped. At this width there is no third to
 * set it against, so it sits where it belongs - in the middle.
 */
const narrow = ref(false);
const narrowQuery =
  typeof window !== "undefined" ? window.matchMedia("(max-width: 60rem)") : null;
const readNarrow = () => { narrow.value = !!narrowQuery?.matches; };
readNarrow();
narrowQuery?.addEventListener("change", readNarrow);
onBeforeUnmount(() => narrowQuery?.removeEventListener("change", readNarrow));

const card = (i: number) => {
  const a = active();
  if (narrow.value) {
    // One column: the live card centred, the rest stacked out of frame above
    // and below it rather than to the side.
    if (i === a) return { opacity: 1, transform: "translate3d(0, -50%, 0)", zIndex: 3 };
    if (i === a + 1) {
      return { opacity: 0.22, transform: "translate3d(0, -128%, 0) scale(0.62)", zIndex: 2 };
    }
    return {
      opacity: 0,
      transform: `translate3d(0, ${i < a ? -20 : -150}%, 0) scale(${i < a ? 0.9 : 0.5})`,
      zIndex: 1,
    };
  }
  // Every pose carries its own vertical centring: the card is anchored at the
  // deck's midline and pulled back by half its height, so a transform that
  // forgot the -50% would drop it half a card low.
  if (i === a) return { opacity: 1, transform: "translate3d(14%, -50%, 0)", zIndex: 3 };
  if (i === a + 1) {
    return { opacity: 0.22, transform: "translate3d(96%, -104%, 0) scale(0.5)", zIndex: 2 };
  }
  return {
    opacity: 0,
    transform: `translate3d(${i < a ? 4 : 104}%, ${i < a ? -96 : -70}%, 0) scale(${i < a ? 0.9 : 0.45})`,
    zIndex: 1,
  };
};

/* --------------------------------------------------------------- the arrow */

/**
 * The deck can be driven as well as read.
 *
 * The questions are scrubbed off the page's own travel, so the arrow does not
 * set an index — it moves the reader to the scroll position where the next
 * card is the one being read. Anything else would put the deck and the
 * scrollbar into two different states, and the next wheel click would snap
 * back to whichever the trigger believed.
 *
 * Landing at 0.8 of a slice rather than at its start: `lit()` finishes running
 * the leading edge along the line at 0.72, so the question arrives fully lit
 * instead of mid-wipe.
 */
const atLast = () => active() >= questions.length - 1;

const advance = () => {
  if (!root.value || atLast()) return;
  const span = root.value.offsetHeight - window.innerHeight;
  if (span <= 0) return;
  const target = TITLE_END + (active() + 1 + 0.8) * SLICE;
  pageScrollTo(root.value.offsetTop + target * span, 1.25);
};

/* -------------------------------------------------------------- the decode */

const statementEl = ref<HTMLElement | null>(null);
let running: ReturnType<typeof scramble> | null = null;

onMounted(() => {
  if (!root.value) return;

  if (!prefersReduced() && statementEl.value) {
    // Held a beat so the frame is settled before anything starts resolving —
    // a decode that begins during the page's own entrance reads as a glitch
    // rather than as a value arriving.
    setTimeout(() => {
      if (statementEl.value) running = scramble(statementEl.value, { dwell: 260, stagger: 7 });
    }, 420);
  }

  if (prefersReduced()) { p.value = TITLE_END + SLICE * 0.6; return; }
  trigger = scrubThrough(root.value, (v) => (p.value = v), {
    start: "top top",
    end: "bottom bottom",
  });
});

onBeforeUnmount(() => {
  trigger?.kill();
  running?.stop();
});
</script>

<template>
  <section id="aleph-top" ref="root" class="ah">
    <div class="ah__stage">
      <!-- Beat one: the statement, centred, clearing as the questions begin. -->
      <div
        class="ah__open"
        :style="{
          opacity: 1 - beat(TITLE_END * 0.6, TITLE_END),
          transform: `translate3d(0, ${-beat(TITLE_END * 0.6, TITLE_END) * 9}vh, 0)`,
        }"
      >
        <h1 class="ah__title">
          <span v-for="line in title" :key="line">{{ line }}</span>
        </h1>
        <p ref="statementEl" class="ah__statement">{{ statement }}</p>
      </div>

      <!-- Beat two: the questions, one being read and the next one waiting. -->
      <div class="ah__deck" :style="{ opacity: beat(TITLE_END * 0.72, TITLE_END + 0.05) }">
        <article
          v-for="(q, i) in questions"
          :key="i"
          class="ah__card"
          :class="{ 'is-live': i === active() }"
          :style="card(i)"
          :aria-hidden="i !== active()"
        >
          <svg class="ah__wave" viewBox="0 0 44 16" aria-hidden="true">
            <path d="M1 8 C 5 8 5 2 9 2 C 13 2 13 14 17 14 C 21 14 21 4 25 4 C 29 4 29 12 33 12 C 37 12 37 8 43 8" />
          </svg>
          <p class="ah__q" :aria-label="q">
            <span
              v-for="(w, j) in words[i]"
              :key="j"
              aria-hidden="true"
              :style="i === active() ? { opacity: lit(j, words[i].length) } : undefined"
            >{{ `${w} ` }}</span>
          </p>
        </article>
      </div>

      <!-- The arrow. Tracks the right edge of the card being read, and goes
           quiet on the last one rather than disappearing — a control that
           vanishes reads as a bug. -->
      <button
        class="ah__next"
        type="button"
        :disabled="atLast()"
        :aria-label="atLast() ? 'Last question' : 'Next question'"
        data-cursor="scale"
        :style="{ opacity: beat(TITLE_END * 0.72, TITLE_END + 0.05) * (atLast() ? 0.28 : 1) }"
        @click="advance"
      >
        <svg class="ah__arc" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r="27" :style="{ strokeDashoffset: (1 - through()) * 169.65 }" />
        </svg>
        <svg class="ah__glyph" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12 H19 M13 6 L19 12 L13 18" />
        </svg>
      </button>

      <p class="ah__count">{{ active() + 1 }} / {{ questions.length }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// One viewport per question, plus one for the statement to hold on.
.ah {
  position: relative;
  height: 460vh;
  height: calc(var(--sv) * 460);
}

.ah__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  display: grid;
  place-items: center;
  padding: 0 var(--gutter);
  overflow: hidden;
  isolation: isolate;
}

/* ---------------------------------------------------------------- beat one */

.ah__open {
  position: absolute;
  display: grid;
  justify-items: center;
  gap: clamp(1.4rem, 3.6vh, 2.4rem);
  width: min(48rem, 92vw);
  text-align: center;
  will-change: transform, opacity;
}

// 80px / lh 80 / -2px at 1440, which is the reference's own display step.
.ah__title {
  font-size: var(--ta-display);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
  color: var(--ga-ink);

  span { display: block; }
}

// 20px / lh 28, centred, 480px wide — measured, not chosen. The measure is
// what puts the line breaks where the reference puts them.
.ah__statement {
  max-width: 30rem;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  color: var(--ga-ink);
  // The decode swaps every character every few frames; without this the
  // proportional glyphs jostle the line while it resolves.
  font-variant-numeric: tabular-nums;
}

/* ---------------------------------------------------------------- beat two */

.ah__deck {
  position: relative;
  z-index: 3;
  width: min(100%, 78rem);
  height: min(46vh, 22rem);
}

// A capsule, barely drawn. The card is a held shape rather than a panel: on a
// ground this pale a filled box reads as a dialog, and the point is a question
// arriving in the air.
.ah__card {
  position: absolute;
  left: 0;
  top: 50%;
  display: flex;
  align-items: center;
  gap: clamp(1rem, 2.4vw, 2rem);
  width: min(31.5rem, 100%);
  padding: clamp(1.4rem, 3.4vh, 2.2rem) clamp(1.8rem, 3.4vw, 3rem);
  border: 1px solid rgb(60 1 14 / 0.12);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.28);
  backdrop-filter: blur(6px);
  transform-origin: left center;
  transition:
    opacity 0.85s var(--e-out-quart),
    transform 1.05s var(--e-out-expo);
  will-change: transform, opacity;
}

// The one saturated mark on the page, and the only thing that is not ink.
.ah__wave {
  flex: none;
  width: clamp(2rem, 2.6vw, 2.75rem);
  overflow: visible;

  path {
    fill: none;
    stroke: var(--ga-dot);
    stroke-width: 1.4;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }
}

.ah__q {
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  color: var(--ga-ink);

  // Per word, so the whole card cannot cross-fade as one block.
  > span { transition: opacity 0.45s var(--e-out-quart); }
}

// Anchored off the card's own geometry — the same 14% inset and the same
// measure — so it stays beside the capsule at every width instead of at a
// spot that only happens to look right at 1440.
.ah__next {
  position: absolute;
  top: 50%;
  left: calc(14% + min(31.5rem, 86%) + clamp(1.5rem, 4vw, 3.5rem));
  transform: translateY(-50%);
  z-index: 4;
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  border: 1px solid rgb(60 1 14 / 0.22);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.22);
  backdrop-filter: blur(6px);
  transition:
    opacity 0.85s var(--e-out-quart),
    border-color 0.45s var(--e-out-quart),
    background-color 0.45s var(--e-out-quart),
    transform 0.45s var(--e-out-expo);

  .ah__glyph {
    width: 1.15rem;
    overflow: visible;

    path {
      fill: none;
      stroke: var(--ga-ink);
      stroke-width: 1.4;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
  }

  // The reference's ring: the arc round the button is the read of the
  // current question, drawn clockwise from the top as the eye moves along the
  // line, and full when the line is.
  .ah__arc {
    position: absolute;
    inset: -1px;
    width: calc(100% + 2px);
    height: calc(100% + 2px);
    transform: rotate(-90deg);
    overflow: visible;
    pointer-events: none;

    circle {
      fill: none;
      stroke: var(--ga-dot);
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-dasharray: 169.65;
      transition: stroke-dashoffset 0.2s linear;
    }
  }

  &:not(:disabled):hover {
    border-color: var(--ga-dot);
    background: rgb(255 255 255 / 0.4);
    transform: translateY(-50%) translateX(3px);
  }

  &:disabled { cursor: default; }
}

.ah__count {
  position: absolute;
  left: 50%;
  bottom: clamp(1.6rem, 4.5vh, 2.8rem);
  transform: translateX(-50%);
  z-index: 4;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(60 1 14 / 0.5);
  font-variant-numeric: tabular-nums;
}

// Below this there is no room beside a card for the next one to wait in.
@media (max-width: 60rem) {
  .ah__card {
    width: 100%;
    border-radius: 1.75rem;
  }

  .ah__deck { height: min(52vh, 24rem); }

  /**
   * No room beside the card at this width, so the arrow drops under it.
   *
   * Measured from the deck's midline rather than its foot: the card is
   * centred on that line, so this is a fixed distance under the card whatever
   * the deck's own height is. Pinned to the foot it sat 148px clear of the
   * question it advances - far enough to read as unrelated to it, which for
   * the one control on the beat is the whole problem.
   */
  .ah__next {
    top: 50%;
    bottom: auto;
    left: 50%;
    transform: translate(-50%, 0);
    margin-top: clamp(4.4rem, 11.5vh, 5.6rem);

    &:not(:disabled):hover { transform: translate(-50%, -3px); }
  }
}

// Without motion the page is one settled frame: the statement, and the first
// question already open beneath it.
@media (prefers-reduced-motion: reduce) {
  .ah { height: auto; }

  .ah__stage {
    position: relative;
    height: auto;
    padding: var(--stack) var(--gutter);
    gap: clamp(3rem, 9vh, 6rem);
  }

  .ah__open { position: relative; opacity: 1 !important; transform: none !important; }
  .ah__deck { height: auto; min-height: 12rem; opacity: 1 !important; }
  .ah__card:not(.is-live) { display: none; }
  .ah__card.is-live { position: relative; top: auto; transform: none !important; opacity: 1 !important; }
  .ah__q > span { opacity: 1 !important; }
  .ah__next { display: none; }
}
</style>
