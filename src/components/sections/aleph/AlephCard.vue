<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { CardScene } from "../../../webgl/CardScene";
import { onDark } from "../../../lib/session";
import StepRing from "../../ui/StepRing.vue";

/**
 * The card, turned and then broken.
 *
 * One object held in the frame, revolving, while the copy turns over on the
 * same clock — so each statement is the caption for what the card is doing as
 * it is read. Two full revolutions, then it comes forward, then it lets go.
 *
 * The ground turns with the last beat. Up to that point the page is the pale
 * one the section was entered on; as the card comes apart the frame goes deep
 * navy and the dispersal has somewhere to disperse into — a scattering into
 * white would have nothing to be seen against.
 */

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const p = ref(0);

let trigger: ReturnType<typeof scrubThrough> = null;
let scene: CardScene | null = null;

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
    lead: "Care that moves",
    trail: "with you",
    copy: "Your doctor. Your medicines. Your diagnostics. Your history. YOOJ brings the journey together so the next step doesn’t begin from zero.",
  },
  {
    lead: "Existing",
    trail: "care",
    copy: "Local doctors\nLocal pharmacies\nExisting clinics\nExisting diagnostic demand\nExisting patient relationships",
  },
  {
    lead: "YOOJ adds",
    trail: "care",
    copy: "Standard\nSupply chain\nInfrastructure\nPatient identity\nNetwork",
  },
] as const;

/**
 * Which statement is live.
 *
 * All three are read while the card is still turning. They used to run to 0.68,
 * which put the last of them under the approach — and a card coming at the
 * reader at that size covers the column completely, so the statement it was
 * meant to be a caption for could not be read at all.
 */
const said = () => (p.value < 0.26 ? 0 : p.value < 0.46 ? 1 : 2);

/** How far through the live statement the reader is: the ring's arc. */
const through = () => {
  const s = said();
  const from = s === 0 ? 0 : s === 1 ? 0.26 : 0.46;
  const to = s === 0 ? 0.26 : s === 1 ? 0.46 : 0.66;
  return clamp01((p.value - from) / (to - from));
};

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

  scene = new CardScene(canvas.value, {
    front: "/aleph/card-front.jpg",
    back: "/aleph/card-back.jpg",
    // One field, doing both jobs: the burst and the drift that follows it.
    motes: 17000,
    // The inks the burst settles into, which are the ones the corridor below
    // is lit in — the pieces have to arrive there already matching.
    pale: "#D8E4F2",
    warm: "#C9BC9E",
    dark: "#3C010E",
  });
  scene.start();
  window.addEventListener("resize", scene.resize);

  if (prefersReduced()) {
    p.value = 0.34;
    scene.setProgress(0.34);
    return;
  }

  trigger = scrubThrough(root.value, (v, active) => {
    p.value = v;
    scene?.setProgress(v);
    // The room turns here, so this is the only place that knows when the page
    // stops being the pale one and the chrome above has to change sides. Only
    // while the reader is actually in it — off screen this fires too, and an
    // unguarded write here is a claim on the whole page.
    if (active) onDark.value = v > 0.78;
  }, { start: "top top", end: "bottom bottom" });
});

onBeforeUnmount(() => {
  trigger?.kill();
  if (scene) window.removeEventListener("resize", scene.resize);
  scene?.dispose();
});
</script>

<template>
  <section id="aleph-card" ref="root" class="am">
    <div class="am__stage" :class="{ 'is-night': p > 0.78 }">
      <!-- The room. Painted under everything and only lit at the end. -->
      <div class="am__night ground-drift" :style="{ opacity: night() }" aria-hidden="true" />

      <div class="am__plate"><canvas ref="canvas" /></div>

      <!-- Gone before the card fills the frame, not after. -->
      <div class="am__say" :style="{ opacity: beat(0.03, 0.1) - beat(0.58, 0.68) }">
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

      <p class="am__label" :style="{ opacity: 1 - night() * 0.45 }">From fragmented to connected</p>
      <!-- The reference's ring, beside the card: the statement's number, with
           an arc drawing round it as that statement is read. Leaves with the
           copy, before the card fills the frame. -->
      <StepRing
        class="am__ring"
        :index="said() + 2"
        :total="5"
        :progress="through()"
        :style="{ opacity: beat(0.03, 0.1) - beat(0.58, 0.68) }"
      />
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
  background: var(--ground-dark);
  // Declared here, beside the shorthand, and not in the drift class.
  // `background:` resets `background-size` to auto, and a scoped rule outranks
  // an unscoped one — so the size set on .ground-drift was being thrown away
  // and a gradient exactly the size of its own box has nowhere to move to. The
  // position animated correctly and nothing on screen changed.
  background-size: 190% 190%;
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

  // Both halves in the same ink and the same weight. The trail used to sit in
  // a tint, and on this ground a tinted "with you" read as a word half
  // switched off rather than as a lighter voice.
  .is-lead, .is-trail { color: var(--ga-ink); }
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
    // Two of the three statements are lists, authored with line breaks.
    white-space: pre-line;
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
    background: var(--ga-dot);
  }
}

// Beside the card, not at the edge of the frame. The card is sized off the
// viewport height (84% of it, at its own aspect), so its right edge is a
// height-relative distance from the centre and the ring is placed off that.
.am__ring {
  --ring-size: 3.4rem;
  position: absolute;
  left: 50%;
  top: 50%;
  margin-left: 30vh;
  translate: 0 -50%;
  z-index: 3;
  transition: opacity 0.6s var(--e-out-quart);

  @media (max-width: 60rem) { display: none; }
}

// Once the room is lit, the furniture that was set in the page's ink has to
// change sides or it disappears into the navy.
.am__stage.is-night {
  --ga-dot: #FEB3B8;
  .am__label { color: rgb(255 255 255 / 0.7); }
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
