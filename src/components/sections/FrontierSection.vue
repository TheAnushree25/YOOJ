<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";
import { useViewport } from "../../composables/useViewport";

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

/* ---------------------------------------------------------------- devices */

const vp = useViewport();

/**
 * Below the wide layout: a phone or tablet, or a phone on its side.
 *
 * The figure is the desktop's - one figure, the words inside the tiles - sized
 * to the frame, with the tracked capitals scaled to each tile's own width so
 * "Standardised" sits inside the shape on a 320px phone too.
 */
const compact = computed(() => vp.handheld || vp.short);

/**
 * Upright, the reading comes up from the foot of the screen as a sheet, and
 * the figure lifts into the room above it; on a wide screen or a phone on its
 * side it slides in from the right, as it always has.
 */
const stacked = computed(() => vp.handheld && vp.portrait);

/**
 * The flight's sideways reach. The poses are in viewport units and were drawn
 * for a wide frame: at full reach on a phone the tile left the screen.
 */
const reach = computed(() => (compact.value ? 0.55 : 1));

const flight = () => ({
  transform: `translate(${curved("x") * reach.value}vw, ${curved("y")}vh) rotate(${straight("r")}deg) scale(${curved("s")})`,
  filter: straight("b") > 0.15 ? `blur(${straight("b")}px)` : "none",
  opacity: straight("o"),
});

/* ------------------------------------------------------------------ words */

const title = ["Building", "the future of", "everyday healthcare"];

/**
 * The three tiles. The first is the traveller, already on screen for the whole
 * section; the other two are struck in beneath it once it lands.
 *
 * Each is named for what the network has to be rather than for a service -
 * accessible, affordable, standardised - and the reading behind it says how
 * that is done. One word per tile: the shape narrows toward its point, and a
 * single tracked word is what sits in it squarely at any size.
 */
const tiles = [
  {
    slot: "apex",
    label: ["Accessible"],
    title: ["Within reach physically", "and in hours."],
    body: "A YOOJ Primary Care Centre in the Tier 3 town itself, not the district capital 40 km away. OPD, pharmacy, pathology and radiology under one roof, so a patient does one trip, not three. Extended hours for the working day.",
  },
  {
    slot: "left",
    label: ["Affordable"],
    title: ["Priced for a daily wage,", "not a salary."],
    body: "$4 consultation. Generic medicines first. $3 pathology tests, $7 imaging. Prices printed on the wall, the same for every patient, every day. No surprise bills, no upsell.",
  },
  {
    slot: "right",
    label: ["Standardised"],
    title: ["The same YOOJ,", "everywhere."],
    body: "Credentialed doctors, the same clinical protocols, the same JeevanBhar patient record, quarterly quality audits. A patient in an affiliate clinic gets the same guarantee as one in the flagship centre.",
  },
] as const;

/**
 * The reading panel is HIDDEN FOR NOW (2026-09-24): pressing a tile opens
 * nothing, and the tiles are not offered as controls. A pointer's hover still
 * lights the tile it is over and sets its word larger. The panel, its copy
 * and its styles are all still here; set this to true to bring it back.
 */
const SHOW_PANEL = false;

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

/**
 * The moment the figure is whole, and the one threshold everything keys on.
 *
 * Opening, focus and the marker used to each carry a number of their own -
 * 0.92, 0.82 and 0.84 - so for the stretch between the figure landing and the
 * last of them, the triangles stood complete, the marker said "three ways in",
 * and a press on one did nothing at all. Half a screen of scrolling where the
 * page invited a click and ignored it. They all answer to the landing now.
 */
const READY = LAND;
const ready = computed(() => p.value >= READY);

const reveal = (i: number) => {
  // Only once the figure has landed. Mid-flight the apex tile is somewhere
  // across the frame, and a panel opened from it would have no anchor.
  if (!SHOW_PANEL || !ready.value) return;
  open.value = open.value === i ? null : i;
};

const close = () => (open.value = null);

// Scrolled back up out of the finished figure, the traveller takes off again
// - and a panel still reading from it would be anchored to nothing.
watch(ready, (now) => { if (!now) close(); });

/** The copy's own travel: it leaves upward, at the rate a page would scroll. */
const copyY = () => -beat(0.05, 0.52) * 146;

/**
 * And fades as it goes, so clearing the frame does not depend on anyone
 * having measured the tallest part correctly.
 *
 * Sooner on the compact layouts, where the statement meets the header's bar
 * far earlier in the travel than it does on a wide screen. It is gone by the
 * time it gets there, rather than passing under the menu word.
 */
const copyFade = () => (compact.value ? 1 - beat(0.05, 0.2) : 1 - beat(0.44, 0.54));

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
      </div>

      <!-- Beats two and three: the flight, and the figure it resolves into. -->
      <div class="fr__trio" :class="{ 'is-aside': isOpen, 'is-live': SHOW_PANEL }">
        <div
          v-for="(tile, i) in tiles"
          :key="tile.slot"
          class="fr__tile"
          :class="[`fr__tile--${tile.slot}`, { 'is-lead': i === 0 }]"
          :style="i === 0
            ? flight()
            : { opacity: beat(0.56 + (i - 1) * 0.05, 0.74), transform: `translateY(${(1 - beat(0.56 + (i - 1) * 0.05, 0.74)) * 14}px)` }"
          :aria-expanded="SHOW_PANEL ? open === i : undefined"
          :role="SHOW_PANEL ? 'button' : undefined"
          :tabindex="SHOW_PANEL ? (ready ? 0 : -1) : undefined"
          @click="reveal(i)"
          @keydown.enter.prevent="reveal(i)"
          @keydown.space.prevent="reveal(i)"
        >
          <svg class="fr__shape" :viewBox="`0 0 ${TRI_W} ${TRI_H}`" aria-hidden="true">
            <path class="fr__face" :d="TRI_PATH" />
            <path class="fr__edge" :d="TRI_PATH" />
          </svg>

          <div class="fr__plate" :style="i === 0 ? { opacity: beat(0.62, 0.76) } : undefined">
            <p class="fr__label">
              <span v-for="line in tile.label" :key="line">{{ line }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- The reading. Off to the right until a tile is opened - or, held
           upright, below the foot of the screen. On the compact layouts it
           can be taller than the room it has, so it scrolls in itself there,
           and the page's engine leaves that scroll to the browser. Hidden for
           now: see SHOW_PANEL. -->
      <aside
        v-if="SHOW_PANEL"
        class="fr__panel"
        :class="{ 'is-open': isOpen, 'is-sheet': stacked }"
        :aria-hidden="!isOpen"
        :data-lenis-prevent="compact ? '' : undefined"
      >
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
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

// The stage holds for all of this, so it is a duration rather than a height.
// It was 460 while a paragraph was read beside the statement; with that gone
// (2026-09-24) the flight is the same flight over less travel, so the figure
// assembles that much sooner.
.fr {
  position: relative;
  height: 360vh;
  height: calc(var(--sv) * 360);
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
  // A size container, so a word can be sized against the shape it sits in -
  // on the compact layouts at rest, and everywhere when a pointer asks.
  container-type: inline-size;
  // The box is a rectangle and the tile is not: its corners either side of
  // the point are open ground. Only the shape itself answers the pointer (see
  // `.fr__face`), so the hover begins where the triangle does.
  pointer-events: none;

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
  // Hit on its fill whatever its opacity: the outlined tiles are unlit, not
  // absent, and have to be found by a pointer as much as the lit one.
  pointer-events: fill;
  transition: opacity var(--t-hover) var(--e-out-quart);

  .fr__trio.is-live & { cursor: pointer; }
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
.fr__trio.is-aside .is-lead .fr__label { color: var(--c-indigo); }
.fr__trio.is-aside .fr__tile[aria-expanded="true"] .fr__face { opacity: 1; }
.fr__trio.is-aside .fr__tile[aria-expanded="true"] .fr__label { color: var(--c-bone); }

// The word, centred on the tile's base: the widest part of the shape, and the
// one place a single tracked word sits in it squarely.
.fr__plate {
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 7.5%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/**
 * The word, and the size it grows to when a pointer asks about its tile.
 *
 * The grown size is capped against the tile's own width, in container units:
 * the tile is a quarter of the viewport on a wide screen, and at the narrow
 * end of that range "Standardised" at a fixed multiple would run into the
 * shape's sloping sides. All three words share one tile width, so the cap
 * holds them at one size together.
 *
 * Grown by its size, not by a scale: the word is set again at every step
 * rather than magnified, so it stays sharp the whole way up and anchors on its
 * own baseline. The tracking closes a little as it grows - a label's spacing
 * at a heading's size reads as loose.
 */
.fr__label {
  --fs: var(--t-label);
  --fs-up: min(calc(var(--fs) * 1.75), 7cqi);
  --track: 0.2em;

  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--fs);
  letter-spacing: var(--track);
  // Tracking trails the last letter as well; taken back out, the word is
  // centred on its ink rather than on its box.
  margin-right: calc(var(--track) * -1);
  line-height: 1.55;
  text-align: center;
  white-space: nowrap;
  text-transform: uppercase;
  color: var(--c-indigo);
  transition:
    font-size 0.7s var(--e-out-expo),
    letter-spacing 0.7s var(--e-out-expo),
    margin 0.7s var(--e-out-expo),
    color var(--t-hover) var(--e-out-quart);

  span { display: block; }
}

.is-lead .fr__label { color: var(--c-bone); }

// All three answer a pointer's hover: the tile lights, and its word grows.
// While the reading panel is shown they are controls as well (`is-live`).
//
// The hover is for a pointer only. On a touch screen it stuck to whichever
// tile had last been tapped, so a second tile read as selected beside the one
// actually open.
@mixin asked {
  .fr__face { opacity: 1; }

  .fr__label {
    --track: 0.16em;
    font-size: var(--fs-up);
    color: var(--c-bone);
  }
}

.fr__tile {
  &:focus-visible { @include asked; }

  @include hover {
    &:hover { @include asked; }
  }
}

// A tile that is open keeps its fill, so the panel and the shape it came from
// read as one thing.
.fr__tile[aria-expanded="true"] {
  .fr__face { opacity: 1; }
  .fr__label { color: var(--c-bone); }
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

  @include hover {
    &:hover { gap: 1.4em; color: var(--c-accent-dim); }
  }
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

/* ---------------------------------------------------------- compact layouts */

/**
 * Below the wide layout: the desktop's figure, fitted to the frame.
 *
 * One figure with the words inside its tiles, as on a wide screen. It used to
 * break up here - three tiles stacked in a column, each wide enough for its
 * word - and a column of three identical triangles says three separate
 * things, the opposite of the section's argument. The figure is sized to the
 * frame instead, and the tracked capitals to each tile: a tile is a size
 * container, so its word scales with the shape it has to sit in, and
 * "Standardised" stays inside on a 320px phone as on a tablet.
 *
 * The sizes live on the stage: `--k-tri` is a tile's side, `--k-x`/`--k-y`
 * the figure's centre.
 */
@include compact {
  .fr__trio {
    --tri: var(--k-tri);
    left: var(--k-x, 50%);
    top: var(--k-y, 50%);
  }

  // Nearer the corners than the wide layout sets it: at this size the word
  // needs the width of the tile's base, which is where it sits.
  .fr__plate {
    left: 8%;
    right: 8%;
    bottom: 8.5%;
  }

  // Already sized to the tile at rest, so a hover has less room to grow into.
  .fr__label {
    --fs: clamp(0.56rem, 6.8cqi, 0.8rem);
    --fs-up: min(calc(var(--fs) * 1.3), 8.6cqi);
    letter-spacing: 0.12em;
    margin-right: -0.12em;
    line-height: 1.3;
  }

  // The heading is keyed to the width so "everyday healthcare" holds one line
  // on a 320px phone - at the desktop ramp's floor it broke onto a fourth.
  .fr__copy { padding-top: clamp(4.75rem, 14vh, 8rem); }

  .fr__title { font-size: clamp(1.75rem, 8.8vw, 3.4rem); }

  .fr__panel {
    width: min(26rem, 54%);
    padding-inline: clamp(1.5rem, 4vw, 2.5rem);
  }

  .fr__close { right: clamp(1.5rem, 4vw, 2.5rem); }
}

/**
 * Upright: the figure centred, as wide as the column allows - two tiles and
 * their gap across it - and the reading as a sheet from the foot of the
 * screen.
 *
 * Opening a tile lifts the figure into the room the sheet leaves above it and
 * brings it down to size, so the tile that was opened is still in view over
 * what it says - the reason the wide layout pushes the figure aside rather
 * than covering it.
 */
@include handheld {
  @include portrait {
    .fr__stage {
      --k-tri: min(calc((100vw - var(--gutter) * 2) / 2.02), 17rem, calc(var(--vh, 1vh) * 30));
      --k-y: 50%;
    }

    .fr__trio.is-aside {
      transform: translate(-50%, -50%) translateY(calc(var(--vh, 1vh) * -27)) scale(0.55);
    }

    // A tablet's sheet is a short band at the foot of a tall screen: the
    // figure needs to give up far less of itself to clear it.
    @media (min-width: 40.01rem) {
      .fr__trio.is-aside {
        transform: translate(-50%, -50%) translateY(calc(var(--vh, 1vh) * -15)) scale(0.78);
      }
    }

    .fr__panel {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      max-height: 62%;
      align-content: start;
      gap: clamp(1rem, calc(var(--vh, 1vh) * 2.5), 1.5rem);
      // Room at the foot for the sound control, which stands over the sheet.
      padding: 3.6rem var(--gutter) calc(5rem + var(--safe-b));
      overflow-y: auto;
      overscroll-behavior: contain;
      border-radius: 1.4rem 1.4rem 0 0;
      background: linear-gradient(180deg, #FFFFFF 0%, #FFF5F6 58%, #FEE0E2 100%);
      box-shadow: 0 -1.5rem 4rem rgb(var(--rgb-ink) / 0.16);
      transform: translate3d(0, 101%, 0);

      &.is-open { transform: translate3d(0, 0, 0); }

      // The grip, which says "sheet" before the close control is read.
      &::before {
        content: "";
        position: absolute;
        top: 0.65rem;
        left: 50%;
        width: 2.5rem;
        height: 4px;
        margin-left: -1.25rem;
        border-radius: 2px;
        background: rgb(var(--rgb-ink) / 0.14);
      }
    }

    .fr__close {
      top: 1.2rem;
      right: var(--gutter);
    }

    .fr__panel-h { font-size: clamp(1.55rem, 6.4vw, 2.3rem); }

    .fr__panel-body { gap: clamp(0.8rem, calc(var(--vh, 1vh) * 2), 1.25rem); }
  }
}

/**
 * On its side: the figure centred in the band between the header's bar and
 * the foot of the frame, and moved into the left half when the reading slides
 * in over the right.
 */
@include compact {
  @include landscape {
    .fr__stage {
      --k-tri: min(calc((var(--vh, 1vh) * 100 - 5.5rem) / 1.75), 17rem, calc((100vw - var(--gutter) * 2) / 2.02));
      --k-y: calc(50% + 1.25rem);
    }

    .fr__trio.is-aside {
      transform: translate(-50%, -50%) translateX(-24vw) scale(0.85);
    }
  }
}

/**
 * A phone on its side: the statement sized to the height, which is the one
 * thing this screen does not have.
 */
@include short {
  .fr__copy { padding-top: 3.5rem; }

  .fr__title { font-size: clamp(1.75rem, 4.4vw, 2.6rem); }

  // The reading is taller than this screen: it scrolls, starting under its
  // close control, which stays below the header's bar as it does everywhere.
  // Room at the foot for the sound control, which stands over the panel's
  // lower corner; the last line scrolls clear of it.
  .fr__panel {
    align-content: start;
    padding: 6.5rem clamp(1.25rem, 4vw, 2rem) calc(4.75rem + var(--safe-b));
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .fr__panel-h { font-size: clamp(1.3rem, 3.2vw, 1.7rem); }

  .fr__panel-copy { font-size: 0.92rem; }
}

// Closing the panel is the only way out of it, and it measured 67 x 18.
@include touch {
  .fr__close {
    min-height: 44px;
    min-width: 44px;
    padding: 0.8rem 0.7rem;
    margin: -0.8rem -0.7rem;
    display: inline-flex;
    align-items: center;
  }
}

// Without motion the section is one settled frame: the statement, then the
// figure it resolves into. Last in the block, so it stands over the compact
// layouts' positions as well.
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
  // motion that opens it.
  .fr__panel { display: none; }

  .fr__copy {
    position: relative;
    inset: auto;
    padding-top: 0;
    transform: none !important;
  }

  .fr__trio {
    position: relative;
    left: auto;
    top: auto;
    margin: clamp(5rem, 14vh, 9rem) auto 0;
    transform: none;
  }

  .fr__tile.is-lead { transform: none !important; filter: none !important; opacity: 1 !important; }
  .fr__tile { opacity: 1 !important; }
  .fr__tile--left .fr__face, .fr__tile--right .fr__face { opacity: 0.16; }
}
</style>
