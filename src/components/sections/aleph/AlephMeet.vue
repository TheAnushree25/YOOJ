<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";

/**
 * The page opens on a statement, not on a headline.
 *
 * One paragraph set at the centre line, a label above it, and an enormous pale
 * letterform behind that is cropped by the top of the frame. The mark is the
 * only large thing on the screen and it is almost not there — at this weight
 * it reads as a watermark the page is printed on rather than as a graphic
 * placed on it, which is what lets a single paragraph hold a whole viewport.
 *
 * Ordinary flow, not a held stage. Nothing here is choreographed against a
 * timeline; the block simply scrolls, and the mark travels slower than it so
 * the two separate as they go.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

const statement =
  "A healthcare network built to work together. YOOJ brings qualified local "
  + "care, centralized diagnostics, medicine supply, patient records and network "
  + "infrastructure into one operating model.";

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) { p.value = 0.4; return; }
  trigger = scrubThrough(root.value, (v) => (p.value = v), {
    start: "top bottom",
    end: "bottom top",
  });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="aleph-meet" ref="root" class="me">
    <!-- The mark. Travels at two thirds of the reader's rate, which is the
         whole of the depth here — there is nothing else behind it. -->
    <svg
      class="me__mark"
      viewBox="0 0 620 420"
      aria-hidden="true"
      :style="{ transform: `translate3d(0, ${p * -18}vh, 0)` }"
    >
      <!-- A stroke and a ring, both cut by the top of the frame. Drawn rather
           than set as type: at this size a font's own hinting and its licence
           both become the page's problem. -->
      <path d="M 40 -60 C 40 130 96 250 186 286 L 186 300" />
      <ellipse cx="420" cy="120" rx="140" ry="210" />
    </svg>

    <div
      class="me__say"
      :style="{
        opacity: beat(0.12, 0.3),
        transform: `translate3d(0, ${(1 - beat(0.12, 0.32)) * 3}vh, 0)`,
      }"
    >
      <p class="me__label">Meet YOOJ</p>
      <p class="me__copy">{{ statement }}</p>
    </div>

    <!-- The thread, falling past the block and curving away under it. -->
    <svg class="me__thread" viewBox="0 0 90 560" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M 2 0 L 2 372 C 2 470 88 486 88 560"
        :style="{ strokeDashoffset: (1 - beat(0.16, 0.52)) * 700 }"
      />
    </svg>
  </section>
</template>

<style scoped lang="scss">
.me {
  position: relative;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
}

// Bled off the top, and wide enough to cross the middle of the frame. Cropping
// it is what makes the page feel larger than the window.
.me__mark {
  position: absolute;
  left: 50%;
  top: -14%;
  z-index: 0;
  width: min(46%, 42rem);
  margin-left: -24%;
  overflow: visible;
  will-change: transform;

  path, ellipse {
    fill: none;
    stroke: #FED9DC;
    stroke-width: 46;
    stroke-linecap: round;
    opacity: 0.5;
  }

  @media (max-width: 60rem) {
    width: 88%;
    margin-left: -44%;
    top: -8%;
  }
}

// At the centre line, which is where the reference sets it: the left half of
// the frame is left empty on purpose, and the emptiness is the composition.
.me__say {
  position: absolute;
  left: 50.7%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: min(26rem, 36vw);
  will-change: transform, opacity;

  @media (max-width: 60rem) {
    left: var(--gutter);
    right: var(--gutter);
    width: auto;
  }
}

.me__label {
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
  margin-bottom: clamp(1.6rem, 4.4vh, 2.8rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: var(--ga-ink);

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--ga-dot);
  }
}

// 20px / 28px, ragged right, 375px — the reference's own measure, which is
// what puts the line breaks where it puts them.
.me__copy {
  max-width: 23.5rem;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  color: var(--ga-ink);
}

.me__thread {
  position: absolute;
  left: 45.4%;
  top: 30%;
  z-index: 1;
  width: 6%;
  height: 62%;
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke: rgb(60 1 14 / 0.2);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 700;
  }

  @media (max-width: 60rem) { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .me__mark { transform: none !important; }
  .me__say { opacity: 1 !important; transform: translateY(-50%) !important; }
}
</style>
