<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { onDark } from "../../../lib/session";

/**
 * Where the page comes back.
 *
 * The corridor above is a held frame, ten viewports of it, and the reader
 * spends the whole of it watching one thing while statements pass through. This
 * is the release: ordinary flow, ordinary scrolling, a white page. The light
 * that floods the end of the corridor is this section's ground arriving early —
 * so by the time the sticky stage lets go there is nothing to hand over, the
 * page is already the colour it is about to become.
 *
 * Set in the page's own ink rather than in white, because the ground has
 * changed sides and everything on it has to change with it.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

const lines = ["One network.", "One patient journey."] as const;

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) {
    p.value = 1;
    onDark.value = false;
    return;
  }
  trigger = scrubThrough(root.value, (v) => {
    p.value = v;
    // The chrome changes sides here and nowhere else — this is the first thing
    // on the page standing on a light ground since the room went dark.
    onDark.value = false;
  }, { start: "top 92%", end: "bottom bottom" });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="aleph-found" ref="root" class="fo ground-drift">
    <h2 class="fo__say">
      <span
        v-for="(line, i) in lines"
        :key="i"
        :style="{
          opacity: beat(0.04 + i * 0.05, 0.2 + i * 0.05),
          transform: `translate3d(0, ${((1 - beat(0.04 + i * 0.05, 0.22 + i * 0.05)) * 1.1).toFixed(2)}rem, 0)`,
        }"
      >{{ line }}</span>
    </h2>

    <p class="fo__label" :style="{ opacity: beat(0.2, 0.34) }">Clinic + Pharmacy + Diagnostics + JeevanBhar</p>

    <p
      class="fo__copy"
      :style="{
        opacity: beat(0.24, 0.4),
        transform: `translate3d(0, ${((1 - beat(0.24, 0.42)) * 1).toFixed(2)}rem, 0)`,
      }"
    >
      Care happens locally. The infrastructure works together. The patient’s
      journey stays connected.
    </p>
  </section>
</template>

<style scoped lang="scss">
// The white the corridor resolves into. Painted here as well as at the end of
// that section, so the two agree exactly at the seam.
.fo {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: clamp(1.6rem, 4vh, 2.8rem);
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  padding: var(--stack) var(--gutter);
  // A light in it, not just a ramp. A plain vertical gradient has almost
  // nothing to move when the ground drifts — measured, it shifted by a single
  // channel step over ten seconds, which is a page that technically animates
  // and visibly does not. The radial gives the drift something to carry.
  background:
    radial-gradient(58% 46% at 46% 38%, #FFFFFF 0%, rgba(255, 245, 246, 0.6) 46%, transparent 78%),
    linear-gradient(180deg, #FFF5F6 0%, #FFEFF0 56%, #FEC9CD 100%);
  // Declared here, beside the shorthand, and not in the drift class.
  // `background:` resets `background-size` to auto, and a scoped rule outranks
  // an unscoped one — so the size set on .ground-drift was being thrown away
  // and a gradient exactly the size of its own box has nowhere to move to. The
  // position animated correctly and nothing on screen changed.
  background-size: 190% 190%;
  text-align: center;
  color: var(--ga-ink);
}

// 80 / 80 at -2px — the page's display step, broken over three lines because
// the reference does, and because three short lines centred read as a verdict
// where one long one reads as a sentence.
.fo__say {
  display: grid;
  margin: 0;
  font-size: var(--ta-display);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;

  span {
    display: block;
    will-change: transform, opacity;
  }
}

.fo__label {
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
  margin: 0;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--ga-dot);
  }
}

// 20 / 28 at the reference's own measure.
.fo__copy {
  max-width: 22rem;
  margin: 0;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .fo__say span,
  .fo__label,
  .fo__copy {
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
