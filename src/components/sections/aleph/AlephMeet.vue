<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";

/**
 * The page opens on the mark, the line, and the title - in that order.
 *
 * Three beats in one held frame. First the logo alone, enormous, drawn in a
 * tint a shade off the ground it sits on — at that weight it is a watermark the
 * page is printed on rather than a graphic placed on it, which is what lets a
 * single shape hold a whole viewport without looking like a splash screen.
 * Then the line falls from the mark's right-hand disc - the tube of the
 * stethoscope the mark is drawn as - and curves in to the centre of the frame.
 * Then the title rises exactly where the line ends.
 *
 * The three are one rig and travel as one. The title used to be the next
 * section's, and the line ended half a screen above it: the two stages were
 * held separately, so the gap between them was whatever the hand-over left.
 * Laid out together, the distance from the end of the line to the title is a
 * measurement rather than an accident, and it is small.
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

const title = ["Your care,", "mapped."] as const;

/** Each line of the title rises out of its own mask, the second on the first's heels. */
const rise = (i: number) => 1 - beat(0.52 + i * 0.06, 0.7 + i * 0.06);

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
  if (prefersReduced()) { p.value = 1; return; }
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
      <!-- The rig: mark, line and title, laid out against one another and
           carried up the frame together as the reader arrives at the title. -->
      <div class="me__rig" :style="{ '--k': beat(0.24, 0.68).toFixed(4) }">
        <!-- Beat one: the mark, alone. It settles out of a slow push-in, then
             thins as the title takes the frame — never leaving, because the
             title is set against it. -->
        <div
          class="me__mark"
          aria-hidden="true"
          v-html="art"
          :style="{
            transform: `scale(${(1.06 - beat(0, 0.26) * 0.06).toFixed(4)})`,
            opacity: (0.5 + beat(0, 0.24) * 0.34 - beat(0.5, 0.82) * 0.28).toFixed(3),
          }"
        />

        <!-- Beat two: the line, drawn down from the disc and in to the centre.
             Revealed from the top rather than dashed: the path only ever
             descends, so uncovering it by height is drawing it along its
             length, at any stretch the frame gives it. -->
        <div
          class="me__thread"
          aria-hidden="true"
          :style="{ clipPath: `inset(0 -4px ${((1 - beat(0.28, 0.58)) * 100).toFixed(2)}% -4px)` }"
        >
          <svg viewBox="0 0 100 1000" preserveAspectRatio="none" focusable="false">
            <path d="M 0.5 0 V 500 C 0.5 790 99.5 720 99.5 1000" />
          </svg>
        </div>

        <!-- Where the line lands: one point of the page's one saturated ink. -->
        <span
          class="me__drop"
          aria-hidden="true"
          :style="{ transform: `translate(-50%, -50%) scale(${beat(0.56, 0.62).toFixed(3)})` }"
        />

        <!-- Beat three: the title, rising where the line ends. -->
        <h1 class="me__title" :aria-label="title.join(' ')">
          <span v-for="(line, i) in title" :key="line" class="me__line" aria-hidden="true">
            <span :style="{ transform: `translate3d(0, ${(rise(i) * 108).toFixed(2)}%, 0)` }">{{ line }}</span>
          </span>
        </h1>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../../styles/media" as *;

// Two and a half viewports: one for the mark to hold on its own, one for the
// line to fall and the title to rise, and a last stretch for the three to
// stand together before the stage lets go.
.me {
  position: relative;
  height: 250vh;
  height: calc(var(--sv) * 250);
}

/**
 * The frame, and the rig's measurements.
 *
 * Everything in the rig is placed in fractions of the mark's own side, so the
 * line always leaves the same disc and always lands the same distance above
 * the title, whatever size the frame makes the mark.
 *
 * `--pan` is how far the rig climbs: from the mark centred on `--mark-y`, to
 * the title centred on `--title-y`. The title's centre in the rig is its top
 * (76% of the side) plus one line, since it is two lines at a line-height of
 * one — which is where the 0.26 comes from.
 */
.me__stage {
  --side: min(calc(var(--vh, 1vh) * 74), 46rem);
  --title: calc(var(--ta-display) + 8px);
  --mark-y: 48;
  --title-y: 52;
  --pan: calc(var(--side) * 0.26 + var(--title) + (var(--mark-y) - var(--title-y)) * var(--vh, 1vh));

  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;

  // Upright: the mark sized off the width, and the title a little under the
  // middle. A tall screen has more height than the rig, and with the title on
  // the centre line the whole composition sat in the top half of the frame
  // over an empty foot.
  @media (max-width: 60rem) {
    --side: min(92vw, 30rem);
    --mark-y: 42;
    --title-y: 57;
  }
}

.me__rig {
  position: absolute;
  left: 50%;
  top: calc(var(--mark-y) * 1%);
  width: var(--side);
  aspect-ratio: 1;
  translate: -50% -50%;
  transform: translate3d(0, calc(var(--k, 0) * var(--pan) * -1), 0);
  will-change: transform;
}

// Sized against the shorter edge so it is the same shape of gesture on a
// laptop and on a wide desktop, and so the two accent discs never crop off
// the side of the frame.
.me__mark {
  position: absolute;
  inset: 0;
  z-index: 0;
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
}

/**
 * The line: from under the right-hand disc to the centre of the frame.
 *
 * The disc is centred at 1029.6 / 2800 of the artwork across and 858 / 2800
 * down, with a radius of 144.5 — so it ends at 35.8% of the side. The line
 * starts a hair below that, runs straight down, and turns in to land on the
 * centre line pointing straight down at the title.
 */
.me__thread {
  position: absolute;
  left: 36.77%;
  top: 37%;
  z-index: 1;
  width: 13.23%;
  height: 36%;
  pointer-events: none;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  path {
    fill: none;
    stroke: rgb(60 1 14 / 0.34);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

// The end of the line, where it meets the title.
.me__drop {
  position: absolute;
  left: 50%;
  top: 73%;
  z-index: 2;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--ga-dot);
  transform: translate(-50%, -50%) scale(0);
}

// 88px at 1440: the page's display step, eight pixels up. Three and a bit
// percent of the side under the end of the line, which with the leading above
// a capital puts about thirty pixels of blush between the two at 1440.
.me__title {
  position: absolute;
  left: 50%;
  top: 76%;
  z-index: 2;
  width: max-content;
  max-width: calc(100vw - var(--gutter) * 2);
  translate: -50% 0;
  margin: 0;
  font-size: var(--title);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
  text-align: center;
  color: var(--ga-ink);
}

/**
 * One mask per line.
 *
 * Padded below and pulled back by the same amount, so the mask is the line's
 * own box to the layout and deep enough for a descender to the eye: at a
 * line-height of one, the tails of the p's in "mapped" hang past the line.
 */
.me__line {
  display: block;
  overflow: hidden;
  padding-block: 0.04em 0.18em;
  margin-block: -0.04em -0.18em;

  > span {
    display: block;
    will-change: transform;
  }
}

// A phone on its side: sized off the height again, as a desktop is. The
// handheld rule sizes the mark off the width, which on a frame 390px tall is
// a mark taller than the screen and a line starting above it.
@include short {
  .me__stage {
    --side: calc(var(--vh, 1vh) * 62);
    --mark-y: 50;
    --title-y: 62;
  }
}

// Without motion the page is one settled frame: the mark, the line, and the
// title under it.
@media (prefers-reduced-motion: reduce) {
  .me { height: auto; }

  .me__stage {
    position: relative;
    height: auto;
    min-height: 100vh;
  }
}
</style>
