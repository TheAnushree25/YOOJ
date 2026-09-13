<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { MindScene } from "../../../webgl/MindScene";
import { onDark } from "../../../lib/session";

/**
 * Chaos, order, a twin, and then the room.
 *
 * One subject held in the frame while three things happen inside it and a
 * fourth happens to it. The copy turns over on the same clock, so each
 * statement is the caption for what the head is doing as it is read.
 *
 * The ground turns with the last beat. Up to that point the page is the pale
 * one the section was entered on; as the head comes apart the frame goes deep
 * navy and the dispersal has somewhere to disperse into — a scattering into
 * white would have nothing to be seen against.
 */

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const p = ref(0);

let trigger: ReturnType<typeof scrubThrough> = null;
let scene: MindScene | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

/**
 * Three statements, each the caption for one state of the head.
 *
 * The heading is a pair with one half live and the other in a tint — the
 * reference never swaps the words out, it changes which of them carries the
 * weight.
 */
const beats = [
  {
    lead: "Chaos",
    trail: "Order",
    copy: "We apply non-linear dynamics to capture the complex chaos within you.",
  },
  {
    lead: "Order",
    trail: "Chaos",
    copy: "And turn this into intelligent representations of true order, to capture who you are.",
  },
  {
    lead: "Twin",
    trail: "Order",
    copy: "By synthesizing these complexes, structures and predispositions that make you who you are, we create a digital twin of you.",
  },
] as const;

/** Which statement is live. The turns land on the plate hand-overs. */
const said = () => (p.value < 0.42 ? 0 : p.value < 0.68 ? 1 : 2);

/**
 * How far the frame has turned from the pale page to the dark room.
 *
 * Deliberately a beat behind the burst, which starts at 0.70. The head lets go
 * first and the ground follows it — the other way round, the reader reads a
 * background change and only then notices the head was already leaving.
 */
const night = () => beat(0.74, 0.88);

onMounted(() => {
  if (!root.value || !canvas.value) return;

  scene = new MindScene(canvas.value, {
    plates: [
      "/aleph/mind-base.png",
      "/aleph/mind-chaos.png",
      "/aleph/mind-order.png",
      "/aleph/mind-twin.png",
    ],
    // One field, doing both jobs: the burst and the drift that follows it.
    motes: 17000,
    pale: "#D8E4F2",
    warm: "#C9BC9E",
    dark: "#0B1330",
  });
  scene.start();
  window.addEventListener("resize", scene.resize);

  if (prefersReduced()) {
    p.value = 0.34;
    scene.setProgress(0.34);
    return;
  }

  trigger = scrubThrough(root.value, (v) => {
    p.value = v;
    scene?.setProgress(v);
    // The room turns here, so this is the only place that knows when the page
    // stops being the pale one and the chrome above has to change sides.
    onDark.value = v > 0.78;
  }, { start: "top top", end: "bottom bottom" });
});

onBeforeUnmount(() => {
  trigger?.kill();
  if (scene) window.removeEventListener("resize", scene.resize);
  scene?.dispose();
});
</script>

<template>
  <section id="aleph-mind" ref="root" class="am">
    <div class="am__stage" :class="{ 'is-night': p > 0.78 }">
      <!-- The room. Painted under everything and only lit at the end. -->
      <div class="am__night" :style="{ opacity: night() }" aria-hidden="true" />

      <div class="am__plate"><canvas ref="canvas" /></div>

      <div class="am__say" :style="{ opacity: beat(0.03, 0.1) - beat(0.78, 0.89) }">
        <h2 class="am__h">
          <span
            v-for="(b, i) in beats"
            :key="i"
            class="am__pair"
            :style="{ opacity: i === said() ? 1 : 0, transform: `translate3d(0, ${(i - said()) * 1.1}rem, 0)` }"
            :aria-hidden="i !== said()"
          >
            <span class="is-lead">{{ b.lead }}</span>
            <span class="is-trail">{{ b.trail }}</span>
          </span>
        </h2>

        <p class="am__copy">
          <span
            v-for="(b, i) in beats"
            :key="i"
            :style="{ opacity: i === said() ? 1 : 0 }"
            :aria-hidden="i !== said()"
          >{{ b.copy }}</span>
        </p>
      </div>

      <p class="am__label" :style="{ opacity: 1 - night() * 0.45 }">From chaos to clarity</p>
      <p class="am__step">{{ String(said() + 3).padStart(2, "0") }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Six viewports. Four states and a dispersal need room to be read as five
// separate things happening to one head rather than as a single cross-fade.
.am {
  position: relative;
  height: 600vh;
  height: calc(var(--vh, 1vh) * 600);
}

.am__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
}

// Deep navy, with the light gathered low — the reference's dispersal happens
// over a floor of pale cyan, which is what the risen motes read against.
.am__night {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(72% 42% at 50% 108%, #7FD3E8 0%, rgba(58, 130, 190, 0.5) 34%, transparent 72%),
    linear-gradient(178deg, #10205E 0%, #16276B 46%, #1B3C86 100%);
}

// The whole frame. The head is placed inside it by the scene rather than by
// sizing this box, because a canvas cropped to the portrait is a wall the
// dispersal cannot cross — the points would mill about inside the rectangle
// the head used to occupy however far the shader threw them.
.am__plate {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;

  canvas { width: 100%; height: 100%; display: block; }
}

/* -------------------------------------------------------------- the words */

.am__say {
  position: absolute;
  left: var(--gutter);
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: min(22rem, 26vw);

  @media (max-width: 60rem) { width: min(30rem, 86vw); }
}

// The statements occupy one box and cross over inside it, so nothing in the
// column moves when the section turns.
.am__h {
  position: relative;
  display: grid;
  min-height: 8.5rem;
  font-size: var(--ta-payoff);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
}

.am__pair {
  grid-area: 1 / 1;
  display: grid;
  transition:
    opacity 0.75s var(--e-out-quart),
    transform 0.9s var(--e-out-expo);

  .is-lead { color: var(--ga-ink); }
  // The other half of the pair, kept present in a tint: the reference lets
  // weight say which word is live rather than swapping the text out.
  .is-trail { color: rgb(27 41 120 / 0.4); }
}

.am__copy {
  position: relative;
  display: grid;
  margin-top: clamp(1.1rem, 3.2vh, 1.9rem);
  min-height: 6.5rem;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  color: var(--ga-ink);

  > span {
    grid-area: 1 / 1;
    transition: opacity 0.65s var(--e-out-quart);
  }
}

.am__label {
  position: absolute;
  left: var(--gutter);
  bottom: clamp(1.6rem, 4.5vh, 2.8rem);
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 0.9em;
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
    background: #4FC3DE;
  }
}

.am__step {
  position: absolute;
  right: var(--gutter);
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  color: rgb(27 41 120 / 0.5);
  font-variant-numeric: tabular-nums;
  transition: color 0.6s var(--e-out-quart);
}

// Once the room is lit, the furniture that was set in the page's ink has to
// change sides or it disappears into the navy.
.am__stage.is-night {
  .am__label, .am__step { color: rgb(255 255 255 / 0.7); }
}

@media (prefers-reduced-motion: reduce) {
  .am { height: auto; }

  .am__stage {
    position: relative;
    height: auto;
    min-height: 80vh;
    padding: var(--stack) 0;
  }
}
</style>
