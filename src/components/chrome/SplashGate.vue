<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { SEED_FIELD, SEED_INK, SEED_RINGS } from "../../lib/seed";
import { preloadSound, primeSound, startAmbient } from "../../lib/sound";
import BrandMark from "../ui/BrandMark.vue";

const emit = defineEmits<{ press: []; enter: [] }>();

/**
 * Something the page behind the gate needs before it can be shown — on the
 * front page, the hero's subject, decoded. The gate does not open until it
 * has settled, within a ceiling.
 */
const props = defineProps<{
  waitFor?: Promise<unknown> | null;
  /**
   * Keep the bed back. The press still wakes the sound device - that has to
   * happen inside a gesture - but the page starts the bed itself, later, when
   * whatever it plays first has finished. The front page's film.
   */
  holdSound?: boolean;
}>();

/**
 * What the gate asks for.
 *
 * "Click to enter" on a phone names an action the device does not have. The
 * question is whether a pointer can hover, not how wide the screen is - a
 * touch laptop gets "Tap" too, which is the right answer for it.
 */
const coarse =
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
const enterWord = coarse ? "Tap to enter" : "Click to enter";

const ready = ref(false);
const leaving = ref(false);
const opened = ref(false);
const pct = ref(0);
/** The count has reached a hundred; the word takes its place. */
const done = ref(false);

/**
 * How long the count takes to finish once the page is ready: quick, so the
 * reader is not kept waiting, and long enough that the last numbers are read
 * as a count rather than a jump.
 */
const FINISH_MS = 520;

let raf = 0;
let finishTimer = 0;
let readyTimer = 0;

onMounted(async () => {
  // The bed is fetched and decoded now, so the press below has nothing to
  // wait for. See lib/sound.
  preloadSound();

  // The rings fan out on their own clock, starting the moment the gate exists.
  // It is a loading screen: the figure has to be doing something before the
  // page is ready, or the wait reads as a hang.
  requestAnimationFrame(() => { opened.value = true; });

  /**
   * The count, on a clock of its own.
   *
   * It used to ease toward a target that jumped in steps, and the word replaced
   * it the moment the page was ready - wherever the count had got to. On a fast
   * load that was "17, 18, 19" and then "Click to enter". Now it climbs on a
   * curve that slows toward ninety and never stops while the page loads, and
   * once the page is ready it runs on to a hundred before the word arrives.
   */
  // Counted from the gate's first painted frame, not from its mount: the rest
  // of the page mounts behind it before anything is painted, and a clock
  // started earlier opened on a number the reader never saw climb.
  let born = 0;
  let loaded = 0;
  let from = 0;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

  const finish = () => {
    cancelAnimationFrame(raf);
    clearTimeout(finishTimer);
    pct.value = 100;
    if (done.value) return;
    done.value = true;
    // The word settles in before it can be pressed.
    readyTimer = window.setTimeout(() => { ready.value = true; }, 220);
  };

  const frame = () => {
    const now = performance.now();
    if (!born) born = now;
    if (!loaded) {
      pct.value = 90 * (1 - Math.exp(-(now - born) / 800));
    } else {
      const k = Math.min(1, Math.max(0, now - loaded) / FINISH_MS);
      pct.value = from + (100 - from) * easeOut(k);
      if (k >= 1) { finish(); return; }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  /**
   * Ready means what the first screen needs: the fonts, which move every line
   * when they land, and whatever the page behind the gate has said it needs -
   * on the front page, the hero's first frame, decoded. Not the window's
   * `load`, which waits on every image anywhere on the page, none of which the
   * reader can see from here. Ceilinged, so a stalled fetch cannot trap anyone.
   */
  await Promise.race([
    Promise.all([
      document.fonts?.ready.catch(() => {}),
      props.waitFor?.catch(() => {}),
    ]),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);

  loaded = performance.now();
  from = pct.value;

  // Readiness is decided by the load signals, never by the animation that
  // displays them: requestAnimationFrame does not run in a background tab, so
  // a timer finishes the count there, and the gate is open on return.
  finishTimer = window.setTimeout(finish, FINISH_MS + 300);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearTimeout(finishTimer);
  clearTimeout(readyTimer);
});

const enter = () => {
  if (!ready.value || leaving.value) return;
  leaving.value = true;
  // Announced at once, still inside the gesture: anything else that has to
  // begin in a press - the film, which a browser will only sound if the
  // reader started it - begins here.
  emit("press");
  // Inside the press, which is what lets the sound start at all. The bed
  // rises over the same seconds the gate takes to leave - unless the page has
  // asked for it held, in which case only the device is woken here.
  if (props.holdSound) primeSound();
  else void startAmbient();
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
        :aria-label="ready ? enterWord : 'Loading'"
        :aria-busy="!ready"
        data-cursor="scale"
        @click="enter"
      >
        <span class="sg__label" :class="{ 'is-done': done }" aria-hidden="true">
          <span class="sg__count">{{ Math.round(pct) }}</span>
          <span class="sg__word">{{ enterWord }}</span>
        </span>
      </button>
    </div>

    <!-- Who is behind the gate: the lockup, mark and name, the same pair the
         header carries. It arrives just behind the rings, so the figure opens
         first and then says whose it is. -->
    <p class="sg__brand" :class="{ 'is-open': opened }">
      <BrandMark class="sg__glyph" />
      <span class="sg__name">YOOJ</span>
    </p>
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

  /**
   * On a phone, the whole screen.
   *
   * 58vw is a figure measured for a frame that is wider than it is tall. On a
   * portrait screen the same rule drew a small badge adrift in a large empty
   * field - the one screen on the site with nothing else on it, and the least
   * was being made of it. Keyed to the long axis instead and allowed past the
   * edges, the pattern becomes the screen, which is what a gate should be.
   */
  /**
   * Handheld: as large as the frame will hold it, and no larger.
   *
   * At 116vw the figure was wider than the screen, and a grid item wider than
   * its area is not centred - the engine clamps it to the start edge, so the
   * pattern sat 31px right of centre with its left petals cut and clear ground
   * on the right. Kept inside the frame it centres on its own.
   */
  @media (max-width: 60rem) {
    width: min(96vw, 76vh);
  }
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
  display: grid;
  place-items: center;
  overflow: hidden;

  // One cell, the count and the word in it: the count lifts away as it
  // reaches a hundred, and the word rises into its place.
  > span {
    grid-area: 1 / 1;
    transition:
      opacity 0.45s var(--e-out-quart),
      transform 0.7s var(--e-out-expo);
  }
}

.sg__word {
  opacity: 0;
  transform: translate3d(0, 0.9em, 0);
}

.sg__label.is-done {
  .sg__count {
    opacity: 0;
    transform: translate3d(0, -0.9em, 0);
  }

  .sg__word {
    opacity: 1;
    transform: none;
    transition-delay: 0.08s;
  }
}

/**
 * The lockup, where the strapline used to stand.
 *
 * Set as the hero sets it — Montserrat semibold, tracked, the mark a little
 * taller than the capitals — and in the bone of the rings rather than a dimmed
 * tint: this is a signature, not a caption. It comes in with the figure,
 * half a second behind the first ring, and settles its tracking as it does,
 * which is the one gesture here that is about the name rather than the load.
 */
.sg__brand {
  position: absolute;
  bottom: max(clamp(1.6rem, 5.5vh, 3.2rem), calc(var(--safe-b) + 1rem));
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  margin: 0;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: clamp(0.95rem, 1.15vw, 1.15rem);
  line-height: 1;
  letter-spacing: 0.42em;
  // The trailing tracking after the J is the only thing on its right; pulled
  // back so the pair is centred by eye rather than by box.
  margin-right: -0.42em;
  color: var(--c-bone);
  opacity: 0;
  transform: translate3d(0, 0.6rem, 0);
  transition:
    opacity 1.4s var(--e-out-quart) 0.5s,
    transform 1.6s var(--e-out-expo) 0.5s,
    letter-spacing 2.2s var(--e-out-expo) 0.5s,
    margin-right 2.2s var(--e-out-expo) 0.5s;

  &.is-open {
    opacity: 1;
    transform: none;
    letter-spacing: 0.22em;
    margin-right: -0.22em;
  }
}

.sg__glyph {
  flex: none;
  width: 1.3em;
  height: 1.3em;
}

.sg__name { display: block; }

// The figure is the loading screen; without motion it is simply already open.
@media (prefers-reduced-motion: reduce) {
  .sg__seed circle { transition: none; }
  .sg__brand { transition: none; }
}
</style>
