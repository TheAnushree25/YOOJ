<script setup lang="ts">
import { onMounted, ref } from "vue";
import { SEED_FIELD, SEED_INK, SEED_RINGS } from "../../lib/seed";
import { preloadSound, startAmbient } from "../../lib/sound";

const emit = defineEmits<{ enter: [] }>();

/**
 * Something the page behind the gate needs before it can be shown — on the
 * front page, the hero's subject, decoded. The gate does not open until it
 * has settled, within a ceiling.
 */
const props = defineProps<{ waitFor?: Promise<unknown> | null }>();

const ready = ref(false);
const leaving = ref(false);
const opened = ref(false);
const pct = ref(0);


// A real gate, not a fake timer: it waits on the browser's own load event and
// on the fonts, because those are what actually cause the first paint to jump.
// The counter is eased toward the truth so it never stalls on a long asset.
onMounted(async () => {
  let target = 0;

  // The bed is fetched and decoded now, so the press below has nothing to
  // wait for. See lib/sound.
  preloadSound();

  // The rings fan out on their own clock, starting the moment the gate exists.
  // It is a loading screen: the figure has to be doing something before the
  // page is ready, or the wait reads as a hang.
  requestAnimationFrame(() => { opened.value = true; });

  /**
   * Readiness is decided by the load signals themselves, never by the animation
   * that displays them. An earlier cut flipped `ready` inside a
   * requestAnimationFrame loop, and rAF is paused in a background tab — so a
   * page opened in one and returned to later sat on a dead counter with
   * nothing to press. The number is decoration; the gate is not.
   */
  const bump = (value: number) => {
    target = Math.max(target, value);
    if (target >= 100) ready.value = true;
  };

  // Eased purely for looks, and it stops as soon as it has arrived.
  const settle = () => {
    pct.value += (target - pct.value) * 0.12;
    if (pct.value > 99.2) { pct.value = 100; return; }
    requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);

  bump(18);
  try { await document.fonts.ready; } catch { /* fonts are a nicety, not a gate */ }
  bump(64);

  /**
   * Whatever the page behind the gate has said it needs. A gate that opened
   * before the hero's subject had arrived put the reader on a hero with a
   * hole in it for a second, which is the one thing a loading screen exists
   * to prevent. Ceilinged, so a stalled fetch cannot trap anyone.
   */
  if (props.waitFor) {
    await Promise.race([
      props.waitFor.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
  }
  bump(84);

  if (document.readyState === "complete") bump(100);
  else window.addEventListener("load", () => bump(100), { once: true });

  // A hard ceiling so a stalled third-party request can never trap the reader
  // behind the gate. `setTimeout` keeps running where rAF does not. Counted
  // from here — after the page's own wait — not from mount.
  setTimeout(() => bump(100), 500);
});

const enter = () => {
  if (!ready.value || leaving.value) return;
  leaving.value = true;
  // Inside the press, which is what lets the sound start at all. The bed
  // rises over the same seconds the gate takes to leave.
  void startAmbient();
  setTimeout(() => emit("enter"), 900);
};
</script>

<template>
  <div class="sg ground-drift" :class="{ 'is-leaving': leaving }">
    <div class="sg__field">
      <svg
        class="sg__seed"
        :viewBox="`0 0 ${SEED_FIELD.w} ${SEED_FIELD.h}`"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          v-for="(o, i) in SEED_RINGS.slice(1)"
          :key="i"
          :cx="SEED_FIELD.cx"
          :cy="SEED_FIELD.cy"
          :r="SEED_FIELD.r"
          :style="{
            transform: opened ? `translate(${o[0]}px, ${o[1]}px)` : 'translate(0px, 0px)',
            opacity: opened ? SEED_INK : 0,
            transitionDelay: `${0.08 + i * 0.07}s`,
          }"
        />
      </svg>

      <button
        class="sg__enter"
        :class="{ 'is-ready': ready }"
        :disabled="!ready"
        data-cursor="scale"
        @click="enter"
      >
        <span class="sg__label">{{ ready ? "Click to enter" : `${Math.round(pct)}` }}</span>
      </button>
    </div>

    <p class="sg__word">A cognitive wellbeing lab</p>
  </div>
</template>

<style scoped lang="scss">
// The site's dark ground, and nothing else — the one screen with no content
// on it, so the ground is the whole composition.
.sg {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: var(--ground-dark);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
  transition: opacity 0.85s var(--e-in-out-quart), visibility 0.85s;

  &.is-leaving {
    opacity: 0;
    visibility: hidden;
  }
}

// Sized off the height as much as the width: the pattern is nearly square, and
// keyed to width alone it runs off the bottom of a laptop screen.
.sg__field {
  position: relative;
  display: grid;
  place-items: center;
  width: min(58vw, 99vh, 58rem);
  aspect-ratio: 672 / 655; // SEED_FIELD.w / SEED_FIELD.h
}

.sg__seed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;

  // Faint, and deliberately fainter than the ring at the middle. The figure is
  // a ground for the control, not a competitor to it: struck at full strength
  // the eight satellites read as the subject and the one thing on the screen
  // that can be pressed disappeared into them.
  circle {
    fill: none;
    stroke: var(--c-bone);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    opacity: 0;
    // Struck from the centre and carried out to their places. The transform
    // box has to be the view box or a percentage origin would resolve against
    // each circle's own bounds and the whole figure would scatter.
    transform-box: view-box;
    transform-origin: center;
    transition:
      transform 1.9s var(--e-out-expo),
      opacity 1.5s var(--e-out-quart);
  }
}

// The one ring that does not travel: it is the control, and the figure opens
// out of it. Sized as the same radius as the rest, in the same proportion.
.sg__enter {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  // 244 of the field's 672 — the same ring as every other, drawn as a
  // control. See SEED_HUB_PCT.
  width: 36.3%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-bone) / 0.55);
  transition:
    border-color 0.6s var(--e-out-quart),
    background-color 0.6s var(--e-out-quart),
    transform 0.6s var(--e-out-quart);

  &.is-ready {
    border-color: var(--c-bone);
    box-shadow: 0 0 0 0.5px rgb(var(--rgb-bone) / 0.55);
    &:hover { background: rgb(var(--rgb-bone) / 0.07); transform: scale(1.02); }
  }

  &:disabled { cursor: default; }
}

.sg__label {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-bone);
  font-variant-numeric: tabular-nums;
  // The word and the number swap in the same place; without this the count
  // jumps as it passes each power of ten.
  text-indent: 0.3em;
}

.sg__word {
  position: absolute;
  bottom: clamp(1.5rem, 5vh, 3rem);
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-bone-dim);
}

// The figure is the loading screen; without motion it is simply already open.
@media (prefers-reduced-motion: reduce) {
  .sg__seed circle { transition: none; }
}
</style>
