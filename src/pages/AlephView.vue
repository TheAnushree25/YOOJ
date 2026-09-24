<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { Backdrop } from "../webgl/Backdrop";
import { usePointer } from "../composables/usePointer";
import { useSmoothScroll } from "../composables/useSmoothScroll";
import AlephMeet from "../components/sections/aleph/AlephMeet.vue";
// QUESTIONS SECTION - hidden for now ("Where does the consultation go?" and
// the five after it). Uncomment this and the tag in the template to restore.
// import AlephHero from "../components/sections/aleph/AlephHero.vue";
import AlephCard from "../components/sections/aleph/AlephCard.vue";
import AlephQuantum from "../components/sections/aleph/AlephQuantum.vue";
import AlephFound from "../components/sections/aleph/AlephFound.vue";
import AlephAccess from "../components/sections/aleph/AlephAccess.vue";
import { entered, onDark } from "../lib/session";
import { ScrollTrigger } from "../composables/useMotion";
import { afterPaint } from "../lib/schedule";
import SplashGate from "../components/chrome/SplashGate.vue";
import SiteMenu from "../components/chrome/SiteMenu.vue";
import BrandMark from "../components/ui/BrandMark.vue";

/**
 * Aleph: the pale page.
 *
 * The same field as the front page and the same scroll engine — only the
 * palette and the tuning differ, which is why the shader takes them as
 * arguments. A second shader would have been two things to keep in step.
 *
 * The ground is lit rather than dark, so everything on it is set in one ink
 * and the only saturated marks on the page are the label dots, and the point
 * where the opening line lands.
 */

const canvas = ref<HTMLCanvasElement | null>(null);
const { progress, mount, lock, unlock, toTop } = useSmoothScroll();
const { x, y } = usePointer();

let backdrop: Backdrop | null = null;
// Cleared on unmount, so a field scheduled for after the paint is not built
// into a page that has already gone.
let alive = true;

onMounted(() => {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);

  if (canvas.value) {
    const plate = canvas.value;
    // Built once the page has painted, not inside the route change's own
    // task. See lib/schedule.
    afterPaint(() => {
      if (!alive) return;
      const field = new Backdrop(plate, {
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
        // The light stills: upper centre-left, left, and back.
        poses: [[0.42, 0.77], [0.28, 0.5], [0.42, 0.7], [0.58, 0.55]],
        cadence: 3,
      });
      backdrop = field;
      field.start();
      window.addEventListener("resize", field.resize);
      field.setPointer(x.value, y.value);
      field.setProgress(progress.value);
    }, 0);
  }

  mount();

  // Held at the top until the gate is answered, as the front page is. The
  // gate belongs to the visit, so a reader who has already come through it on
  // the front page is not shown it again here.
  if (!entered.value) {
    toTop();
    lock();
    const settle = () => requestAnimationFrame(() => { if (!entered.value) toTop(); });
    if (document.readyState === "complete") settle();
    else window.addEventListener("load", settle, { once: true });
  }
});

/**
 * The gate lifts.
 *
 * A hard refresh, and only now: every trigger on this page measured itself
 * while the document was held still behind the gate, and some of those
 * measurements are taken against fonts that had not landed.
 */
const onEnter = () => {
  entered.value = true;
  setTimeout(() => {
    toTop();
    unlock();
    ScrollTrigger.refresh(true);
  }, 0);
};

// The menu, and the page held still behind it — the same engine stop the
// gate uses, so a menu opened mid-glide does not have the page still moving
// under it.
const menuOpen = ref(false);
const openMenu = () => { menuOpen.value = true; lock(); };
const closeMenu = () => { menuOpen.value = false; unlock(); };

onBeforeUnmount(() => {
  alive = false;
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

    <SplashGate v-if="!entered" @enter="onEnter" />

    <header class="al__head">
      <RouterLink class="al__mark" to="/" data-cursor="scale">
        <BrandMark class="al__glyph" />
        <span>YOOJ</span>
      </RouterLink>

      <div class="al__meta">
        <!-- The rule is the page's own progress: it fills left to right and is
             full at the foot of the document, as the front page's is. -->
        <span class="al__rule" aria-hidden="true">
          <i :style="{ transform: `scaleX(${Math.max(0.008, Math.min(1, progress))})` }" />
        </span>
        <!-- The page's name is the way into the menu, as the chapter name is
             on the front page: pointed at, it says "Menu". The nine dots are
             the reference's own affordance for the same thing and stay beside
             it, now with something behind them. -->
        <button
          class="al__trigger"
          type="button"
          aria-label="Open menu"
          data-cursor="scale"
          @click="openMenu"
        >
          <span class="al__swap" aria-hidden="true">
            <span class="al__stack">
              <span class="al__word al__word--here">Solutions</span>
              <span class="al__word al__word--menu">Menu</span>
            </span>
          </span>
          <span class="al__dots" aria-hidden="true">
            <i v-for="n in 9" :key="n" />
          </span>
        </button>
      </div>
    </header>

    <main class="al__content">
      <!-- The mark, the line, and "Your care, mapped." -->
      <AlephMeet />
      <!-- QUESTIONS SECTION - hidden for now; see the import above. -->
      <!-- <AlephHero /> -->
      <AlephCard />
      <AlephQuantum />
      <AlephFound />
      <AlephAccess />
    </main>

    <p class="al__hint" :class="{ 'is-gone': progress > 0.02 || !entered }">Scroll to explore</p>

    <SiteMenu :open="menuOpen" contact-href="#aleph-access" @close="closeMenu" />
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
  // The field's own colour, painted under the canvas: the shader arrives a
  // frame or two after the page now, and this is what shows until it does.
  background: var(--ga-bg);

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

// 14px at 4.3px tracking, centred — the reference's own logo spec, with the
// mark itself beside the word.
.al__mark {
  grid-column: 2;
  justify-self: center;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
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
  position: relative;
  grid-column: 1 / -1;
  height: 1px;
  background: rgb(60 1 14 / 0.22);
  overflow: hidden;

  i {
    position: absolute;
    inset: 0;
    background: var(--ga-ink);
    transform-origin: 0 50%;
    will-change: transform;
    transition: background-color 0.45s var(--e-out-quart);
  }
}

.al__glyph { font-size: 1.05rem; }

.al__trigger {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(2rem, 5vw, 4.5rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: var(--ga-ink);
}

// One line tall, and it clips; the two words slide through it by their own
// height, exactly as the front page's readout does.
.al__swap {
  display: block;
  overflow: hidden;
  height: 1em;
}

.al__stack {
  display: block;
  transition: transform var(--t-hover) var(--e-out-quart);
}

.al__word {
  display: block;
  height: 1em;
  line-height: 1;
  white-space: nowrap;
}

.al__trigger:hover .al__stack,
.al__trigger:focus-visible .al__stack {
  transform: translateY(-1em);
}

// Three by three, the reference's menu affordance.
.al__dots {
  display: grid;
  grid-template-columns: repeat(3, 3px);
  gap: 4px;

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
  .al__trigger { color: #FFFFFF; }

  .al__rule { background: rgb(255 255 255 / 0.28); }
  .al__rule i { background: #FFFFFF; }

  .al__dots i { background: rgb(255 255 255 / 0.7); }

  .al__hint { opacity: 0; }
}

// Slow enough not to flicker on a scrub that crosses the threshold, fast
// enough that the header is never caught half-legible.
.al__mark,
.al__trigger,
.al__rule,
.al__dots i {
  transition: color 0.45s var(--e-out-quart), background-color 0.45s var(--e-out-quart);
}

// Same reasoning as the site header: the chapter control was 116 x 17.
@media (pointer: coarse) {
  .al__trigger {
    min-height: 44px;
    padding-block: 0.8rem;
    margin-block: -0.8rem;
    display: inline-flex;
    align-items: center;
  }

  .al__mark {
    min-height: 44px;
    padding-block: 0.7rem;
    margin-block: -0.7rem;
  }
}
</style>
