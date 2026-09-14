<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";
import { SEED_FIELD, SEED_INK, SEED_RINGS } from "../../lib/seed";
import StepRing from "../ui/StepRing.vue";

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
  "500 million working Indians",
  "deserve better healthcare.",
];

/**
 * Three passages, read in turn over the dome once it has risen.
 *
 * Each arrives a line at a time in the same low-left slot, holds, and leaves
 * before the next takes its place — so the slot reads as one voice saying
 * three things rather than three blocks stacked. Every entry has to fit the
 * measure on one line: the mask that reveals a line clips whatever sits below
 * it, so an entry long enough to wrap slides up as a two-line block with its
 * own second line cut in half for the length of the reveal.
 *
 * `at` is where a passage begins arriving and `to` where it has gone.
 */
const passages = [
  {
    at: 0.28, to: 0.45,
    lines: ["Not someday.", "Not only when things get serious.", "Every day."],
  },
  {
    at: 0.45, to: 0.65,
    lines: [
      "YOOJ exists to make quality",
      "primary healthcare accessible,",
      "affordable and consistent",
      "across Tier 2 and Tier 3 India.",
    ],
  },
  {
    at: 0.65, to: 0.87,
    lines: [
      "Primary healthcare operates in fragments,",
      "with every visit treated as a separate event,",
      "leaving patients to carry their history",
      "from doctor to pharmacy to diagnostics",
      "and back again.",
    ],
  },
] as const;

/** Which passage the ring counts, and how far through it the reader is. */
const step = () => {
  const i = passages.findIndex((x) => p.value >= x.at && p.value < x.to);
  if (i >= 0) return { index: i, progress: span(passages[i].at, passages[i].to) };
  if (p.value >= 0.87) return { index: 3, progress: span(0.87, 1) };
  return { index: 0, progress: 0 };
};

/** A line's arrival, 0 to 1: it rises through its mask and clears from blur. */
const lineIn = (pass: { at: number }, i: number) =>
  beat(pass.at + 0.01 + i * 0.008, pass.at + 0.06 + i * 0.008);

/**
 * The rings: contours first, the flower last.
 *
 * Through the three passages the eight outer rings hang close around the
 * centre and drift with the reader's travel — spreading a little, turning a
 * little, each at a slightly different rate so the cluster never moves as one
 * piece. It reads as contour lines shifting under the words, not as a drawing
 * waiting to finish. The hub is not there yet.
 *
 * At the turn they glide out to their places, the arrangement squares up, and
 * the hub comes in at full weight: the figure from the gate, completed, and
 * only here. With `resolve` at 1 every term below collapses to the ring's own
 * offset, so the finished figure is the gate's to the unit.
 */
const ring = (i: number) => {
  const o = SEED_RINGS[i] ?? [0, 0];
  const drift = beat(0.30, 0.87);
  const resolve = beat(0.87, 0.95);
  if (i === 0) return { opacity: resolve, transform: "translate(0px, 0px)" };

  const own = 0.8 + 0.4 * ((i * 0.618) % 1);
  const reach = (0.22 + drift * 0.38) * own;
  const turn = (1 - resolve) * (0.85 - drift * 0.55) * (0.7 + 0.6 * ((i * 0.382) % 1));
  const r = reach + (1 - reach) * resolve;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const x = (o[0] * c - o[1] * sn) * r;
  const y = (o[0] * sn + o[1] * c) * r;
  return {
    opacity: beat(0.30 + i * 0.012, 0.44 + i * 0.012) * SEED_INK,
    transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`,
  };
};

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
const crown = () => (24 + beat(0.18, 0.34) * 40) * (1 - beat(0.34, 0.46));

/**
 * The dome's offset, in percent of its own height.
 *
 * It climbs from below the frame to flush with the top, then keeps going by a
 * little. The extra lift is what closes the corner wedges while the crown is
 * still curved, so the ground fills in continuously instead of the corners
 * snapping square at the end.
 */
/**
 * The dome's own density.
 *
 * It cannot be one number. While the arc is climbing it has the pale panel
 * behind it, and anything thin there tints bone to grey instead of reading as
 * night coming up; once the panel has gone it has the field behind it, and
 * that same density smothers the thing it is supposed to be revealing. So it
 * is dense for the rise and lifts afterwards.
 */
const domeVeil = () => 1 - beat(0.36, 0.48) * 0.12;

const domeY = () => (1 - beat(0.18, 0.32)) * 96 - beat(0.30, 0.42) * 16;


/**
 * The turn the section ends on, word by word.
 *
 * Set as one string and split here rather than hand-broken into lines: this
 * one lights a word at a time as the reader scrolls, so the unit is the word
 * and the line breaks are the browser's business.
 */
const turn = (
  "YOOJ moves beyond fragmented care, connecting the doctors, pharmacies, "
  + "diagnostics and records that already exist into one trusted healthcare network."
).split(" ");

/** A word's brightness in the closing beat. The edge runs ahead of itself. */
const told = (i: number) => {
  const head = beat(0.89, 0.985) * (turn.length * 1.2);
  return 0.16 + Math.min(1, Math.max(0, (head - i) / (turn.length * 0.2))) * 0.84;
};


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
      <!-- The pale ground. Held on its own clock, not the statement's: the
           dome has to rise *against* something light, which is the whole read
           of the beat. Faded with the words, the frame went dark the moment
           they left and the arc then arrived on a ground it could not be seen
           against. This leaves once the dome covers the frame anyway. -->
      <div class="rc__ground ground-drift--slow" :style="{ opacity: 1 - beat(0.22, 0.30) }" aria-hidden="true" />

      <!-- Beat one: the statement, present from the first frame, rising a line
           at a time on the pale panel. -->
      <div class="rc__panel" :style="{ opacity: 1 - beat(0.20, 0.26) }">
        <p class="label rc__eyebrow">Our belief</p>
        <p class="rc__statement">
          <span v-for="(line, i) in statement" :key="i" class="rc__line">
            <span :style="{ transform: `translate3d(0, ${(1 - beat(0.005 + i * 0.03, 0.12 + i * 0.03)) * 110}%, 0)` }">
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
            '--dome-veil': domeVeil(),
          }"
        >
        </div>
      </div>

      <!-- The bloom the section ends on, rising from the lower right as the
           turn is read. -->
      <div
        class="rc__bloom"
        :style="{ opacity: beat(0.8, 0.96), transform: `scale(${(0.6 + beat(0.8, 1) * 0.8).toFixed(3)})` }"
        aria-hidden="true"
      />

      <!-- The reference's numbered ring, high in the frame: which passage is
           being read, with an arc drawing round it as the reader goes. -->
      <StepRing
        class="rc__ring"
        :index="step().index"
        :total="4"
        :progress="step().progress"
        light
        :style="{ opacity: beat(0.30, 0.36) }"
      />

      <!-- Beats two to four: the three passages, low and left over the dome,
           each arriving a line at a time and gone before the next. They share
           one slot, so each lands where the last stood. -->
      <div
        v-for="(pass, n) in passages"
        :key="n"
        class="rc__argument"
        :style="{ opacity: beat(pass.at, pass.at + 0.05) - beat(pass.to - 0.04, pass.to) }"
        :aria-hidden="p < pass.at || p > pass.to"
      >
        <p class="rc__argument-copy">
          <span v-for="(line, i) in pass.lines" :key="i" class="rc__line">
            <span :style="{ transform: `translate3d(0, ${(1 - lineIn(pass, i)) * 110}%, 0)`, filter: `blur(${((1 - lineIn(pass, i)) * 6).toFixed(2)}px)` }">
              {{ line }}
            </span>
          </span>
        </p>
      </div>

      <!-- The gate's nine rings, at the gate's size and ink. Through the
           passages they are contours — close, faint, drifting with the
           scroll, no hub. At the turn they resolve into the figure the site
           opened with, and the copy arrives beside it. See ring(). -->
      <div class="rc__turn" :style="{ opacity: beat(0.30, 0.38) }">
        <svg class="rc__seed" :viewBox="`0 0 ${SEED_FIELD.w} ${SEED_FIELD.h}`" aria-hidden="true">
          <!-- Struck from the centre and carried out to their places, exactly
               as the gate opens. Same figure, same gesture, second time. -->
          <circle
            v-for="(_, i) in SEED_RINGS"
            :key="i"
            :cx="SEED_FIELD.cx" :cy="SEED_FIELD.cy" :r="SEED_FIELD.r"
            :class="{ 'rc__hub': i === 0 }"
            :style="ring(i)"
          />
        </svg>

        <!-- Gated on the turn. The container is up from the dome beat now,
             for the rings; the words belong to the turn, and before it they
             must not show — they sit at a dim base until they are read, and
             dim is not invisible. -->
        <p class="rc__turn-copy" :style="{ opacity: beat(0.87, 0.91) }" :aria-hidden="p < 0.87">
          <span v-for="(w, i) in turn" :key="i" :style="{ opacity: told(i) }">{{ `${w} ` }}</span>
        </p>
      </div>

      <!-- The standing marker, swapping its word as the argument turns. -->
      <p class="label rc__marker" :style="{ opacity: beat(0.26, 0.34) }">
        {{ p > 0.88 ? "YOOJ" : "Reconnecting healthcare" }}
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Five viewports of travel. The stage inside holds for all of it, so this is a
// duration rather than a height.
// Eleven viewports for five beats — the statement on the pale panel, three
// passages over the risen dome, and the turn at the end. At seven the
// passages spent most of their slice arriving and leaving; each now holds
// still for the better part of a viewport of travel once its lines are in.
.rc {
  position: relative;
  height: 1080vh;
  height: calc(var(--vh, 1vh) * 1080);
}

.rc__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
  // No ground of its own. The pale panel below carries the light beat, and
  // everything after it is the field showing through the dome — an opaque
  // stage here meant the dome was a tint over bone rather than over the
  // field, which is why the whole beat washed out to pink.
}

.rc__ground {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
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
  // The dome is this section's dark ground: the site's wine gradient, on a
  // layer of its own so the geometry above it is not faded with it. It used
  // to be a black tint over the shared field, which was the one place on the
  // page the ground went to near-black rather than to wine. It rises opaque —
  // a thin tint over the pale panel reads as bone going grey, not as night
  // coming up — and eases back a little once the panel has gone.
  will-change: transform;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--ground-dark);
    background-size: 190% 190%;
    background-position: 70% 62%;
    animation: ground-poses 12s var(--e-in-out-quad) -6s infinite;
    opacity: var(--dome-veil, 1);
  }
}

.rc__argument {
  position: absolute;
  left: var(--gutter);
  bottom: clamp(5rem, 14vh, 8rem);
  z-index: 3;
  // In ch so the measure tracks the type size, and capped against the viewport
  // so the guarantee that each line fits survives a narrow screen. Fifty-two:
  // the longest line is forty-six characters of proportional type, and at
  // forty-four it broke "event," onto a line of its own.
  max-width: min(52ch, calc(100vw - var(--gutter) * 2));
}

.rc__argument-copy {
  font-size: var(--t-lead);
  line-height: 1.45;
  font-weight: 250;
  color: var(--c-bone);
}

// The closing bloom, frame-relative and over the dome, under the words.
.rc__bloom {
  position: absolute;
  right: -36vw;
  bottom: -40vw;
  width: 84vw;
  height: 84vw;
  z-index: 2;
  border-radius: 50%;
  transform-origin: 50% 50%;
  // Strong at the centre and wide: this is the light the section ends on,
  // and it has to be read as a dawn coming up under the words, not a tint.
  background: radial-gradient(circle at 50% 50%,
    rgb(255 236 238 / 0.82) 0%, rgb(254 200 205 / 0.5) 22%, rgb(243 167 174 / 0.24) 42%, transparent 64%);
  mix-blend-mode: screen;
  pointer-events: none;
  will-change: transform, opacity;
}

// High and a little left of centre, as the reference sets it — clear of the
// copy in the lower left and of the contours on the right.
.rc__ring {
  --ring-size: 3.4rem;
  position: absolute;
  left: 46%;
  top: 22%;
  z-index: 4;
  transition: opacity 0.5s var(--e-out-quart);

  @media (max-width: 60rem) {
    left: auto;
    right: var(--gutter);
    top: 16%;
  }
}

@media (prefers-reduced-motion: reduce) {
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

// Sized by the gate's own rule — off the height as much as the width, so on
// a wide screen the figure is the same figure the reader met on arrival, at
// the same size, and not a wider crop of it.
.rc__seed {
  grid-row: 1;
  grid-column: 1;
  justify-self: center;
  width: min(58vw, 99vh, 58rem);
  // The reset caps every svg at its container, and this one's container is a
  // grid column half the frame wide. Without this the figure came out at
  // three-quarters of the gate's size on a laptop screen.
  max-width: none;
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

  // Against the right edge rather than centred in the column: at the gate's
  // size the figure is wider than the column, and centred there its far ring
  // ran off the frame while its near one reached across into the copy. Ended,
  // it is whole, and clear of the passage at the foot of the frame.
  @media (min-width: 60rem) {
    grid-column: 2;
    justify-self: end;
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
  .rc__stage { position: relative; height: auto; min-height: 100vh; }
  .rc__panel { display: none; }
  .rc__dome { transform: translateX(-50%) !important; }
}

</style>
