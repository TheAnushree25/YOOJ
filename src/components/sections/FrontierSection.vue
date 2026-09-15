<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";

/**
 * The third movement: one shape, carried the length of the section.
 *
 * A single triangle enters out of focus above the heading, sharpens, and then
 * travels — out to the left, down, and back to the middle — turning over
 * itself the whole way. Where it comes to rest it is not a decoration any more
 * but the top tile of a three-part figure, and the other two draw themselves in
 * beneath it. The argument of the section is that shape arriving: three
 * separate things that turn out to be one.
 *
 * Same stage mechanism as the section above it — a tall section with a sticky
 * inner frame, so the scroll distance is a timeline rather than a displacement.
 * Sticky rather than a pinned ScrollTrigger for the reason recorded there: a
 * pinned element goes fixed, reports an offset of zero, and re-measures its own
 * start as the top of the document on any refresh that lands while the pin is
 * applied.
 */

const root = ref<HTMLElement | null>(null);

/** The stage's own travel, once it is locked to the viewport. */
const p = ref(0);

/**
 * The approach, which is a separate clock.
 *
 * The stage is sticky, so it slides up into place before its travel begins —
 * by the time `p` reaches zero the reader has already been looking at the frame
 * for a full viewport. Anything that plays on `p` is therefore playing late:
 * the heading spent its whole entrance hidden behind its own mask and only
 * appeared once the section had started moving. The statement arrives on this
 * clock instead, and is settled at the moment the stage locks.
 */
const entry = ref(0);

let trigger: ReturnType<typeof scrubThrough> = null;
let arrival: ReturnType<typeof scrubThrough> = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const span = (from: number, to: number) => clamp01((p.value - from) / (to - from));
const beat = (from: number, to: number) => ease(span(from, to));
const arrive = (from: number, to: number) =>
  ease(clamp01((entry.value - from) / (to - from)));

/* ------------------------------------------------------------------ shape */

/**
 * An equilateral triangle with arced corners, as a single path.
 *
 * Written out rather than drawn with `clip-path: polygon()` because the corners
 * have to be round — a hard point at this size reads as a warning sign, and the
 * whole figure has to feel like a held object. Each corner is cut back along
 * both of its edges by the tangent length for a 60° join and the gap closed
 * with an arc, which is the only construction that stays tangent on both sides.
 */
function roundedTriangle(size: number, radius: number): string {
  const h = (size * Math.sqrt(3)) / 2;
  // Clockwise from the apex, which is what makes every corner a sweep of 1.
  const pts: Array<[number, number]> = [[size / 2, 0], [size, h], [0, h]];
  const cut = radius / Math.tan(Math.PI / 6);

  const toward = (a: [number, number], b: [number, number]): [number, number] => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [a[0] + ((b[0] - a[0]) / len) * cut, a[1] + ((b[1] - a[1]) / len) * cut];
  };

  const arcs = pts.map((corner, i) => {
    const [sx, sy] = toward(corner, pts[(i + 2) % 3]);
    const [ex, ey] = toward(corner, pts[(i + 1) % 3]);
    return `${i === 0 ? "M" : "L"} ${sx.toFixed(2)} ${sy.toFixed(2)} A ${radius} ${radius} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  });

  return `${arcs.join(" ")} Z`;
}

const TRI_W = 100;
const TRI_H = +((TRI_W * Math.sqrt(3)) / 2).toFixed(3);
const TRI_PATH = roundedTriangle(TRI_W, 6);

/* ----------------------------------------------------------------- flight */

interface Key {
  /** Where in the section's travel this pose is held. */
  at: number;
  /** Offset from the tile's resting slot, in viewport units. */
  x: number;
  y: number;
  /** Absolute turn, in degrees. 0 and every multiple of 360 point upward. */
  r: number;
  s: number;
  /** Defocus, in pixels. Only the entrance uses it. */
  b: number;
  o: number;
}

/**
 * The flight, as poses rather than as a formula.
 *
 * A table because the path is a judgement, not a function: it has to clear the
 * heading on the way out, sit alone in the frame at its widest, and arrive
 * travelling slowly enough that the landing reads as settling rather than
 * stopping. The turn is absolute and ends at 1080° — three whole revolutions,
 * so the tile is upright at rest and the transform at the end of the section is
 * the identity. That is what lets the traveller simply *be* the top tile of the
 * figure rather than hand over to a copy of itself at the last moment.
 *
 * The whole flight is flown in the first four-fifths of the section, and the
 * last pose is then repeated at the end. Landing *at* 1.00 meant the tile was
 * still turning as the section handed over - the figure took its place and the
 * page moved on in the same moment, so the reader never saw it complete. The
 * repeated pose is a hold: identical values either side of it interpolate to
 * no movement at all, so the figure simply stands there while the rest of the
 * section's travel is spent.
 */
const LAND = 0.8;

const FLIGHT: Key[] = [
  { at: 0.00 * LAND, x:   1, y: -10, r:  180, s: 0.30, b: 17, o: 1 },
  { at: 0.07 * LAND, x:   1, y:  -8, r:  214, s: 0.35, b: 4,  o: 1 },
  { at: 0.16 * LAND, x:  -6, y:  -9, r:  288, s: 0.41, b: 0,  o: 1 },
  { at: 0.30 * LAND, x: -23, y:  -5, r:  428, s: 0.47, b: 0,  o: 1 },
  { at: 0.44 * LAND, x: -34, y:   4, r:  578, s: 0.55, b: 0,  o: 1 },
  { at: 0.58 * LAND, x: -31, y:  11, r:  728, s: 0.66, b: 0,  o: 1 },
  { at: 0.72 * LAND, x: -21, y:   8, r:  868, s: 0.84, b: 0,  o: 1 },
  { at: 0.86 * LAND, x:  -7, y:   3, r:  992, s: 0.97, b: 0,  o: 1 },
  { at: 1.00 * LAND, x:   0, y:   0, r: 1080, s: 1.00, b: 0,  o: 1 },
  // The hold.
  { at: 1.00,        x:   0, y:   0, r: 1080, s: 1.00, b: 0,  o: 1 },
];

/** Catmull–Rom, so the path curves through the poses instead of kinking at them. */
const spline = (a: number, b: number, c: number, d: number, t: number) => {
  const t2 = t * t;
  return 0.5 * ((2 * b) + (c - a) * t
    + (2 * a - 5 * b + 4 * c - d) * t2
    + (-a + 3 * b - 3 * c + d) * t2 * t);
};

/** The pair of poses the section is currently between, and how far between. */
const leg = () => {
  let i = 0;
  while (i < FLIGHT.length - 2 && p.value > FLIGHT[i + 1].at) i++;
  const a = FLIGHT[i];
  const b = FLIGHT[i + 1];
  return { i, t: clamp01((p.value - a.at) / (b.at - a.at)) };
};

/** Place, size: curved, because the eye reads a kink in a path as a mistake. */
const curved = (key: "x" | "y" | "s") => {
  const { i, t } = leg();
  const at = (j: number) => FLIGHT[Math.min(FLIGHT.length - 1, Math.max(0, j))][key];
  return spline(at(i - 1), at(i), at(i + 1), at(i + 2), t);
};

/** Turn, focus, presence: straight, so the spin holds one rate throughout. */
const straight = (key: "r" | "b" | "o") => {
  const { i, t } = leg();
  return FLIGHT[i][key] + (FLIGHT[i + 1][key] - FLIGHT[i][key]) * t;
};

const flight = () => ({
  transform: `translate(${curved("x")}vw, ${curved("y")}vh) rotate(${straight("r")}deg) scale(${curved("s")})`,
  filter: straight("b") > 0.15 ? `blur(${straight("b")}px)` : "none",
  opacity: straight("o"),
});

/* ------------------------------------------------------------------ words */

const title = ["Building", "the future of", "everyday healthcare"];

const body =
  "YOOJ connects qualified local doctors, pharmacies and diagnostics through a "
  + "common standard, shared infrastructure and one continuous patient record — "
  + "making everyday healthcare more accessible, consistent and trusted across "
  + "Tier 2 and Tier 3 India.";

/**
 * The three tiles. The first is the traveller, already on screen for the whole
 * section; the other two are struck in beneath it once it lands.
 */
const tiles = [
  {
    slot: "apex",
    label: ["YOOJ", "Clinic"],
    note: "Care that feels closer.",
    title: ["Care that feels", "closer."],
    body: "Qualified primary care, closer to where people live and work. YOOJ combines local doctors with a common quality standard, a better clinic experience and connected patient records.",
  },
  {
    slot: "left",
    label: ["YOOJ", "Pharmacy"],
    note: "The right medicine. Without the doubt.",
    title: ["The right medicine.", "Without the doubt."],
    body: "Genuine medicines, supplied through the YOOJ network and dispensed through a generic-first model. Better procurement means better access and better pricing — without compromising what the patient receives.",
  },
  {
    slot: "right",
    label: ["YOOJ", "Diagnostics"],
    note: "Diagnostics that stay with your care.",
    title: ["Diagnostics that stay", "with your care."],
    body: "Samples collected at YOOJ centres move through a connected diagnostic hub, with pathology, X-ray, ultrasound and cold-chain infrastructure supporting the network. Results become part of the patient’s continuing care.",
  },
] as const;

/**
 * Which tile has been opened, if any.
 *
 * The figure is the index and the panel is the page. Opening one slides the
 * reading in from the right and pushes the figure left into the remaining
 * half, so the thing that was clicked stays visible next to what it said —
 * a panel laid over the top would leave the reader with no way back to it.
 */
const open = ref<number | null>(null);
const isOpen = computed(() => open.value !== null);
const shown = computed(() => (open.value === null ? tiles[0] : tiles[open.value]));

const reveal = (i: number) => {
  // Only once the figure has landed. Mid-flight the apex tile is somewhere
  // across the frame, and a panel opened from it would have no anchor.
  if (p.value < 0.92) return;
  open.value = open.value === i ? null : i;
};

const close = () => (open.value = null);

/** The copy's own travel: it leaves upward, at the rate a page would scroll. */
const copyY = () => -beat(0.05, 0.52) * 146;

/**
 * And fades as it goes.
 *
 * Travel alone is not enough to clear it: the thread beside the paragraph is
 * over half a viewport tall, so its tail was still cutting across the top of
 * the frame long after the words had left. A fade does not depend on anyone
 * having measured the tallest part correctly.
 */
const copyFade = () => 1 - beat(0.44, 0.54);

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) { p.value = 1; return; }
  trigger = scrubThrough(root.value, (v) => (p.value = v), {
    start: "top top",
    end: "bottom bottom",
  });
  arrival = scrubThrough(root.value, (v) => (entry.value = v), {
    start: "top bottom",
    end: "top top",
  });
});

onBeforeUnmount(() => { trigger?.kill(); arrival?.kill(); });
</script>

<template>
  <section id="frontier" ref="root" class="fr">
    <div class="fr__stage">
      <div class="fr__wash ground-drift" aria-hidden="true" />

      <!-- One set of defs for every tile: the gradient lives inside each shape,
           so it turns with the shape rather than staying pinned to the screen. -->
      <svg class="fr__defs" aria-hidden="true" focusable="false">
        <defs>
          <!-- The site's dark ground, as a face: the wine the ground falls to, the
               body it is lit through, and the rose it is lit with. -->
          <linearGradient id="fr-face" x1="0.08" y1="0" x2="0.92" y2="1">
            <stop offset="0" style="stop-color: #3C010E" />
            <stop offset="0.48" style="stop-color: #8A1A3E" />
            <stop offset="1" style="stop-color: #F3A7AE" />
          </linearGradient>
        </defs>
      </svg>

      <!-- Beat one: the statement, leaving upward as the reader travels. -->
      <div class="fr__copy" :style="{ transform: `translate3d(0, ${copyY()}vh, 0)`, opacity: copyFade() }">
        <h2 class="fr__title" :aria-label="title.join(' ')">
          <span v-for="(line, i) in title" :key="i" class="fr__mask" aria-hidden="true">
            <span :style="{ transform: `translate3d(0, ${(1 - arrive(0.18 + i * 0.09, 0.74 + i * 0.09)) * 108}%, 0)` }">
              {{ line }}
            </span>
          </span>
        </h2>

        <div class="fr__note">
          <svg class="fr__thread" viewBox="0 0 60 420" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M 1 0 L 1 196 C 1 244 40 252 40 300 L 40 420"
              :style="{ strokeDashoffset: (1 - arrive(0.55, 1)) * 640 }"
            />
          </svg>
          <p class="fr__eyebrow">The YOOJ network</p>
          <p class="fr__body">{{ body }}</p>
        </div>
      </div>

      <!-- Beats two and three: the flight, and the figure it resolves into. -->
      <div class="fr__trio" :class="{ 'is-aside': isOpen }">
        <div
          v-for="(tile, i) in tiles"
          :key="tile.slot"
          class="fr__tile"
          :class="[`fr__tile--${tile.slot}`, { 'is-lead': i === 0 }]"
          :style="i === 0
            ? flight()
            : { opacity: beat(0.56 + (i - 1) * 0.05, 0.74), transform: `translateY(${(1 - beat(0.56 + (i - 1) * 0.05, 0.74)) * 14}px)` }"
          :aria-expanded="open === i"
          role="button"
          :tabindex="p > 0.82 ? 0 : -1"
          @click="reveal(i)"
          @keydown.enter.prevent="reveal(i)"
          @keydown.space.prevent="reveal(i)"
        >
          <svg class="fr__shape" :viewBox="`0 0 ${TRI_W} ${TRI_H}`" aria-hidden="true">
            <path class="fr__face" :d="TRI_PATH" />
            <path class="fr__edge" :d="TRI_PATH" />
          </svg>

          <div class="fr__plate" :style="i === 0 ? { opacity: beat(0.62, 0.76) } : undefined">
            <div class="fr__words">
              <p class="fr__label">
                <span v-for="line in tile.label" :key="line">{{ line }}</span>
              </p>
              <p class="fr__caption">{{ tile.note }}</p>
            </div>
            <span class="fr__plus" aria-hidden="true">+</span>
          </div>
        </div>
      </div>

      <!-- The reading. Off to the right until a tile is opened. -->
      <aside class="fr__panel" :class="{ 'is-open': isOpen }" :aria-hidden="!isOpen">
        <button class="fr__close" type="button" data-cursor="scale" @click="close">
          Close
          <span aria-hidden="true">&rarr;</span>
        </button>

        <div class="fr__panel-body">
          <h3 class="fr__panel-h">
            <span v-for="line in shown.title" :key="line">{{ line }}</span>
          </h3>
          <p class="fr__panel-label">{{ shown.label.join(" ") }}</p>
          <p class="fr__panel-copy">{{ shown.body }}</p>
        </div>
      </aside>

      <p class="fr__marker">{{ p > 0.84 ? "Three ways in" : "Beyond fragmented care" }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">


// Four and a half viewports of travel. The stage holds for all of it, so this
// is a duration rather than a height.
.fr {
  position: relative;
  height: 460vh;
  height: calc(var(--sv) * 460);
}

.fr__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
  background: var(--ga-bg);
}

// The light ground — the site's one pale gradient, drifting.
.fr__wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
}

.fr__defs { position: absolute; width: 0; height: 0; }

/* --------------------------------------------------------------- the copy */

.fr__copy {
  position: absolute;
  inset: 0;
  z-index: 3;
  padding: 30vh var(--gutter) 0;
  will-change: transform;
  pointer-events: none;
}

.fr__title {
  margin: 0 auto;
  max-width: 16ch;
  text-align: center;
  font-size: var(--t-h1);
  line-height: 1.02;
  letter-spacing: -0.025em;
  font-weight: 250;
  color: var(--c-indigo);
}

// Each line is masked so it can rise into view — and a mask cut to the line
// box at this leading cuts the descender off a "g". The mask is given room
// below the baseline and the same room is taken back as margin, so the lines
// keep their leading and the descenders keep their tails.
.fr__mask {
  display: block;
  overflow: hidden;
  padding: 0.08em 0 0.2em;
  margin: -0.08em 0 -0.2em;

  > span { display: block; will-change: transform; }
}

// Set off-centre and measured narrow, the way a note in a margin is. Centred
// under a centred heading it would read as a second heading.
.fr__note {
  position: relative;
  margin: clamp(9rem, 26vh, 16rem) auto 0;
  padding-left: clamp(1.4rem, 3.4vw, 3rem);
  width: min(38ch, 78vw);

  @media (min-width: 60rem) {
    margin-left: 50%;
    margin-right: 0;
  }
}

.fr__thread {
  position: absolute;
  left: 0;
  top: -0.4rem;
  width: 3.2rem;
  height: clamp(22rem, 52vh, 34rem);
  overflow: visible;

  path {
    fill: none;
    stroke: rgb(var(--rgb-action) / 0.22);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 640;
  }
}

.fr__eyebrow {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-accent-dim);
  margin-bottom: clamp(1rem, 2.4vh, 1.6rem);

  &::before {
    content: "";
    display: inline-block;
    width: 0.36em;
    height: 0.36em;
    margin-right: 0.9em;
    vertical-align: 0.18em;
    border-radius: 50%;
    background: var(--c-accent);
  }
}

.fr__body {
  font-size: var(--t-lead);
  line-height: 1.5;
  font-weight: 250;
  color: rgb(var(--rgb-ink) / 0.72);
}

/* -------------------------------------------------------------- the tiles */

.fr__trio {
  transition: transform 0.85s var(--e-out-expo), filter 0.85s var(--e-out-quart);
  --tri: clamp(10rem, 25vw, 20rem);
  --tri-h: calc(var(--tri) * 0.8660);
  // Near enough to touch. The corner arcs already cut a visible notch out of
  // each base, so any real gap on top of that reads as three loose objects
  // rather than one figure.
  --tri-gap: calc(var(--tri) * 0.015);

  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 2;
  width: calc(var(--tri) * 2 + var(--tri-gap));
  height: calc(var(--tri-h) * 2);
  transform: translate(-50%, -50%);
}

.fr__tile {
  position: absolute;
  width: var(--tri);
  height: var(--tri-h);
  // The centroid, not the box centre. A triangle spun about the middle of its
  // bounding box wobbles; spun about its balance point it turns.
  transform-origin: 50% 66.667%;

  &.is-lead { will-change: transform, filter; }
}

.fr__tile--apex  { left: 50%; top: 0; margin-left: calc(var(--tri) / -2); }
.fr__tile--left  { left: 0; top: var(--tri-h); }
.fr__tile--right { right: 0; top: var(--tri-h); }

.fr__shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.fr__face {
  fill: url(#fr-face);
  opacity: 0;
  transition: opacity var(--t-hover) var(--e-out-quart);
}

.fr__edge {
  fill: none;
  stroke: rgb(var(--rgb-action) / 0.22);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

// The traveller carries the gradient from the first frame — it is the object
// the section is about, and the other two are its argument. Except once a tile
// is open: then the fill means "this is the one you are reading", and two
// filled shapes would make that ambiguous.
.is-lead .fr__face { opacity: 1; }

.fr__trio.is-aside .is-lead .fr__face { opacity: 0; }
.fr__trio.is-aside .is-lead .fr__label,
.fr__trio.is-aside .is-lead .fr__plus { color: var(--c-indigo); }
.fr__trio.is-aside .fr__tile[aria-expanded="true"] .fr__face { opacity: 1; }
.fr__trio.is-aside .fr__tile[aria-expanded="true"] .fr__label,
.fr__trio.is-aside .fr__tile[aria-expanded="true"] .fr__plus { color: var(--c-bone); }

.fr__plate {
  position: absolute;
  left: 17%;
  right: 16%;
  bottom: 7.5%;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.9em;
}

// Holds the label and the sentence that replaces it, both anchored to the same
// baseline. Stacking them is what keeps the words in the wide part of the
// triangle — laid out in sequence, opening a caption pushed the label up into
// the point, where there is no room for it and it was clipped.
.fr__words {
  position: relative;
  flex: 1;
  min-width: 0;
}

.fr__label {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: 0.2em;
  line-height: 1.55;
  text-transform: uppercase;
  color: var(--c-indigo);
  transition: opacity var(--t-hover) var(--e-out-quart), color var(--t-hover) var(--e-out-quart);

  span { display: block; }
}

.fr__plus {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: calc(var(--t-label) * 1.5);
  line-height: 1;
  color: var(--c-indigo);
  transition: color var(--t-hover) var(--e-out-quart), transform var(--t-hover) var(--e-out-quart);
}

// Held back until the tile is asked about. The three labels are the figure;
// the sentences are what the figure is for, and showing all three at once
// turns a diagram into a paragraph.
.fr__caption {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  font-size: var(--t-body);
  line-height: 1.4;
  font-weight: 300;
  color: rgb(var(--rgb-bone) / 0.86);
  opacity: 0;
  transition: opacity var(--t-hover) var(--e-out-quart);
}

.is-lead .fr__label,
.is-lead .fr__plus { color: var(--c-bone); }

// All three are controls once the figure has landed. Pointer events stay off
// the traveller until then — a hover target moving across the frame is a trap.
.fr__tile--apex,
.fr__tile--left,
.fr__tile--right {
  pointer-events: auto;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    .fr__face { opacity: 1; }
    .fr__plus { color: var(--c-bone); transform: translateY(-2px); }
    .fr__label { opacity: 0; }
    .fr__caption { opacity: 1; }
  }
}

.fr__tile--apex:hover {
  .fr__label { opacity: 0; }
  .fr__caption { opacity: 1; }
}

// A tile that is open keeps its fill, so the panel and the shape it came from
// read as one thing.
.fr__tile[aria-expanded="true"] {
  .fr__face { opacity: 1; }
  .fr__plus { color: var(--c-bone); transform: translateY(-2px); }
}

/* --------------------------------------------------------------- the panel */

// Slides in from the right and takes a little over a third of the frame. The
// ground is the page's bone rather than white: the section is already light,
// and a true white panel on it reads as a browser dialog rather than as part
// of the same picture.
.fr__panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 6;
  width: min(42rem, 46%);
  display: grid;
  align-content: center;
  gap: clamp(1.4rem, 4vh, 2.4rem);
  padding: clamp(4rem, 11vh, 7rem) clamp(2rem, 4vw, 4.5rem);
  background: linear-gradient(200deg, #FFFFFF 0%, #FFF5F6 58%, #FEE0E2 100%);
  box-shadow: -2rem 0 5rem rgb(var(--rgb-ink) / 0.14);
  transform: translate3d(101%, 0, 0);
  visibility: hidden;
  transition:
    transform 0.85s var(--e-out-expo),
    visibility 0.85s;
  will-change: transform;

  &.is-open {
    transform: translate3d(0, 0, 0);
    visibility: visible;
  }

  @media (max-width: 60rem) {
    width: 100%;
    padding-inline: var(--gutter);
  }
}

// Below the header band. The site header is fixed and sits above every
// section's stacking context, so a close control at the top of the panel was
// printed straight through the chapter readout.
.fr__close {
  position: absolute;
  top: clamp(4.6rem, 11vh, 6.4rem);
  right: clamp(2rem, 4vw, 4.5rem);
  display: inline-flex;
  align-items: center;
  gap: 0.8em;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-indigo);
  transition: gap var(--t-hover) var(--e-out-quart), color var(--t-hover) var(--e-out-quart);

  &:hover { gap: 1.4em; color: var(--c-accent-dim); }
}

.fr__panel-body {
  display: grid;
  gap: clamp(1.1rem, 3vh, 1.9rem);
}

.fr__panel-h {
  font-size: var(--t-h2);
  line-height: 1.04;
  letter-spacing: -0.026em;
  font-weight: 250;
  color: var(--c-indigo);

  span { display: block; }
}

.fr__panel-label {
  display: flex;
  align-items: baseline;
  gap: 0.85em;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-accent-dim);

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--c-accent);
    align-self: center;
  }
}

.fr__panel-copy {
  max-width: 38ch;
  font-size: var(--t-lead);
  line-height: 1.5;
  font-weight: 250;
  color: rgb(var(--rgb-ink) / 0.72);
}

// The figure steps aside rather than hiding: it is the index the panel is
// reading from, and a reader has to be able to see which one they opened.
.fr__trio.is-aside {
  transition: transform 0.85s var(--e-out-expo), filter 0.85s var(--e-out-quart);
  transform: translate(-50%, -50%) translateX(-38%) scale(0.8);
  filter: saturate(0.55);
}

.fr__marker {
  position: absolute;
  left: var(--gutter);
  bottom: clamp(1.6rem, 4.5vh, 2.8rem);
  z-index: 4;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-accent-dim);
}

// Without motion the section is one settled frame: the statement, then the
// figure it resolves into, with every caption already open.
@media (prefers-reduced-motion: reduce) {
  .fr { height: auto; }

  .fr__stage {
    position: relative;
    height: auto;
    // Clip sideways, not both ways. The stage has to grow downward here, but
    // the reading panel is parked a full width off the right edge and
    // `visibility: hidden` does not take it out of layout — unclipped it added
    // its own width to the document and gave the whole page a sideways scroll.
    overflow-x: clip;
    overflow-y: visible;
    padding: var(--stack) 0;
  }

  // Nothing to slide in from: the panel's content is not reachable without the
  // motion that opens it, so every tile shows its own sentence instead.
  .fr__panel { display: none; }

  .fr__copy {
    position: relative;
    inset: auto;
    padding-top: 0;
    transform: none !important;
  }

  .fr__note { margin-top: clamp(2rem, 6vh, 3.5rem); }

  .fr__trio {
    position: relative;
    left: auto;
    top: auto;
    margin: clamp(5rem, 14vh, 9rem) auto 0;
    transform: none;
  }

  .fr__tile.is-lead { transform: none !important; filter: none !important; opacity: 1 !important; }
  .fr__tile { opacity: 1 !important; }
  .fr__caption { opacity: 1; transform: none; }
  .fr__tile--left .fr__face, .fr__tile--right .fr__face { opacity: 0.16; }
}

// The figure needs real width, and not because three triangles are wide: the
// labels sit inside a shape that narrows toward its point, so a tile below
// roughly 200px cannot hold two words of tracked capitals at the height they
// sit at. Stacked, each tile is as wide as the column and the problem is gone.
/**
 * Handheld: three tiles in a column, sized to the column's own height.
 *
 * At 74vw the stack came to about 780px - taller than the frame it is centred
 * in, so the third tile ran under the standing marker at the foot and the two
 * were read on top of one another. The tile is sized from what has to fit
 * instead: three of them plus their gaps, inside the band left between the
 * fixed bar and the marker.
 */
@media (max-width: 60rem) {
  .fr__trio {
    --tri: min(48vw, 13rem);
    --tri-step: calc(var(--tri-h) + 0.75rem);
    width: var(--tri);
    height: calc(var(--tri-step) * 2 + var(--tri-h));
  }

  .fr__tile--apex { left: 0; margin-left: 0; }
  .fr__tile--left { top: var(--tri-step); }
  .fr__tile--right { right: auto; left: 0; top: calc(var(--tri-step) * 2); }
  .fr__note { margin-left: auto; }
}
// Closing the panel is the only way out of it, and it measured 67 x 18.
@media (pointer: coarse) {
  .fr__close {
    min-height: 44px;
    min-width: 44px;
    padding: 0.8rem 0.7rem;
    margin: -0.8rem -0.7rem;
    display: inline-flex;
    align-items: center;
  }
}
</style>
