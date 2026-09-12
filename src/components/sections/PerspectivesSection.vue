<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";

/**
 * The fifth movement: what the people it is for actually say.
 *
 * After four sections of instruments and principles, one screen of nobody's
 * argument but their own. The quotes are not decoration around the case — they
 * are the case, so they get the page's largest body setting and a held frame.
 *
 * The reading itself is the animation. Each quote lights a word at a time as
 * the reader scrolls, at roughly the rate the line would be read aloud; the
 * next one waits to the right, dimmed, and takes over when the one before it
 * has finished. Nothing here is on a timer — a quote that advanced on its own
 * would move while somebody was still reading it.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

const intro = [
  "Collective voices of people describing",
  "the care they have actually had.",
  "This is why we do what we do.",
];

/** Illustrative composites, not real patients. */
const voices = [
  {
    q: "I have been on a waiting list for months, and every day feels like its own argument. The system is slow to answer, and there is nothing in between being fine and being in crisis.",
    who: "Composite, 29",
    what: "Waiting for an assessment",
  },
  {
    q: "Every clinician I see has a different idea of what is wrong with me, and none of them seem to be reading the same history. I tell the story again from the beginning each time.",
    who: "Composite, 41",
    what: "Three referrals in two years",
  },
  {
    q: "The appointment lands on a good day and I sound fine, because on a good day I am fine. Nobody ever sees the week that led up to it, and the week is the part that matters.",
    who: "Composite, 34",
    what: "Under a specialist team",
  },
];

/** The stage opens with the title, which then clears out of the quotes' way. */
const TITLE_END = 0.2;
/** What is left is divided evenly; the tail of each slice is its handover. */
const SLICE = (1 - TITLE_END) / voices.length;

/**
 * Which quote is being read.
 *
 * Note what is clamped and what is not: the slice index is bounded against the
 * list, not against 0..1. Clamping the quotient first — which is what this did
 * — caps it at one before the floor ever sees it, so the third quote could not
 * be reached however far the reader scrolled.
 */
const active = computed(() =>
  Math.min(voices.length - 1, Math.max(0, Math.floor((p.value - TITLE_END) / SLICE))));

/** How far through the current quote the reading has got, 0 to 1. */
const through = computed(() =>
  clamp01((p.value - TITLE_END - active.value * SLICE) / SLICE));

/**
 * Words, pre-split once, so the highlight is an index lookup per frame.
 *
 * The separating space has to be rendered inside the interpolation, not as
 * literal whitespace before the closing tag: Vue condenses whitespace between
 * elements out of the template, which ran every quote together into one
 * unbreakable string that could not wrap and overflowed the frame.
 */
const split = voices.map((v) => v.q.split(" "));

/**
 * A word's brightness.
 *
 * The reading runs a little ahead of itself — the leading edge covers about a
 * fifth of the quote, so a few words are always part-lit in front of the ones
 * already read. A hard edge would read as a wipe; this reads as someone's eye
 * moving along the line.
 */
const lit = (index: number, total: number) => {
  // Reading occupies the first three quarters of the slice; the rest is the
  // pause on a finished quote before it hands over.
  const head = clamp01(through.value / 0.75) * (total + total * 0.18);
  return 0.26 + clamp01((head - index) / (total * 0.18)) * 0.74;
};

/**
 * Where a quote sits in the frame.
 *
 * One at a time, held in the middle. The quotes used to run side by side with
 * the next one shrunk into the right half, which put the thing being read off
 * the centre line of a section that has nothing else in it — and asked the eye
 * to hold two paragraphs at once. They hand over vertically now: the one being
 * read leaves upward and the next rises into the same place.
 */
const place = (i: number) => {
  if (i === active.value) {
    return { opacity: 1, transform: "translate3d(0, 0, 0)", zIndex: 2 };
  }
  const gone = i < active.value;
  return {
    opacity: 0,
    transform: `translate3d(0, ${gone ? -7 : 7}vh, 0)`,
    zIndex: 0,
    pointerEvents: "none" as const,
  };
};

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) { p.value = TITLE_END + SLICE * 0.7; return; }
  trigger = scrubThrough(root.value, (v) => (p.value = v), {
    start: "top top",
    end: "bottom bottom",
  });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="perspectives" ref="root" class="pv">
    <div class="pv__stage">
      <div class="pv__wash" aria-hidden="true" />

      <!-- Beat one: the title, centred, clearing as the first quote arrives. -->
      <div
        class="pv__title"
        :style="{
          opacity: 1 - beat(TITLE_END * 0.55, TITLE_END),
          transform: `translate3d(0, ${-beat(TITLE_END * 0.55, TITLE_END) * 8}vh, 0)`,
        }"
      >
        <h2 class="pv__h">
          <span class="pv__mask"><span>Personal</span></span>
          <span class="pv__mask"><span>Perspectives</span></span>
        </h2>
        <p class="pv__intro">
          <span v-for="(line, i) in intro" :key="i" class="pv__mask"><span>{{ line }}</span></span>
        </p>
      </div>

      <!-- Beat two: the quotes, one lit and the next one waiting. -->
      <div class="pv__deck" :style="{ opacity: beat(TITLE_END * 0.7, TITLE_END + 0.06) }">
        <figure
          v-for="(v, i) in voices"
          :key="i"
          class="pv__quote"
          :class="{ 'is-live': i === active }"
          :style="place(i)"
        >
          <blockquote class="pv__words" :aria-label="v.q">
            <span
              v-for="(w, j) in split[i]"
              :key="j"
              aria-hidden="true"
              :style="i === active ? { opacity: lit(j, split[i].length) } : undefined"
            >{{ `${w} ` }}</span>
          </blockquote>
          <figcaption class="pv__who">
            <span class="pv__name">{{ v.who }}</span>
            <span class="pv__what">{{ v.what }}</span>
          </figcaption>
        </figure>
      </div>

      <p class="pv__marker">{{ active + 1 }} / {{ voices.length }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// One viewport per quote, plus one for the title to hold on.
.pv {
  position: relative;
  height: 420vh;
  height: calc(var(--vh, 1vh) * 420);
}

.pv__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
  display: grid;
  place-items: center;
  padding: 0 var(--gutter);
}

// The same ground the principles stand on, carried across so the two read as
// one movement rather than two panels that happen to be adjacent. Locked to
// the stage rather than the section, which is already the case here.
.pv__wash {
  // Translucent on purpose. The dark ground of this page is the shared
  // ShaderGradient field behind every section, not a gradient painted here —
  // these layers only shape the light falling across it. Given an opaque base
  // they would hide the field completely and the site would have a running
  // WebGL layer nobody ever sees.
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(180deg, rgb(var(--rgb-void) / 0.72) 0%, rgb(var(--rgb-void) / 0.38) 9%, transparent 21%),
    radial-gradient(50% 46% at 62% 104%, rgb(var(--rgb-accent) / 0.92) 0%, rgb(var(--rgb-accent) / 0.42) 40%, transparent 76%),
    radial-gradient(54% 44% at -6% 2%, #0A0206 0%, transparent 66%),
    linear-gradient(150deg, rgb(var(--rgb-ink) / 0.6) 6%, rgb(var(--rgb-deep) / 0.34) 42%, transparent 80%);
}

.pv__title {
  position: absolute;
  z-index: 2;
  width: min(52ch, 92vw);
  text-align: center;
  will-change: transform, opacity;
}

.pv__h {
  font-size: var(--t-h1);
  line-height: 1.04;
  letter-spacing: -0.03em;
  font-weight: 250;
  color: var(--c-bone);
}

.pv__intro {
  margin-top: clamp(1rem, 2.6vh, 1.8rem);
  font-size: var(--t-lead);
  line-height: 1.46;
  font-weight: 250;
  color: rgb(var(--rgb-bone) / 0.82);
}

.pv__mask {
  display: block;
  overflow: hidden;

  > span { display: block; }
}

.pv__deck {
  position: relative;
  z-index: 3;
  display: grid;
  place-items: center;
  width: min(100%, 74rem);
  height: min(58vh, 30rem);
}

// Every quote occupies the one centred box and is swapped within it, so the
// frame never shifts as the section hands from one voice to the next.
.pv__quote {
  grid-area: 1 / 1;
  // In rem, not ch. `ch` on this element resolves against the font-size it
  // inherits — the page's body size — not against the display size set on the
  // words inside it, which measured the column at barely a dozen characters a
  // line and stacked the quote seven lines deep.
  width: min(56rem, 100%);
  text-align: center;
  transition:
    opacity 0.8s var(--e-out-quart),
    transform 1s var(--e-out-expo);
  will-change: transform, opacity;
}

// A step larger than it was: one centred quote is the whole frame now, and at
// the old size it sat in the middle of a great deal of nothing.
.pv__words {
  font-size: clamp(1.3rem, 2.35vw, 2.35rem);
  line-height: 1.4;
  font-weight: 250;
  letter-spacing: -0.012em;
  color: var(--c-bone);

  // Each word carries its own brightness, so the transition has to be on the
  // word and not on the block, or the whole quote would cross-fade as one.
  > span { transition: opacity 0.5s var(--e-out-quart); }
}

.pv__who {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.75em;
  margin-top: clamp(1.6rem, 4.5vh, 2.8rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;

  &::before {
    content: "";
    width: 0.38em;
    height: 0.38em;
    border-radius: 50%;
    background: var(--c-accent);
    align-self: center;
  }
}

.pv__name { color: var(--c-bone); }
.pv__what { color: rgb(var(--rgb-bone) / 0.5); }

.pv__marker {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: clamp(1.6rem, 4.5vh, 2.8rem);
  z-index: 4;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  color: var(--c-accent);
  font-variant-numeric: tabular-nums;
}

// Under this width there is no room beside a quote for the next one to wait in,
// so it does not: the live quote takes the frame and the deck is its height.
@media (max-width: 60rem) {
  .pv__quote { width: 100%; }
  .pv__words { font-size: clamp(1.1rem, 4.6vw, 1.5rem); }
}

// Without motion the section is one quote, settled and fully lit.
@media (prefers-reduced-motion: reduce) {
  .pv { height: auto; }

  .pv__stage {
    position: relative;
    height: auto;
    padding: var(--stack) var(--gutter);
    gap: clamp(3rem, 9vh, 6rem);
  }

  .pv__title { position: relative; opacity: 1 !important; transform: none !important; }
  .pv__deck { height: auto; min-height: 24rem; opacity: 1 !important; }
  .pv__quote:not(.is-live) { display: none; }
  .pv__words > span { opacity: 1 !important; }
}
</style>
