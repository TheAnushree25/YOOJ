<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import gsap from "gsap";
import ActionButton from "../ui/ActionButton.vue";
import SplitHeading from "../ui/SplitHeading.vue";
import { MOTION, prefersReduced } from "../../composables/useMotion";
import { usePointer } from "../../composables/usePointer";


const props = defineProps<{ progress: number }>();

const heading = ref<InstanceType<typeof SplitHeading> | null>(null);
const aside = ref<HTMLElement | null>(null);
const cta = ref<HTMLElement | null>(null);
const plate = ref<HTMLElement | null>(null);

/**
 * One subject, cut out, standing in front of the type.
 *
 * An earlier cut stacked three of her: a flat plate, a WebGL relief and this.
 * Two of those were the same photograph at lower fidelity, and the canvas edge
 * showed as a seam across the frame. A single full-resolution cut-out with a
 * real alpha channel is both sharper and cheaper, and it is the only one of the
 * three that can genuinely cross in front of a word.
 */
const CUTOUT = "/hero/subject-front.png";

const hasCutout = ref(true);
const subject = ref<HTMLElement | null>(null);
const { x, y } = usePointer();

const titleLines = ["Care that", "keeps up with", "a living mind"];

// The hero is on screen when the gate opens, so it is told when to play
// rather than watching for itself.
defineExpose({
  play: () => {
    heading.value?.play();
    if (prefersReduced()) {
      gsap.set([aside.value, cta.value], { opacity: 1, y: 0 });
      gsap.set(plate.value, { scale: 1, opacity: 1 });
      return;
    }
    // The plate settles out of a slow push-in while the type rises over it.
    gsap.to(plate.value, { scale: 1, opacity: 1, duration: 2.4, ease: "expo.out" });
    gsap.to([aside.value, cta.value], {
      opacity: 1,
      y: 0,
      duration: MOTION.duration,
      ease: MOTION.ease,
      stagger: 0.1,
      delay: 0.55,
    });
  },
});

/**
 * Depth from two rates, not from geometry.
 *
 * The subject answers the pointer a little and the scroll a little more, and
 * the type behind her does neither — so the gap between them reads as space.
 * Written straight to the transform rather than through a tween: this follows
 * a continuous input, and a tween chasing it only adds latency.
 */
/**
 * Narrower and a touch taller than the photograph, so she reads as drawn up.
 *
 * The height is where the caution is. `object-fit: contain` has already fitted
 * her to the frame, and the origin is the bottom edge — so every percent of
 * vertical scale pushes the crown of her head out of the top of the viewport.
 * The elongation comes mostly from taking width away.
 */
const STRETCH = { x: 0.9, y: 1.015 };

let bob = 0;
let breath = 0;

const place = () => {
  if (!subject.value || prefersReduced()) return;
  const dx = (x.value - 0.5) * 22;
  const dy = (0.5 - y.value) * 14;
  const rise = props.progress * -60;
  const grow = 1 + props.progress * 0.06;
  // The proportion lives here rather than in the stylesheet. This handler
  // writes the element's inline transform every frame, so a `scale()` declared
  // in CSS is overwritten before it is ever seen — the subject stayed exactly
  // as wide as the photograph no matter what the rule said.
  subject.value.style.transform =
    `translate3d(${dx}px, ${dy + rise + bob}px, 0) rotate(${breath}deg) `
    + `scale(${grow * STRETCH.x}, ${grow * STRETCH.y})`;
};

/**
 * She is never quite still.
 *
 * Two slow sines at different periods, one vertical and one a fraction of a
 * degree of roll. A single sine reads as a bouncing sprite; two that never
 * come back into phase read as a person breathing. It runs on its own clock
 * rather than on the scroll, because a subject that only moves when the reader
 * moves is a photograph, and the point is that she is alive.
 */
let frame = 0;
const drift = (t: number) => {
  bob = Math.sin(t / 2400) * 9 + Math.sin(t / 1450) * 3.5;
  breath = Math.sin(t / 3100) * 0.32;
  place();
  frame = requestAnimationFrame(drift);
};

watch([x, y, () => props.progress], place);

onMounted(() => {
  if (prefersReduced()) return;
  gsap.set(plate.value, { scale: 1.08, opacity: 0 });
  gsap.set([aside.value, cta.value], { opacity: 0, y: MOTION.rise });
  frame = requestAnimationFrame(drift);
});

onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <section id="top" class="section hero">
    <!-- Layer 1: the graded field the subject is lit against. -->
    <div class="hero__wash" aria-hidden="true" />

    <!-- A single hair-thin line falling through the frame and across her.
         It is the only straight thing in the picture, which is what makes the
         rest of it read as photographed rather than composed. -->
    <!-- The reference's own line, to its own geometry: a vertical that steps
         sideways exactly once and then carries on. It is not a curve wandering
         through the picture and it is not a bare rule — the single jog is what
         reads as deliberate. -->
    <svg class="hero__thread" viewBox="0 0 96 808" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M 1 808 L 1 495.469 C 1 460.615 18.826 428.182 48.25 409.5
           C 77.674 390.818 95.5 358.385 95.5 323.531 V 0"
      />
    </svg>

    <!-- Layer 3: the type. -->
    <div class="hero__type">
      <SplitHeading
        ref="heading"
        as="h1"
        class="display hero__title"
        mode="lines"
        :lines="titleLines"
        :delay="0.2"
        immediate
      />
      <div ref="cta" class="hero__cta">
        <ActionButton label="Start your journey" href="#contact" variant="solid" />
      </div>
    </div>

    <!-- The subject, in front of the type. Her alpha is what lets the longest
         line pass behind her shoulder while her face stays clear of it. -->
    <div v-if="hasCutout" ref="plate" class="hero__front">
      <img
        ref="subject"
        :src="CUTOUT"
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchpriority="high"
        @error="hasCutout = false"
      >
    </div>

    <!-- Corner furniture, above everything. -->
    <aside ref="aside" class="hero__aside">
      YOOJ is a cognitive wellbeing lab working where measurement, clinical
      practice and ordinary life meet.
    </aside>
  </section>
</template>

<style scoped lang="scss">
.hero {
  position: relative;
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 0;
  isolation: isolate;
}

// A two-source wash: a cool key light from the right and a deep fall-off into
// the top-left corner, animated slowly so the field never sits still.
.hero__wash {
  position: absolute;
  inset: -10%;
  z-index: 0;
  background:
    radial-gradient(58% 74% at 78% 46%, var(--c-accent) 0%, rgb(var(--rgb-accent) / 0.45) 34%, transparent 68%),
    radial-gradient(70% 90% at 12% 8%, var(--c-ink) 12%, transparent 62%),
    linear-gradient(118deg, rgb(var(--rgb-ink) / 0.72) 6%, rgb(var(--rgb-deep) / 0.42) 46%, rgb(var(--rgb-accent) / 0.3) 100%);
  filter: saturate(1.05);
  animation: wash-drift 22s var(--e-in-out-cubic) infinite alternate;
}

@keyframes wash-drift {
  from { transform: translate3d(-1.5%, -1%, 0) scale(1.02); }
  to   { transform: translate3d(1.5%, 1.5%, 0) scale(1.07); }
}

// Set against the left of the frame and ragged left, so every line finishes on
// one edge a little past the middle — which lands on her eyes and leaves the
// rest of her face clear. Centred, the block crossed her from cheek to cheek
// and the photograph stopped being a photograph of anyone.
.hero__type {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 4;
  display: grid;
  justify-items: end;
  gap: clamp(1.6rem, 4vh, 2.6rem);
  text-align: right;
  padding-left: var(--gutter);
  // The right edge of the block. Her eyes sit a little past the middle of the
  // frame at every width the hero is designed for.
  width: min(62%, 66rem);

  @media (max-width: 60rem) {
    position: relative;
    top: auto;
    transform: none;
    width: auto;
    justify-items: start;
    text-align: left;
    padding-inline: var(--gutter);
  }
}

.hero__title {
  // Size, weight and tracking come from the `.display` step in the shared
  // ladder. Restating them here is what let the hero drift a full step larger
  // than every other heading on the page.
  max-width: 13ch;
}

// Falls the height of the frame, just off the centre line, and is drawn over
// her rather than behind: the crossing is the point.
// Its lower run sits on the type block's own right edge, so the line reads as
// the margin the heading is set against rather than as a mark laid over her.
// Fixed width, stretched height: the jog keeps its shape at any viewport, and
// only the straight runs lengthen.
.hero__thread {
  position: absolute;
  left: calc(52% - 1px);
  top: 0;
  z-index: 4;
  width: 96px;
  height: 100%;
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke: rgb(var(--rgb-bone) / 0.3);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

.hero__cta { will-change: transform, opacity; }


// Centred. The type sits over her, and because each line is a different length
// the silhouette shows through the ragged edges rather than behind a solid block.
.hero__front {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  will-change: transform, opacity;

  img {
    width: 100%;
    height: 100%;
    // `contain`, not `cover`: the cut-out is the whole subject on transparency,
    // and cropping it to fill would cut her chin off on a tall viewport.
    object-fit: contain;
    object-position: center bottom;
    // The resting pose only. Motion overwrites this inline every frame and
    // carries the same proportion in `STRETCH`; this is what a reader sees
    // before the first frame and under reduced motion.
    transform: scale(0.9, 1.015);
    transform-origin: center bottom;
    will-change: transform;
  }
}

.hero__aside {
  position: absolute;
  right: var(--gutter);
  bottom: clamp(4.2rem, 11vh, 6.5rem);
  z-index: 5;
  max-width: 26ch;
  font-size: var(--t-body);
  line-height: 1.5;
  color: var(--c-bone);
  text-align: left;
  will-change: transform, opacity;

  @media (max-width: 48rem) {
    position: static;
    margin: clamp(1.6rem, 5vh, 2.6rem) var(--gutter) 0;
    max-width: none;
  }
}
</style>
