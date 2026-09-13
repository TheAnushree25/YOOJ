<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { ClinicScene } from "../../../webgl/ClinicScene";

/**
 * The second movement of the Aleph page: chaos, then order.
 *
 * One building held in the frame for the whole section while four things
 * happen to it. It arrives as a silhouette — the photograph is never shown as
 * a photograph, only its mask, filled with ink. A light walks in and catches
 * its edge. The building is then dissolved into the one that replaces it. And
 * finally it blooms: a cloud of motes seeded on its own mask, spreading out of
 * a single point.
 *
 * Sticky stage rather than a pinned ScrollTrigger, for the reason recorded
 * across the rest of the site: a pinned element goes `fixed`, reports an
 * offset of zero, and re-measures its start as the top of the document on any
 * refresh landing while the pin is applied.
 */

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const p = ref(0);

let trigger: ReturnType<typeof scrubThrough> = null;
let scene: ClinicScene | null = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

/**
 * Two statements in one place.
 *
 * The heading is a pair of words stacked, and which of the two is the live one
 * turns over mid-section — the reference sets the spent word in a tint and the
 * live one in full ink, so the turn happens in weight rather than by swapping
 * the text out.
 */
const chapters = [
  {
    lead: "Clear",
    trail: "Paths",
    tail: "Ahead",
    copy: "We seek to illuminate what is already there, mapping a practice to the shape of the people it actually serves.",
  },
  {
    lead: "Chaos",
    trail: "Order",
    tail: "",
    copy: "We apply the same instruments to a room as to a week, and turn what they find into something a clinic can be rebuilt around.",
  },
] as const;

/** Which statement is live. The turn is the moment the building is replaced. */
const chapter = () => (p.value < 0.5 ? 0 : 1);

onMounted(() => {
  if (!root.value || !canvas.value) return;

  scene = new ClinicScene(canvas.value, {
    before: "/aleph/clinic-before.png",
    after: "/aleph/clinic-after.png",
    // The bloom starts where the fascia meets the frame's left third, which is
    // the clinic's equivalent of the reference's temple.
    origin: [0.36, 0.7],
    motes: 11000,
    ink: "#0C1330",
    glow: "#8FE3F5",
  });
  scene.start();
  window.addEventListener("resize", scene.resize);

  if (prefersReduced()) {
    p.value = 0.72;
    scene.setProgress(0.72);
    return;
  }

  trigger = scrubThrough(root.value, (v) => {
    p.value = v;
    scene?.setProgress(v);
  }, { start: "top top", end: "bottom bottom" });
});

onBeforeUnmount(() => {
  trigger?.kill();
  if (scene) window.removeEventListener("resize", scene.resize);
  scene?.dispose();
});
</script>

<template>
  <section id="aleph-chaos" ref="root" class="ac">
    <div class="ac__stage">
      <!-- The building. Held in the frame for the section's whole travel. -->
      <div class="ac__plate">
        <canvas ref="canvas" />
      </div>

      <!-- The statement, left, turning over as the building is replaced. -->
      <div class="ac__say" :style="{ opacity: beat(0.04, 0.12) }">
        <h2 class="ac__h">
          <span
            v-for="(c, i) in chapters"
            :key="i"
            class="ac__pair"
            :style="{
              opacity: i === chapter() ? 1 : 0,
              transform: `translate3d(0, ${(i - chapter()) * 1.2}rem, 0)`,
            }"
            :aria-hidden="i !== chapter()"
          >
            <span class="is-lead">{{ c.lead }}</span>
            <span class="is-trail">{{ c.trail }}</span>
            <span v-if="c.tail" class="is-trail">{{ c.tail }}</span>
          </span>
        </h2>

        <p class="ac__copy">
          <span
            v-for="(c, i) in chapters"
            :key="i"
            :style="{ opacity: i === chapter() ? 1 : 0 }"
            :aria-hidden="i !== chapter()"
          >{{ c.copy }}</span>
        </p>
      </div>

      <p class="ac__label">From chaos to clarity</p>
      <p class="ac__step">{{ String(chapter() + 2).padStart(2, "0") }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Five viewports: the light, the swap and the bloom each need room to be read
// as a separate thing happening to one building.
.ac {
  position: relative;
  height: 500vh;
  height: calc(var(--vh, 1vh) * 500);
}

.ac__stage {
  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  overflow: hidden;
  isolation: isolate;
}

// Right of centre and running off the bottom edge, as the reference's head
// does — the building is a presence in the frame, not an illustration in it.
.ac__plate {
  position: absolute;
  right: 0;
  bottom: -6%;
  width: min(66%, 60rem);
  height: 104%;
  z-index: 1;

  canvas { width: 100%; height: 100%; display: block; }

  @media (max-width: 60rem) {
    right: -10%;
    width: 108%;
    opacity: 0.5;
  }
}

/* ------------------------------------------------------------- the words */

.ac__say {
  position: absolute;
  left: var(--gutter);
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: min(26rem, 52vw);

  @media (max-width: 60rem) { width: min(30rem, 86vw); }
}

// The two statements occupy one box and cross over inside it, so nothing in
// the column moves when the section turns.
.ac__h {
  position: relative;
  display: grid;
  min-height: 11rem;
  font-size: var(--ta-payoff);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;
}

.ac__pair {
  grid-area: 1 / 1;
  display: grid;
  transition:
    opacity 0.8s var(--e-out-quart),
    transform 0.9s var(--e-out-expo);

  .is-lead { color: var(--ga-ink); }
  // The spent half of the pair, set in a tint rather than removed: the
  // reference keeps both words present and lets weight say which is live.
  .is-trail { color: rgb(60 1 14 / 0.42); }
}

.ac__copy {
  position: relative;
  display: grid;
  margin-top: clamp(1.2rem, 3.4vh, 2rem);
  min-height: 5.5rem;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  color: var(--ga-ink);

  > span {
    grid-area: 1 / 1;
    transition: opacity 0.7s var(--e-out-quart);
  }
}

.ac__label {
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

.ac__step {
  position: absolute;
  right: var(--gutter);
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  color: rgb(60 1 14 / 0.5);
  font-variant-numeric: tabular-nums;
}

// Without motion the section is one settled frame, held where the building has
// been replaced and the bloom is open.
@media (prefers-reduced-motion: reduce) {
  .ac { height: auto; }

  .ac__stage {
    position: relative;
    height: auto;
    min-height: 80vh;
    padding: var(--stack) 0;
  }
}
</style>
