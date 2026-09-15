<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";

/**
 * The page opens on the mark, and on nothing else.
 *
 * Two beats in one held frame. First the logo alone, enormous, drawn in a tint
 * a shade off the ground it sits on — at that weight it is a watermark the
 * page is printed on rather than a graphic placed on it, which is what lets a
 * single shape hold a whole viewport without looking like a splash screen.
 * Then one scroll brings the statement up into the frame beneath it.
 *
 * The artwork is fetched rather than retyped, from the same file the corridor
 * flies the reader through later in the page. One drawing on disk, two very
 * different uses of it: replacing the file replaces both.
 *
 * Sticky stage rather than a pinned ScrollTrigger, for the reason recorded
 * across the rest of the site: a pinned element becomes `fixed`, reports an
 * offset of zero, and re-measures its own start as the top of the document on
 * any refresh landing while the pin is applied.
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

/** The artwork, inlined so the stylesheet can recolour it. */
const art = ref("");

onMounted(async () => {
  // Presentation attributes lose to CSS, so the mint the file is drawn in is
  // overridden by the rules below without touching the artwork.
  try {
    const res = await fetch("/aleph/mark.svg");
    if (res.ok) art.value = await res.text();
  } catch {
    // A missing mark costs the watermark, not the section.
  }

  if (!root.value) return;
  if (prefersReduced()) { p.value = 0.6; return; }
  trigger = scrubThrough(root.value, (v) => (p.value = v), {
    start: "top top",
    end: "bottom bottom",
  });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="aleph-meet" ref="root" class="me">
    <div class="me__stage">
      <!-- Beat one: the mark, alone. It settles out of a slow push-in, then
           drifts up and thins as the statement takes the frame — never leaving,
           because the statement is set against it. -->
      <div
        class="me__mark"
        aria-hidden="true"
        v-html="art"
        :style="{
          transform: `translate3d(0, ${-beat(0.34, 1) * 14}vh, 0) scale(${1.06 - beat(0, 0.34) * 0.06})`,
          opacity: 0.5 + beat(0, 0.26) * 0.34 - beat(0.45, 0.95) * 0.34,
        }"
      />

      <!-- Beat two: the statement, arriving from below on the first scroll. -->
      <div
        class="me__say"
        :style="{
          opacity: beat(0.4, 0.62),
          transform: `translate3d(0, ${(1 - beat(0.38, 0.72)) * 14}vh, 0)`,
        }"
      >
        <p class="me__label">Meet YOOJ</p>
        <p class="me__copy">{{ statement }}</p>
      </div>

      <!-- The thread, falling past the block and curving away under it. -->
      <svg class="me__thread" viewBox="0 0 90 560" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M 2 0 L 2 372 C 2 470 88 486 88 560"
          :style="{ strokeDashoffset: (1 - beat(0.44, 0.82)) * 700 }"
        />
      </svg>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Two viewports: one for the mark to hold on its own, one for the statement to
// arrive in. Any shorter and the logo is a flash on the way past.
.me {
  position: relative;
  height: 220vh;
  height: calc(var(--sv) * 220);
}

.me__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
}

// Centred and very large. Sized against the shorter edge so it is the same
// shape of gesture on a laptop and on a wide desktop, and so the two accent
// discs never crop off the side of the frame.
.me__mark {
  position: absolute;
  left: 50%;
  top: 48%;
  z-index: 0;
  width: min(74vh, 46rem);
  aspect-ratio: 1;
  translate: -50% -50%;
  will-change: transform, opacity;

  :deep(svg) { width: 100%; height: 100%; display: block; }

  // The artwork ships in mint. On this ground it wants to be the ground —
  // a shade lighter than the blush behind it, which is what makes it read as
  // printed rather than placed.
  :deep(path) {
    fill: #FFFFFF;
    stroke: #FFFFFF;
  }

  // The two discs keep a little of the brand's rose, so the mark is not a
  // single flat silhouette.
  :deep(circle) { fill: #FEC9CD; }

  @media (max-width: 60rem) {
    width: min(92vw, 30rem);
    top: 42%;
  }
}

// At the centre line, which is where the reference sets it: the left half of
// the frame is left empty on purpose, and the emptiness is the composition.
.me__say {
  position: absolute;
  left: 50.7%;
  top: 50%;
  margin-top: -6vh;
  z-index: 2;
  width: min(26rem, 36vw);
  will-change: transform, opacity;

  @media (max-width: 60rem) {
    left: var(--gutter);
    right: var(--gutter);
    top: auto;
    bottom: clamp(4rem, 14vh, 9rem);
    margin-top: 0;
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

// Without motion the page is one settled frame: the mark, and the statement
// already standing on it.
@media (prefers-reduced-motion: reduce) {
  .me { height: auto; }

  .me__stage {
    position: relative;
    height: auto;
    min-height: 100vh;
  }

  .me__mark { transform: none !important; opacity: 0.5 !important; }
  .me__say { opacity: 1 !important; transform: none !important; }
}
</style>
