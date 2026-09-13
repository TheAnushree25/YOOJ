<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { Backdrop } from "../webgl/Backdrop";
import { usePointer } from "../composables/usePointer";
import { useSmoothScroll } from "../composables/useSmoothScroll";
import AlephHero from "../components/sections/aleph/AlephHero.vue";
import AlephMeet from "../components/sections/aleph/AlephMeet.vue";
import AlephCard from "../components/sections/aleph/AlephCard.vue";
import AlephQuantum from "../components/sections/aleph/AlephQuantum.vue";
import AlephFound from "../components/sections/aleph/AlephFound.vue";
import AlephAccess from "../components/sections/aleph/AlephAccess.vue";
import { onDark } from "../lib/session";

/**
 * Aleph: the pale page.
 *
 * The same field as the front page and the same scroll engine — only the
 * palette and the tuning differ, which is why the shader takes them as
 * arguments. A second shader would have been two things to keep in step.
 *
 * The ground is lit rather than dark, so everything on it is set in one ink
 * and the only saturated mark on the page is the waveform in a question card.
 */

const canvas = ref<HTMLCanvasElement | null>(null);
const { progress, mount } = useSmoothScroll();
const { x, y } = usePointer();

let backdrop: Backdrop | null = null;

onMounted(() => {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);

  if (canvas.value) {
    backdrop = new Backdrop(canvas.value, {
      prefix: "--ga",
      fallback: ["#FEB3B8", "#FED2D5", "#FFF5F6", "#FEB3B8"],
      // Softer and slower than the front page's: a pale field has nowhere to
      // hide contrast, so the same strength that reads as folded silk in wine
      // reads as bruising here.
      amplitude: 1.9,
      density: 0.62,
      frequency: 2.4,
      speed: 0.26,
      strength: 1.7,
      brightness: 1.04,
      reflection: 0.03,
      shade: 0.93,
      rotation: 28,
      offset: [-0.8, 0.2],
    });
    backdrop.start();
    window.addEventListener("resize", backdrop.resize);
  }

  mount();
});

onBeforeUnmount(() => {
  if (backdrop) window.removeEventListener("resize", backdrop.resize);
  backdrop?.dispose();
});

// The field answers the pointer and the reader's travel, as it does elsewhere.
const track = () => backdrop?.setPointer(x.value, y.value);
const advance = () => backdrop?.setProgress(progress.value);
</script>

<template>
  <div class="al" :class="{ 'is-night': onDark }" @pointermove="track" @scroll.passive="advance">
    <div class="al__field"><canvas ref="canvas" /></div>

    <header class="al__head">
      <RouterLink class="al__mark" to="/" data-cursor="scale">YOOJ</RouterLink>
      <div class="al__meta">
        <span class="al__rule" aria-hidden="true" />
        <span class="al__here">Aleph</span>
        <span class="al__dots" aria-hidden="true">
          <i v-for="n in 9" :key="n" />
        </span>
      </div>
    </header>

    <main class="al__content">
      <AlephMeet />
      <AlephHero />
      <AlephCard />
      <AlephQuantum />
      <AlephFound />
      <AlephAccess />
    </main>

    <p class="al__hint" :class="{ 'is-gone': progress > 0.02 }">Scroll to explore</p>
  </div>
</template>

<style scoped lang="scss">
.al {
  position: relative;
  min-height: 100vh;
  // The page's own ink, so a child does not have to restate it.
  color: var(--ga-ink);
}

// Fixed behind everything, exactly as the front page's is — the content
// scrolls over a field that never moves, which keeps the shader off the
// scroll's critical path.
.al__field {
  position: fixed;
  inset: 0;
  z-index: 0;

  canvas { width: 100%; height: 100%; }
}

.al__content {
  position: relative;
  z-index: 10;
  width: 100%;
}

/* --------------------------------------------------------------- the head */

// No difference blending here. That trick needs a ground that is clearly dark
// or clearly light, and this one is light everywhere — so the header is simply
// set in the page's ink, which is legible on it at every scroll position.
.al__head {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  padding: clamp(1.1rem, 2.4vw, 1.9rem) var(--gutter);
  pointer-events: none;

  > * { pointer-events: auto; }
}

// 14px at 4.3px tracking, centred — the reference's own logo spec.
.al__mark {
  grid-column: 2;
  justify-self: center;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: 0.875rem;
  letter-spacing: 0.307em;
  text-transform: uppercase;
  color: var(--ga-ink);
}

.al__meta {
  grid-column: 3;
  justify-self: end;
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0.55rem clamp(2rem, 5vw, 4.5rem);
}

.al__rule {
  grid-column: 1 / -1;
  height: 1px;
  background: rgb(60 1 14 / 0.3);
}

.al__here {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: var(--ga-ink);
}

// Three by three, the reference's menu affordance.
.al__dots {
  display: grid;
  grid-template-columns: repeat(3, 3px);
  gap: 4px;
  justify-self: end;

  i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgb(60 1 14 / 0.55);
  }
}

.al__hint {
  position: fixed;
  left: var(--gutter);
  bottom: clamp(1.5rem, 4.5vh, 2.6rem);
  z-index: 60;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: rgb(60 1 14 / 0.6);
  transition: opacity 0.6s var(--e-out-quart);

  &.is-gone { opacity: 0; }
}

/* ------------------------------------------------------------- the night */

// Two sections end on a dark room, and the header is fixed over both of them.
// Set in the page's ink it is navy on navy — not dimmed, absent. Difference
// blending is the usual answer and it is wrong here for the same reason it was
// wrong on the front page: it inverts the saturated cyan low in the frame into
// a muddy red. Changing sides outright is the only thing that is legible at
// every scroll position on both grounds.
.al.is-night {
  .al__mark,
  .al__here { color: #FFFFFF; }

  .al__rule { background: rgb(255 255 255 / 0.45); }

  .al__dots i { background: rgb(255 255 255 / 0.7); }

  .al__hint { opacity: 0; }
}

// Slow enough not to flicker on a scrub that crosses the threshold, fast
// enough that the header is never caught half-legible.
.al__mark,
.al__here,
.al__rule,
.al__dots i {
  transition: color 0.45s var(--e-out-quart), background-color 0.45s var(--e-out-quart);
}

</style>
