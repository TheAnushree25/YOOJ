<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";
import SplitHeading from "../SplitHeading.vue";

const root = ref<HTMLElement | null>(null);
const path = ref<SVGPathElement | null>(null);
const lattice = ref<SVGGElement | null>(null);
const readout = ref(0);

let trigger: ReturnType<typeof scrubThrough> = null;

/**
 * A lattice of overlapping circles on a hexagonal pitch.
 *
 * Generated rather than drawn so the density follows one number: the radius is
 * the pitch, which is what makes neighbouring circles meet at each other's
 * centres and produces the lens shapes between them.
 */
const R = 132;
const circles = (() => {
  const out: Array<{ cx: number; cy: number; r: number; i: number }> = [];
  const rows = 4;
  const cols = 5;
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      out.push({
        cx: 300 + col * R + (row % 2 ? R / 2 : 0),
        cy: 260 + row * R * 0.866,
        r: R,
        i: i++,
      });
    }
  }
  return out;
})();

/**
 * One continuous stroke that answers the lattice: two opposed arcs meeting at
 * the centre, so the eye reads a single gesture crossing a rigid grid. Written
 * as a path rather than two, because it is drawn by one dash offset.
 */
const CURVE =
  "M 352 250 C 352 132, 560 132, 560 250 C 560 368, 768 368, 768 250 " +
  "C 768 132, 976 132, 976 250 C 976 368, 768 486, 616 486";

const draw = (p: number) => {
  readout.value = p;

  if (path.value) {
    const len = path.value.getTotalLength();
    // The stroke is revealed by retreating its own dash offset, which is what
    // makes it look drawn rather than wiped.
    path.value.style.strokeDasharray = `${len}`;
    path.value.style.strokeDashoffset = `${len * (1 - p)}`;
  }

  if (lattice.value) {
    // The lattice arrives behind the stroke, each ring a little later than the
    // last, so the grid assembles rather than switching on.
    const nodes = lattice.value.children;
    for (let i = 0; i < nodes.length; i++) {
      const local = Math.min(1, Math.max(0, (p - i * 0.012) * 3.4));
      (nodes[i] as SVGElement).style.opacity = String(local * 0.34);
      (nodes[i] as SVGElement).style.transform = `scale(${0.86 + local * 0.14})`;
    }
  }
};

onMounted(() => {
  draw(prefersReduced() ? 1 : 0);
  if (!root.value || prefersReduced()) return;
  // Drawn across the section's own travel, so the stroke completes about the
  // time the copy beside it has been read.
  trigger = scrubThrough(root.value, draw);
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="field" ref="root" class="section field">
    <div class="field__inner">
      <div class="field__copy">
        <SplitHeading
          as="p"
          class="label"
          mode="chars"
          :lines="['Beyond a single reading']"
          :rise="14"
        />
        <SplitHeading
          as="p"
          class="h2 field__lede"
          mode="lines"
          :lines="['A week has a shape.', 'We trace it, rather', 'than sampling one', 'point and calling', 'it a diagnosis.']"
        />
        <p class="field__meter">
          <span class="field__meter-bar"><i :style="{ transform: `scaleX(${readout})` }" /></span>
          <span class="field__meter-num">{{ String(Math.round(readout * 100)).padStart(3, "0") }}</span>
        </p>
      </div>

      <div class="field__art">
        <svg viewBox="0 0 1280 760" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <g ref="lattice" class="field__lattice">
            <circle
              v-for="c in circles"
              :key="c.i"
              :cx="c.cx"
              :cy="c.cy"
              :r="c.r"
              :style="{ transformOrigin: `${c.cx}px ${c.cy}px` }"
            />
          </g>
          <path ref="path" class="field__curve" :d="CURVE" />
        </svg>
        <span class="field__tag field__tag--a">Signal</span>
        <span class="field__tag field__tag--b">Baseline</span>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.field {
  position: relative;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  display: grid;
  align-items: center;
  overflow: hidden;
}

.field__inner {
  position: relative;
  width: 100%;
  max-width: 96rem;
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.field__copy {
  position: relative;
  z-index: 2;
  display: grid;
  gap: clamp(1rem, 2.6vh, 1.6rem);
  max-width: 30ch;
}

.field__lede { font-weight: 300; }

.field__meter {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.6rem;
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  color: var(--c-accent);
}

.field__meter-bar {
  position: relative;
  display: block;
  width: clamp(4rem, 12vw, 9rem);
  height: 1px;
  background: var(--c-bone-faint);

  i {
    position: absolute;
    inset: 0;
    background: var(--c-accent);
    transform-origin: left center;
  }
}

.field__meter-num { font-variant-numeric: tabular-nums; }

.field__art {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  pointer-events: none;

  svg { width: 100%; height: 100%; overflow: visible; }
}

.field__lattice circle {
  fill: none;
  stroke: var(--c-bone);
  stroke-width: 0.75;
  opacity: 0;
  will-change: opacity, transform;
}

.field__curve {
  fill: none;
  stroke: var(--c-bone);
  stroke-width: 2;
  stroke-linecap: round;
  will-change: stroke-dashoffset;
}

.field__tag {
  position: absolute;
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--c-bone-dim);

  &--a { top: 26%; right: 22%; }
  &--b { bottom: 30%; right: 34%; }
}

@media (max-width: 62rem) {
  .field__art { opacity: 0.5; }
  .field__tag { display: none; }
}
</style>
