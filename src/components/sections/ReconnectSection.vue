<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";
import { SEED_FIELD, SEED_INK, SEED_RINGS } from "../../lib/seed";

/**
 * The second movement: four beats played across one held frame.
 *
 * The reader scrolls and the page does not appear to. That is a tall section
 * with a sticky stage inside it — the stage pins itself to the viewport for the
 * section's whole travel, so the scroll distance becomes a timeline rather than
 * a displacement.
 *
 * Sticky rather than a pinned ScrollTrigger on purpose. Pinning switches the
 * element to fixed, and a fixed element reports an offset of zero, so any
 * refresh landing while the pin is applied re-measures its start as the top of
 * the document and latches on arrival. Sticky is the browser's own mechanism
 * and has no such state to corrupt.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

/** Normalised position inside one beat, clamped at both ends. */
const span = (from: number, to: number) =>
  Math.min(1, Math.max(0, (p.value - from) / (to - from)));

/** Smoothstep, so a beat eases in and out rather than starting at full speed. */
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(span(from, to));

/**
 * The statement the pale panel carries.
 *
 * The panel is already in place when the section opens. An earlier cut had it
 * climb from below over the first third, which left a long opening stretch
 * where the only thing on screen was the grained field behind it — four
 * viewports of scrolling that began with nothing to read.
 */
const statement = [
  "Our minds answer to the world",
  "around them, yet the care we offer",
  "keeps asking them to answer",
  "a form instead.",
];

/**
 * Why a single reading is not a diagnosis.
 *
 * Each entry has to fit the measure on one line. The mask that reveals a line
 * clips whatever sits below it, so an entry long enough to wrap slides up as a
 * two-line block with its own second line cut in half for the length of the
 * reveal — which is what the first two of these were doing at desktop width.
 */
const argument = [
  "Care today runs in a straight line,",
  "gathering findings months apart and",
  "rarely joining them into one picture",
  "of a person as they actually are.",
];

/**
 * Three arcs, not a lattice.
 *
 * Five circles at mixed radii crossed each other into a web the eye kept
 * trying to solve. Three very large ones, struck from beyond the frame so only
 * one arc of each crosses it, read as a horizon and a moon — something seen
 * rather than something drawn. Each carries a small drift so the geometry
 * breathes with the scroll instead of sitting printed on the ground.
 */
const rings = [
  { x: -120, y: 1040, r: 760, dx: 40, dy: -34, weight: 0.24 },
  { x: 1720, y: 620,  r: 640, dx: -54, dy: -18, weight: 0.24 },
  { x: 1000, y: 170,  r: 130, dx: -22, dy: 12,  weight: 0.36 },
];

/**
 * The crown's vertical radius, in percent of the dome's height.
 *
 * Two moves in one number, and they run in opposite directions on purpose.
 *
 * First it blooms: a shallow curve on arrival deepening to a full round crown
 * as the dome climbs, so the shape reads as swelling into the frame rather than
 * sliding in as a fixed card.
 *
 * Then it opens out. A round crown on a box 210vw wide still leaves the top
 * corners of the viewport uncovered — at the frame's edges the arc's top sits
 * some 15vh down, which is the pale wedge that was showing either side of the
 * pathway. Letting the curvature keep growing until the edge is straight is
 * what takes the dome to the full screen, and it is the same gesture as the
 * bloom carried past its own halfway point.
 */
const crown = () => (24 + beat(0.18, 0.44) * 40) * (1 - beat(0.46, 0.64));

/**
 * The dome's offset, in percent of its own height.
 *
 * It climbs from below the frame to flush with the top, then keeps going by a
 * little. The extra lift is what closes the corner wedges while the crown is
 * still curved, so the ground fills in continuously instead of the corners
 * snapping square at the end.
 */
const domeY = () => (1 - beat(0.18, 0.42)) * 96 - beat(0.40, 0.60) * 16;

/**
 * A care pathway as it is usually walked: one stage at a time, each restarting
 * what the last one learned. Drawn as a row so its length is the argument.
 */
const pathway = [
  "Intake",
  "First assessment",
  "Waiting",
  "Re-assessment",
  "Diagnosis",
  "Referral",
  "Back to intake",
];

/**
 * The turn the section ends on, word by word.
 *
 * Set as one string and split here rather than hand-broken into lines: this
 * one lights a word at a time as the reader scrolls, so the unit is the word
 * and the line breaks are the browser's business.
 */
const turn = (
  "Halcyon moves beyond the straight line, reading the whole of a week as one "
  + "connected signal, towards care that answers a person rather than a form."
).split(" ");

/** A word's brightness in the closing beat. The edge runs ahead of itself. */
const told = (i: number) => {
  const head = beat(0.84, 0.97) * (turn.length * 1.2);
  return 0.16 + Math.min(1, Math.max(0, (head - i) / (turn.length * 0.2))) * 0.84;
};


/** The one line the figure is traced with. Held here so the stroke and the
 *  spark that rides it can never be given different geometry. */
const TRACE = "M 150 120 C 150 20 470 20 470 190 C 470 360 150 330 150 500 C 150 640 430 640 500 560";

/** The stroke is 1400 long; the dash retreats as the curve is drawn. */
const CURVE = 1400;

/** How far along the curve the drawing head has reached, in stroke units. */
const drawn = () => beat(0.85, 1) * CURVE;

onMounted(() => {
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
  <section id="reconnect" ref="root" class="rc">
    <div class="rc__stage">
      <!-- Beat one: the pale ground, present from the first frame. -->
      <div class="rc__panel">
        <p class="label rc__eyebrow" :style="{ opacity: 1 - beat(0.17, 0.29) }">Reconnecting</p>
        <p class="rc__statement" :style="{ opacity: 1 - beat(0.17, 0.29) }">
          <span v-for="(line, i) in statement" :key="i" class="rc__line">
            <span :style="{ transform: `translate3d(0, ${(1 - beat(0.005 + i * 0.022, 0.13 + i * 0.022)) * 110}%, 0)` }">
              {{ line }}
            </span>
          </span>
        </p>
      </div>

      <!-- Beat two: the deep ground climbs through it as a wide circular arc. -->
      <div class="rc__domeWrap">
        <div
          class="rc__dome"
          :style="{
            transform: `translate3d(-50%, ${domeY()}%, 0)`,
            borderRadius: `50% 50% 0 0 / ${crown()}% ${crown()}% 0 0`,
          }"
        >
          <!-- Beat three: geometry, struck from off-frame so only arcs cross it. -->
          <svg class="rc__rings" viewBox="0 0 1600 900" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            <circle
              v-for="(c, i) in rings"
              :key="i"
              :cx="c.x" :cy="c.y" :r="c.r"
              :style="{
                opacity: beat(0.34 + i * 0.05, 0.58 + i * 0.05) * c.weight,
                transform: `translate(${c.dx * beat(0.34, 0.7)}px, ${c.dy * beat(0.34, 0.7)}px) scale(${0.96 + beat(0.34 + i * 0.05, 0.7) * 0.04})`,
                transformOrigin: `${c.x}px ${c.y}px`,
              }"
            />
          </svg>
        </div>
      </div>

      <!-- Beat three copy, low and left, arriving a line at a time. -->
      <div class="rc__argument" :style="{ opacity: beat(0.36, 0.46) - beat(0.54, 0.62) }">
        <p class="rc__argument-copy">
          <span v-for="(line, i) in argument" :key="i" class="rc__line">
            <span :style="{ transform: `translate3d(0, ${(1 - beat(0.37 + i * 0.022, 0.50 + i * 0.022)) * 110}%, 0)` }">
              {{ line }}
            </span>
          </span>
        </p>
      </div>

      <!-- Beat four: the pathway, drifting as the reader travels. It arrives
           later than the argument it answers, holds for a long stretch so the
           row can actually be read end to end, and travels further in that
           window than it used to in the whole section. -->
      <div class="rc__pathway" :style="{ opacity: beat(0.58, 0.65) - beat(0.80, 0.86) }">
        <!-- Two transforms, on two elements, doing two different jobs: the rail
             carries the reader's own travel and the track runs on its own clock
             underneath it. On one element the animation and the bound style
             would overwrite each other every frame. -->
        <div class="rc__rail" :style="{ transform: `translate3d(${-beat(0.57, 0.85) * 24}%, 0, 0)` }">
          <div class="rc__track">
            <!-- Two identical passes. The loop translates by exactly half the
                 track, so the second pass is already under the eye when the
                 first leaves and the seam never shows. -->
            <template v-for="pass in 2" :key="pass">
              <template v-for="stage in pathway" :key="`${pass}-${stage}`">
                <div class="rc__node"><span>{{ stage }}</span></div>
                <span class="rc__arrow" aria-hidden="true">&rarr;</span>
              </template>
            </template>
          </div>
        </div>
        <p class="rc__pathway-copy">
          Each stage restarts what the last one learned, and the person tells the
          story again from the beginning.
        </p>
      </div>

      <!-- Beat five: the turn. The figure the site opened with, drawn on
           again, with one line pulled through it as the reader reads. -->
      <div class="rc__turn" :style="{ opacity: beat(0.82, 0.88) }">
        <svg class="rc__seed" :viewBox="`0 0 ${SEED_FIELD.w} ${SEED_FIELD.h}`" aria-hidden="true">
          <!-- Struck from the centre and carried out to their places, exactly
               as the gate opens. Same figure, same gesture, second time. -->
          <circle
            v-for="(o, i) in SEED_RINGS"
            :key="i"
            :cx="SEED_FIELD.cx" :cy="SEED_FIELD.cy" :r="SEED_FIELD.r"
            :class="{ 'rc__hub': i === 0 }"
            :style="{
              opacity: beat(0.82 + i * 0.009, 0.92 + i * 0.009) * (i === 0 ? 1 : SEED_INK),
              transform: `translate(${o[0] * beat(0.82 + i * 0.009, 0.97 + i * 0.009)}px, ${o[1] * beat(0.82 + i * 0.009, 0.97 + i * 0.009)}px)`,
            }"
          />

          <!-- One line through the figure, drawn rather than revealed: the
               dash retreating is what makes it read as being traced. -->
          <path
            class="rc__curve"
            :d="TRACE"
            :style="{ strokeDasharray: CURVE, strokeDashoffset: CURVE - drawn() }"
          />

          <!-- And the light that is drawing it. A short bright dash pinned to
               the head of the stroke, so the line does not appear so much as
               get struck. Same path, so it cannot drift off the curve. -->
          <path
            class="rc__spark"
            :d="TRACE"
            :style="{
              strokeDasharray: `30 ${CURVE * 2}`,
              strokeDashoffset: -(drawn() - 30),
              opacity: beat(0.85, 0.88) - beat(0.985, 1),
            }"
          />

          <circle class="rc__pip" cx="336" cy="250" :r="13" :style="{ opacity: beat(0.9, 0.96) }" />
          <circle class="rc__pip" cx="336" cy="470" :r="13" :style="{ opacity: beat(0.94, 1) }" />
        </svg>

        <p class="rc__turn-copy">
          <span v-for="(w, i) in turn" :key="i" :style="{ opacity: told(i) }">{{ `${w} ` }}</span>
        </p>
      </div>

      <!-- The standing marker, swapping its word as the argument turns. -->
      <p class="label rc__marker" :style="{ opacity: beat(0.30, 0.40) }">
        {{ p > 0.84 ? "Beyond a straight line" : "Reconnecting" }}
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Five viewports of travel. The stage inside holds for all of it, so this is a
// duration rather than a height.
// Seven viewports. The section carries five beats now — statement, dome,
// geometry, pathway, and the turn at the end — and at five each of them was
// arriving before the last had been read.
.rc {
  position: relative;
  height: 720vh;
  height: calc(var(--vh, 1vh) * 720);
}

.rc__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
  background: var(--c-bone);
}

.rc__panel {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: clamp(1.4rem, 4vh, 2.4rem);
  padding: var(--stack) var(--gutter);
}

.rc__eyebrow { color: var(--c-indigo); }

.rc__statement {
  max-width: 24ch;
  text-align: center;
  font-size: var(--t-h2);
  font-weight: 250;
  line-height: 1.16;
  letter-spacing: -0.024em;
  color: var(--c-indigo);
}

.rc__line {
  display: block;
  overflow: hidden;

  > span { display: block; will-change: transform; }
}

.rc__domeWrap {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

// Far wider than the frame so the visible crown is a gentle, genuinely circular
// arc. A dome the width of the viewport reads as a shallow ellipse instead.
.rc__dome {
  position: absolute;
  left: 50%;
  top: 0;
  width: 210vw;
  height: 190vh;
  border-radius: 50% 50% 0 0 / 46% 46% 0 0;
  // The dome is this section's dark ground, so it is a tint over the shared
  // field rather than a surface of its own — the geometry inside it still
  // needs an edge to be clipped by, which is why it is not simply removed.
  background:
    radial-gradient(54% 62% at 74% 40%, rgb(var(--rgb-accent) / 0.3) 0%, transparent 62%),
    linear-gradient(158deg, rgb(var(--rgb-ink) / 0.74) 2%, rgb(var(--rgb-deep) / 0.4) 46%, rgb(var(--rgb-action) / 0.3) 100%);
  will-change: transform;
  overflow: hidden;
}

.rc__rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;

  circle {
    fill: none;
    stroke: var(--c-bone);
    // Hairline. At the size these are drawn, a heavier stroke reads as a
    // diagram; this reads as light catching an edge.
    stroke-width: 0.85;
    will-change: opacity, transform;
  }
}

.rc__argument {
  position: absolute;
  left: var(--gutter);
  bottom: clamp(5rem, 14vh, 8rem);
  z-index: 3;
  // In ch so the measure tracks the type size, and capped against the viewport
  // so the guarantee that each line fits survives a narrow screen.
  max-width: min(44ch, calc(100vw - var(--gutter) * 2));
}

.rc__argument-copy {
  font-size: var(--t-lead);
  line-height: 1.45;
  font-weight: 250;
  color: var(--c-bone);
}

.rc__pathway {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  align-content: center;
  gap: clamp(2.4rem, 8vh, 5rem);
  pointer-events: none;
}

// Wider than the frame on purpose: the row runs off both edges, so the pathway
// reads as longer than the screen can hold, which is the point being made.
.rc__rail {
  width: max-content;
  will-change: transform;
}

.rc__track {
  display: flex;
  align-items: center;
  gap: clamp(0.8rem, 2.4vw, 2rem);
  padding-inline: var(--gutter);
  width: max-content;
  // Never stops. A pathway that only moves while the reader scrolls reads as a
  // diagram being dragged; one that keeps going reads as a loop somebody is
  // stuck inside, which is the thing the row is there to say.
  animation: rc-rail 34s linear infinite;
  will-change: transform;
}

@keyframes rc-rail {
  from { transform: translate3d(0, 0, 0); }
  // Exactly half: the track holds two identical passes, so half a track is one
  // whole pass and the reset lands on a frame identical to the one before it.
  to   { transform: translate3d(-50%, 0, 0); }
}

.rc__node {
  display: grid;
  place-items: center;
  flex: none;
  width: clamp(9rem, 17vw, 15rem);
  aspect-ratio: 1;
  // Glass discs rather than wire: a faint fill lifts each node off the ground
  // so the row reads as objects in the scene, and the lighter rim keeps them
  // beneath the horizon arcs in the hierarchy instead of competing with them.
  border: 1px solid rgb(var(--rgb-bone) / 0.2);
  background: rgb(var(--rgb-bone) / 0.035);
  border-radius: 50%;
  padding: 1.2rem;
  text-align: center;

  span {
    font-family: "Space Grotesk", monospace;
    font-size: var(--t-label);
    letter-spacing: var(--ls-label);
    text-transform: uppercase;
    color: rgb(var(--rgb-bone) / 0.82);
  }
}

.rc__arrow {
  flex: none;
  color: rgb(var(--rgb-bone) / 0.5);
  font-size: clamp(0.9rem, 1.4vw, 1.2rem);
}

.rc__pathway-copy {
  padding-inline: var(--gutter);
  max-width: 42ch;
  font-size: var(--t-lead);
  line-height: 1.45;
  font-weight: 250;
  color: var(--c-bone);
}

/* ------------------------------------------------------- the closing turn */

.rc__turn {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  align-content: center;
  padding: 0 var(--gutter);
  pointer-events: none;

  @media (min-width: 60rem) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    column-gap: clamp(2rem, 6vw, 6rem);
  }
}

// Right half, and taller than the column so only the middle of the figure
// crosses the frame — the same crop the gate uses on arrival.
.rc__seed {
  grid-row: 1;
  grid-column: 1;
  justify-self: center;
  width: min(92vw, 50rem);
  overflow: visible;

  circle {
    fill: none;
    stroke: var(--c-bone);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    // The origin has to be the view box, or a percentage origin resolves
    // against each circle's own bounds and the figure scatters instead of
    // opening.
    transform-box: view-box;
    transform-origin: center;
  }

  @media (min-width: 60rem) {
    grid-column: 2;
    width: min(52vw, 58rem);
  }
}

// The light at the head of the stroke. Drawn after the line and over it, with
// a bloom that is part of the stroke rather than a separate glow element —
// one path cannot come apart from the other.
// The one ring that does not travel — the gate draws it as a control, so here
// it is struck at full weight to say the same thing without being one.
.rc__hub {
  stroke: var(--c-bone) !important;
  stroke-width: 1.4 !important;
}

.rc__spark {
  fill: none;
  stroke: #FFFFFF;
  stroke-width: 3.4;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  filter:
    drop-shadow(0 0 4px rgba(255, 255, 255, 0.95))
    drop-shadow(0 0 14px var(--c-accent))
    drop-shadow(0 0 30px rgb(var(--rgb-accent) / 0.7));
}

.rc__curve {
  fill: none;
  stroke: var(--c-bone);
  stroke-width: 1.6;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
}

.rc__pip {
  fill: none;
  stroke: var(--c-accent);
  stroke-width: 1.2;
  vector-effect: non-scaling-stroke;
}

.rc__turn-copy {
  grid-row: 1;
  grid-column: 1;
  align-self: center;
  max-width: 24ch;
  font-size: var(--t-h3);
  line-height: 1.44;
  font-weight: 250;
  letter-spacing: -0.012em;
  color: var(--c-bone);

  > span { transition: opacity 0.45s var(--e-out-quart); }

  @media (max-width: 60rem) {
    margin-top: clamp(1.6rem, 5vh, 2.6rem);
    max-width: none;
  }
}


.rc__marker {
  position: absolute;
  left: var(--gutter);
  bottom: clamp(1.6rem, 4.5vh, 2.8rem);
  z-index: 4;
  color: var(--c-accent);
}

// Without motion this is one still frame rather than five viewports of
// scrolling that resolve to nothing.
@media (prefers-reduced-motion: reduce) {
  .rc { height: auto; }
  .rc__track { animation: none; }
  .rc__stage { position: relative; height: auto; min-height: 100vh; }
  .rc__panel { display: none; }
  .rc__dome { transform: translateX(-50%) !important; }
}
</style>
