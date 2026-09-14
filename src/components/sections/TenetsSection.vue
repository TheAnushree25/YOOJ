<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../composables/useMotion";

/**
 * The fourth movement: a count held still while its parts go past.
 *
 * One enormous numeral stands in the left half and barely moves; the six things
 * it counts scroll up the right. The whole effect is the difference in rate —
 * the reader travels the length of a list and the number is still there, which
 * is a more useful thing to say about a set of principles than any transition
 * between them would be.
 *
 * Ordinary document scroll, not a sticky stage. There is nothing here that has
 * to be choreographed against a timeline: the column holds itself in the frame
 * with `position: sticky`, and the only scrubbed value is the numeral's slow
 * drift against it. A held frame would have meant inventing a reason for the
 * list to arrive in beats, and the list has no beats — it is a list.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

/**
 * The numeral's drift, in viewport heights.
 *
 * It rides up through the column over the section's travel rather than sitting
 * dead centre. Sticky alone reads as a graphic pasted to the viewport; a rate
 * that is slower than the list but not zero reads as depth.
 */
const drift = () => 13 - p.value * 42;

const intro =
  "One transformation. Every YOOJClinic. That’s how YOOJ builds a network "
  + "without erasing the people already in it.";

/**
 * Placeholder copy, written to the right length rather than to the right words.
 * Each entry is a label of two or three tracked words and a paragraph of four
 * to five lines at this measure, which is what the layout was built against.
 */
const tenets = [
  {
    k: "01 — Refurbish",
    p: "Make the space worthy of care. We physically upgrade the clinic — from signage and interiors to waiting areas, shelving and essential equipment.",
  },
  {
    k: "02 — Rewire",
    p: "Connect what was always apart. We connect the clinic to YOOJ’s infrastructure — JeevanBhar, the generic medicine supply chain and diagnostic network.",
  },
  {
    k: "03 — Rebrand",
    p: "Keep the name. Add the promise. The doctor’s identity and community legacy stay. YOOJ adds a recognizable standard patients can trust.",
  },
  {
    k: "04 — Revive",
    p: "Make a surviving clinic thrive. Better systems. Better access. Better patient continuity. A clinic that was surviving becomes one that can grow. Better for the patient. Better for the doctor.",
  },
];

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) { p.value = 0.5; return; }
  // The same window the column is stuck for, so the drift starts when the
  // numeral arrives in the frame and ends as it leaves.
  trigger = scrubThrough(root.value, (v) => (p.value = v), {
    start: "top top",
    end: "bottom bottom",
  });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="tenets" ref="root" class="tn">

    <!-- Runs down the seam between the count and the list, curving across to
         meet the column. The same thread the section above it hands over. -->
    <svg class="tn__thread" viewBox="0 0 120 1000" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 4 0 L 4 250 C 4 360 116 380 116 500 L 116 1000" />
    </svg>

    <div class="tn__grid">
      <div class="tn__count">
        <span class="tn__numeral" :style="{ transform: `translate3d(0, ${drift()}vh, 0)` }">4</span>
      </div>

      <div class="tn__body">
        <h2 class="tn__h">The 4 R’s</h2>
        <p class="tn__intro">{{ intro }}</p>

        <ol class="tn__list">
          <li v-for="t in tenets" :key="t.k" v-reveal="80" class="tn__item">
            <p class="tn__label">{{ t.k }}</p>
            <p class="tn__copy">{{ t.p }}</p>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Deliberately no `overflow` here. The count column is sticky, and an ancestor
// with a clipped overflow becomes its scroll container — the numeral would then
// hold still against a box that never scrolls and never stick at all. The
// clipping the drift needs is on the column itself, where it belongs.
.tn {
  position: relative;
  isolation: isolate;
}


.tn__thread {
  position: absolute;
  left: 43%;
  top: 0;
  z-index: 2;
  width: 6.4%;
  height: min(62%, 62rem);
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke: rgb(var(--rgb-bone) / 0.22);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

.tn__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

// Holds itself in the frame for the length of the list. `align-self: start` is
// what keeps the grid from stretching it to the row's full height, which would
// leave nothing for it to stick within.
.tn__count {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  display: grid;
  place-items: center;
  // Sits right of its column's centre, where the reference puts it — far
  // enough off the edge to read as placed rather than as a margin decoration.
  padding-left: 7%;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}

.tn__numeral {
  font-size: clamp(11rem, min(50vw, 94vh), 60rem);
  line-height: 0.78;
  font-weight: 200;
  letter-spacing: -0.04em;
  // Pale at the shoulder, near-white where the curve comes back round — the
  // glyph is large enough that a flat fill reads as a printed shape.
  background: linear-gradient(154deg, #FEB3B8 0%, #FEDCDE 46%, #FFF5F6 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  will-change: transform;
}

// The tail matters as much as the head. The next section is a sticky stage
// that slides its own ground up from below, so whatever is still on screen
// when that edge arrives reads as belonging to it — the last principle was
// being cut in half by a horizon that was not its own. Half a viewport of
// room after it means the column has left before the edge appears.
.tn__body {
  padding: clamp(5rem, 16vh, 11rem) var(--gutter) clamp(11rem, 46vh, 26rem)
    clamp(0.75rem, 2.2vw, 3rem);
}

.tn__h {
  font-size: var(--t-h1);
  line-height: 1;
  letter-spacing: -0.03em;
  font-weight: 250;
  color: var(--c-bone);
}

// A step above the body ladder and below the headings: the reference sets this
// paragraph noticeably larger than the list copy, and it is the only thing
// keeping the top of the column from reading as another list entry.
.tn__intro {
  margin-top: clamp(1rem, 2.6vh, 1.8rem);
  max-width: 26ch;
  font-size: clamp(1.15rem, 1.75vw, 1.75rem);
  line-height: 1.34;
  font-weight: 250;
  color: var(--c-bone);
}

// Indented past the heading. The count, the statement and the list each start
// at their own left edge, which is what gives the column its stagger.
.tn__list {
  margin-top: clamp(4.5rem, 14vh, 9rem);
  padding-left: clamp(1rem, 7vw, 8rem);
  display: grid;
  gap: clamp(2.6rem, 7vh, 4.6rem);
  list-style: none;
}

.tn__item { max-width: 40ch; }

.tn__label {
  display: flex;
  align-items: baseline;
  gap: 0.85em;
  margin-bottom: clamp(0.7rem, 1.8vh, 1.15rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-bone);

  &::before {
    content: "";
    flex: none;
    width: 0.42em;
    height: 0.42em;
    border-radius: 50%;
    background: var(--c-accent);
  }
}

.tn__copy {
  font-size: var(--t-lead);
  line-height: 1.48;
  font-weight: 250;
  color: rgb(var(--rgb-bone) / 0.82);
}

// Below this the two columns stop being two columns: the numeral would have to
// shrink past the point where it reads as the count, so it goes behind the
// words as a watermark instead of beside them.
@media (max-width: 60rem) {
  .tn__grid { grid-template-columns: minmax(0, 1fr); }

  // Both in the one cell, so the count sits behind the words rather than above
  // them, and stays sticky — parked at the section's top it was gone after the
  // first screenful, which is the one thing the numeral must not do.
  .tn__count,
  .tn__body { grid-row: 1; grid-column: 1; }

  .tn__count {
    z-index: 0;
    padding-left: 0;
    opacity: 0.13;
  }

  .tn__body { position: relative; z-index: 1; }

  .tn__numeral {
    font-size: min(92vw, 56vh);
    // Held still here. The drift is a second rate against a list beside it;
    // behind the list it just pulls the watermark off the top of the frame.
    transform: none !important;
  }

  .tn__thread { display: none; }

  .tn__body { padding-inline: var(--gutter); }
  .tn__list { padding-left: 0; }
}
</style>
