<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import ActionButton from "../ui/ActionButton.vue";
import SplitHeading from "../ui/SplitHeading.vue";
import { ScrollTrigger, prefersReduced } from "../../composables/useMotion";
import { usePointer } from "../../composables/usePointer";
import { JeevanCard } from "../../webgl/JeevanCard";

/**
 * The fifth movement: the instrument, named — and handed over.
 *
 * Everything before this argues that care is in pieces. This is the one
 * section that says what we built, and the card is the thing itself: it falls
 * in from above the heading, turning over as it comes and out of focus until
 * it is close, and lands beside the copy at the angle a card is held at. From
 * then on it floats, leans toward the reader's pointer, and turns slowly under
 * the light while the paragraph is read.
 *
 * Real geometry, not a picture of a card: a slab of wine metal with the
 * artwork on its face, lit by a studio environment so the light actually moves
 * across it (see webgl/JeevanCard). The layout owns where it lands - the slot
 * below - and the scene owns how it gets there.
 *
 * Light ground, and the last one before the close. The page runs pale, deep,
 * pale, deep; arriving here from the deep of the section before is what makes
 * the closing section land as an ending rather than as another chapter.
 */

const CARD = "/jeevanbhar/card.webp";

const root = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const slot = ref<HTMLElement | null>(null);

const reduced = prefersReduced();
/** The still stands in until the scene has its artwork - and instead of it,
    for a reader who asked for less motion, or a browser without WebGL. */
const live = ref(false);

const { x, y } = usePointer();

let card: JeevanCard | null = null;
let fall: ScrollTrigger | null = null;
let read: ScrollTrigger | null = null;
let watcher: IntersectionObserver | null = null;

/** Where the card lands, measured off the layout rather than guessed. */
const measure = () => {
  if (!card || !canvas.value || !slot.value) return;
  const c = canvas.value.getBoundingClientRect();
  const s = slot.value.getBoundingClientRect();
  card.setSlot(s.left - c.left + s.width / 2, s.top - c.top + s.height / 2, s.width, s.height);
  card.resize();
};

onMounted(() => {
  if (reduced || !canvas.value || !slot.value || !root.value) return;
  try {
    card = new JeevanCard(canvas.value, CARD, () => {
      live.value = true;
      measure();
    });
  } catch {
    // No WebGL: the still is already there.
    return;
  }
  const scene = card;
  measure();
  scene.settle(0);

  window.addEventListener("resize", measure);
  ScrollTrigger.addEventListener("refresh", measure);

  fall = ScrollTrigger.create({
    trigger: slot.value,
    start: "top bottom",
    end: "center 58%",
    onUpdate: (self) => scene.setFall(self.progress),
    invalidateOnRefresh: true,
  });
  read = ScrollTrigger.create({
    trigger: slot.value,
    start: "center 58%",
    end: "center 8%",
    onUpdate: (self) => scene.setRead(self.progress),
    invalidateOnRefresh: true,
  });

  // Drawn only while the section is near the screen: it floats and answers the
  // pointer, so it has frames to draw the whole time it is in view.
  watcher = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? scene.start() : scene.stop()),
    { rootMargin: "25% 0px" },
  );
  watcher.observe(root.value);
});

watch([x, y], () => card?.setPointer(x.value, y.value));

onBeforeUnmount(() => {
  fall?.kill();
  read?.kill();
  watcher?.disconnect();
  window.removeEventListener("resize", measure);
  ScrollTrigger.removeEventListener("refresh", measure);
  card?.dispose();
  card = null;
});

const title = ["The future", "of everyday", "healthcare"];

const body =
  "JeevanBhar is YOOJ’s primary-care membership — a lifetime health identity "
  + "that connects every visit, prescription and diagnostic result across the YOOJ "
  + "network. Issued free at your first visit, it works offline and travels with "
  + "you from one YOOJ centre to another.";
</script>

<template>
  <section id="solution" ref="root" class="sl" :class="{ 'is-live': live }">
    <div class="sl__wash ground-drift" aria-hidden="true" />

    <!-- The card's room: the whole section, so it can come in over the top
         edge, and behind the type, so it passes under the heading. -->
    <canvas ref="canvas" class="sl__canvas" aria-hidden="true" />

    <div class="sl__inner">
      <SplitHeading
        as="h2"
        class="sl__h"
        mode="lines"
        :lines="title"
      />

      <div class="sl__row">
        <!-- Where the card lands. It holds the space on every breakpoint, and
             carries the still the scene stands in for. -->
        <div ref="slot" class="sl__slot">
          <img
            class="sl__still"
            src="/jeevanbhar/card.webp"
            alt="The JeevanBhar card: YOOJ Care, member number YOOJ56789012."
            loading="lazy"
            decoding="async"
            draggable="false"
          >
        </div>

        <div class="sl__note">
          <p v-reveal class="sl__eyebrow">Meet JeevanBhar</p>
          <p v-reveal="120" class="sl__body">{{ body }}</p>
          <div v-reveal="240" class="sl__act">
            <ActionButton label="Discover solution" href="#contact" variant="solid" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
/**
 * Laid over the end of the section above it, and faded in.
 *
 * Both sections stand on the same drifting blush, but each paints it across
 * its own box - so where two of them meet the gradient is at a different
 * point in itself on either side of the join, and the seam shows as a step
 * across the full width. (It did not arise before: a dark section always sat
 * between these two.) Pulled up over the tail of the one above and masked, its
 * ground arrives out of that one instead of against it, and the join has no
 * edge at all. The card's entrance is under the same mask, which only helps:
 * it fades in as it drops through.
 */
.sl {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin-top: calc(var(--vh, 1vh) * -14);
  padding: clamp(7rem, 20vh, 14rem) 0 clamp(12rem, 34vh, 24rem);
  background: var(--ga-bg);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 calc(var(--vh, 1vh) * 14));
  mask-image: linear-gradient(to bottom, transparent 0, #000 calc(var(--vh, 1vh) * 14));
}

// The light ground — the site's one pale gradient, drifting.
.sl__wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
}

.sl__inner {
  position: relative;
  z-index: 1;
}

.sl__h {
  margin-inline: auto;
  max-width: 18ch;
  padding-inline: var(--gutter);
  text-align: center;
  font-size: var(--t-h1);
  line-height: 1.02;
  letter-spacing: -0.028em;
  font-weight: 250;
  color: var(--c-indigo);
}

// The card's room. Behind the type and above the ground; it takes no events,
// so the copy and the control are reached straight through it.
.sl__canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  pointer-events: none;
  // The scene fades up once its artwork is on the card; the still fades out
  // under it, so neither is ever missing.
  opacity: 0;
  transition: opacity 0.6s var(--e-out-quart);

  .is-live & { opacity: 1; }
}

.sl__inner { position: relative; z-index: 2; }

// The card on the left, the note on the right, both against the centre line.
// Stacked below: a card the width of the column, then the note under it.
.sl__row {
  margin-top: clamp(3.5rem, 11vh, 7rem);
  padding-inline: var(--gutter);
  display: grid;
  justify-items: center;
  gap: clamp(2.5rem, 7vh, 4.5rem);

  @media (min-width: 60rem) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    justify-items: stretch;
    padding-inline: 0;
    gap: 0;
  }
}

// Empty space with the card's proportions: the scene measures it and lands
// there, so the layout decides where the card sits at every width.
.sl__slot {
  width: min(30rem, 74vw);
  aspect-ratio: 1463 / 776;

  @media (min-width: 60rem) {
    justify-self: center;
    width: min(32rem, 38vw);
  }
}

// The still: what stands there before the scene has its artwork, without
// WebGL, and for a reader who asked for less motion. Set at the angle the
// scene rests at, so the two are the same picture.
.sl__still {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform: perspective(1400px) rotateY(-16deg) rotateX(5deg);
  filter: drop-shadow(0.6rem 1.1rem 1.8rem rgb(var(--rgb-ink) / 0.22));
  transition: opacity 0.6s var(--e-out-quart);

  .is-live & { opacity: 0; }
}

// Set against the centre line rather than under it. A centred paragraph beneath
// a centred heading reads as a caption; offset, it reads as a note the heading
// is pointing at.
.sl__note {
  width: min(38ch, 84vw);

  @media (min-width: 60rem) {
    width: min(38ch, 42vw);
    padding-inline: 0;
  }
}

.sl__eyebrow {
  margin-bottom: clamp(1.1rem, 2.8vh, 1.9rem);
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-accent-dim);

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

.sl__body {
  font-size: var(--t-lead);
  line-height: 1.5;
  font-weight: 250;
  color: rgb(var(--rgb-ink) / 0.74);
}

.sl__act { margin-top: clamp(1.8rem, 5vh, 3rem); }
</style>
