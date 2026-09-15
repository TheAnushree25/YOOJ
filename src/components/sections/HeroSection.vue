<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import gsap from "gsap";
import ActionButton from "../ui/ActionButton.vue";
import SplitHeading from "../ui/SplitHeading.vue";
import { MOTION, prefersReduced, scrubThrough } from "../../composables/useMotion";
import { usePointer } from "../../composables/usePointer";
import { HERO_CUTOUT, heroImageReady } from "../../lib/hero-image";


const props = defineProps<{ progress: number }>();

const heading = ref<InstanceType<typeof SplitHeading> | null>(null);
const aside = ref<HTMLElement | null>(null);
const cta = ref<HTMLElement | null>(null);
const plate = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);

/**
 * One subject, cut out, standing in front of the type.
 *
 * An earlier cut stacked three of her: a flat plate, a WebGL relief and this.
 * Two of those were the same photograph at lower fidelity, and the canvas edge
 * showed as a seam across the frame. A single full-resolution cut-out with a
 * real alpha channel is both sharper and cheaper, and it is the only one of the
 * three that can genuinely cross in front of a word.
 */
const hasCutout = ref(true);
/**
 * Her source, decided by lib/hero-image: the WebP where it decodes, the PNG
 * where it does not. Either way the bytes are already in memory by the time
 * this renders — the fetch started with the document, the decode with the
 * app's first module, and the gate does not lift until it has finished.
 */
const cutout = ref(HERO_CUTOUT);
heroImageReady.then((url) => { cutout.value = url; });
const subject = ref<HTMLElement | null>(null);
const { x, y } = usePointer();

/**
 * Her own travel, measured against the hero.
 *
 * `progress` is the whole document's, and the hero is a small fraction of it —
 * across the two viewports she is on screen for, it advances about a tenth,
 * which is no movement at all. A local scrub gives the stage a full 0 to 1 to
 * work with, so the push-in is actually a push-in.
 */
const hp = ref(0);
let stageTrigger: ReturnType<typeof scrubThrough> = null;

const titleLines = ["Healthcare", "closer to you"];

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
 * Very nearly the photograph's own proportions.
 *
 * The previous plate was a wide frame with the subject small inside it, and
 * taking a tenth of its width back was what made her read as standing rather
 * than as lying across the picture. This one is cropped to her alpha, so she
 * already fills the height — squeezing it now would only narrow a face that is
 * turned almost side-on, where the distortion shows immediately.
 *
 * `object-fit: contain` has already fitted her to the frame and the origin is
 * the bottom edge, so every percent of vertical scale pushes the crown of her
 * head out of the top of the viewport. It stays at one.
 */
const STRETCH = { x: 0.98, y: 1 };

let bob = 0;
let breath = 0;

const place = () => {
  if (!subject.value || prefersReduced()) return;
  const dx = (x.value - 0.5) * 22;
  const dy = (0.5 - y.value) * 14;
  // A push-in and nothing else. She used to lift as well, and lifting a
  // subject who stands on the bottom edge of the frame uncovers the ground
  // under her feet — which is how a band of pale appeared beneath her on the
  // second screen. The scale is about her feet, so she grows upward.
  const grow = 1 + hp.value * 0.09;
  // The proportion lives here rather than in the stylesheet. This handler
  // writes the element's inline transform every frame, so a `scale()` declared
  // in CSS is overwritten before it is ever seen — the subject stayed exactly
  // as wide as the photograph no matter what the rule said.
  subject.value.style.transform =
    `translate3d(${dx}px, ${dy + bob}px, 0) rotate(${breath}deg) `
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

watch([x, y, hp, () => props.progress], place);

onMounted(() => {
  if (prefersReduced()) return;
  gsap.set(plate.value, { scale: 1.08, opacity: 0 });
  gsap.set([aside.value, cta.value], { opacity: 0, y: MOTION.rise });
  frame = requestAnimationFrame(drift);

  if (root.value) {
    stageTrigger = scrubThrough(root.value, (v) => (hp.value = v), {
      start: "top top",
      end: "bottom bottom",
    });
  }
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  stageTrigger?.kill();
});
</script>

<template>
  <section id="top" ref="root" class="section hero">
    <!-- Held for two viewports. She is the first thing on the page and the
         thing it is about; one screen was not long enough to look at her
         before the page moved on. -->
    <div class="hero__stage">

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
        <ActionButton label="Start your YOOJ journey" to="/solutions" variant="solid" />
      </div>
    </div>

    <!-- The subject, in front of the type. Her alpha is what lets the longest
         line pass behind her shoulder while her face stays clear of it. -->
    <div v-if="hasCutout" ref="plate" class="hero__front">
      <img
        ref="subject"
        :src="cutout"
        alt=""
        aria-hidden="true"
        decoding="async"
        fetchpriority="high"
        @error="hasCutout = false"
      >
    </div>

    <!-- Corner furniture, above everything. -->
    <aside ref="aside" class="hero__aside">
      Good healthcare shouldn't depend on where you live. YOOJ is building a
      connected primary-care network for the people who keep India moving.
    </aside>
    </div>
  </section>
</template>

<style scoped lang="scss">
// Two viewports of travel, one viewport of frame. The stage is sticky rather
// than pinned, for the reason recorded across the rest of the site: a pinned
// element becomes `fixed`, reports an offset of zero, and re-measures its start
// as the top of the document on any refresh landing while the pin is applied.
.hero {
  position: relative;
  height: 200vh;
  height: calc(var(--sv) * 200);
  padding: 0;
}

.hero__stage {
  // Where the subject stands. The heading and the corner note are both placed
  // against these rather than against their own guesses, so moving her moves
  // the composition instead of breaking it.
  --subject-w: min(60%, 48rem);
  // Her centre line: the middle of the frame. She faces right, so her eyes
  // land a little past the centre, which is where the heading is measured to
  // finish.
  --subject-x: 50%;

  position: sticky;
  top: 0;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
  display: grid;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
}

// No ground of its own. The hero stands on the page's field, which is the
// dark one — a second gradient here was the one place the site had two colours
// in one frame.

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
  /**
   * The right edge of the block, set deliberately inside her.
   *
   * The lines are meant to cross her head — that overlap is the composition,
   * not a collision, and pulling the measure back until every line finished in
   * clear air produced a tidy layout of two separate things sitting next to
   * each other. The heading is white and she is lit dark under it, so the
   * crossing stays legible on its own; what is not survivable is a line ending
   * a few pixels inside her, which reads as clipping rather than as layering.
   * Far enough in to be unmistakably deliberate.
   */
  width: min(57%, 62rem);

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

// Below this there is no room for a figure beside a full-width heading, so she
// goes back to standing behind it.





.hero__title {
  // Size, weight and tracking come from the `.display` step in the shared
  // ladder. Restating them here is what let the hero drift a full step larger
  // than every other heading on the page.
  max-width: 13ch;

  // The lines cross her on purpose, and the place they cross is the rim light
  // down the edge of her face — the one part of the picture as bright as the
  // type is. Wide and weak: on the dark left of the frame it is not visible at
  // all, and where a letter meets the highlight it is the difference between
  // reading "journey" and reading "journe".
  text-shadow: 0 1px 26px rgb(20 3 9 / 0.42);
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
/**
 * Given a frame of her own rather than the whole stage.
 *
 * The previous plate was a wide photograph with the subject small inside it,
 * so stretching it across the hero and letting `contain` do the fitting put
 * her at a sensible size by accident. This one is cropped to her alpha — at
 * full stage height the crop fills the viewport and she reads as a face
 * pressed against the glass. Sizing the frame explicitly is what makes her a
 * figure standing in the picture, and it holds at any viewport rather than at
 * the one it happened to be checked on.
 */
.hero__front {
  position: absolute;
  // Larger than the frame by a little at both ends: the crown of her head is
  // cropped by the top edge, as the reference crops it, and the few pixels
  // below the bottom edge are slack — the pointer lifts her a hair, and slack
  // is what keeps that from showing the ground under her feet.
  top: -3vh;
  bottom: -5vh;
  left: var(--subject-x);
  margin-left: calc(var(--subject-w) / -2);
  width: var(--subject-w);
  z-index: 3;
  pointer-events: none;
  will-change: transform, opacity;

  img {
    width: 100%;
    height: 100%;
    // `contain`, not `cover`: the cut-out is the whole subject on transparency,
    // and cropping it to fill would cut her chin off on a tall viewport.
    // `contain`, not `cover`: the cut-out is the whole subject on transparency,
    // and cropping it to fill would take her chin off on a tall viewport.
    object-fit: contain;
    object-position: center bottom;
    // The resting pose only. Motion overwrites this inline every frame and
    // carries the same proportion in `STRETCH`; this is what a reader sees
    // before the first frame and under reduced motion.
    transform: scale(0.98, 1);
    transform-origin: center bottom;
    will-change: transform;
  }
}

// Back in the corner, and set light: with her centred the corner is clear,
// and with the ground dark the wine it used to be set in is not dim, it is
// gone.
.hero__aside {
  position: absolute;
  right: var(--gutter);
  bottom: clamp(4.2rem, 11vh, 6.5rem);
  z-index: 5;
  max-width: 26ch;
  font-size: var(--t-body);
  line-height: 1.5;
  color: rgb(var(--rgb-bone) / 0.78);
  font-weight: 400;
  text-align: left;
  will-change: transform, opacity;

}
@media (max-width: 48rem) {
  // Off the flow and back onto the picture: heading low-left, the call to
  // action directly under it, both clear of the foot of the frame.
  .hero__type {
    position: absolute;
    left: 0;
    right: 0;
    top: auto;
    // Over her lower body, clear of the note standing under the picture.
    bottom: 26%;
    transform: none;
    z-index: 6;
    width: auto;
    gap: clamp(1.15rem, 3.2vh, 1.9rem);
  }

  .hero__aside {
    position: absolute;
    left: 0;
    right: 0;
    // Directly under the foot of her box, so the sentence begins where the
    // picture ends, and above the hint in the corner.
    bottom: clamp(3.4rem, 8.5vh, 4.4rem);
    z-index: 6;
    margin: 0;
    padding-inline: var(--gutter);
    max-width: none;
    font-size: 0.8rem;
    line-height: 1.5;
    color: rgb(var(--rgb-bone) / 0.72);
  }
}
/**
 * The handheld hero.
 *
 * On a wide frame she stands beside the heading and the two share the width.
 * A phone has no width to share, so the composition changes rather than
 * shrinks: she fills the frame and the heading sits on her.
 *
 * Her box is the frame, not a multiple of it. At 152vw she was rendered 587px
 * wide inside a 390px screen - just under a hundred pixels cut off each side,
 * and the side that mattered was the one with her face on it. `contain` keeps
 * the whole cut-out, so the box only has to be narrow enough that nothing
 * leaves it: the pointer grows her to 1.09 and the resting stretch takes
 * 0.98 of that, so 92vw is the widest she can start and still be whole at the
 * top of her breath.
 *
 * She is anchored to the foot of her box and the note sits directly beneath
 * it, which is what puts the copy at the end of the picture rather than over
 * it.
 */
@media (max-width: 60rem) {
  .hero__front {
    top: 0;
    // The band the note stands in, under her - deep enough that the note
    // clears the scroll hint standing in the corner below it.
    bottom: clamp(7rem, 18vh, 8.6rem);
    left: 50%;
    right: auto;
    width: 92vw;
    margin-left: -46vw;
    height: auto;
    opacity: 1;
  }

  .hero__front img {
    object-position: center bottom;
  }

  // Her ground is bright where the heading crosses it, so the type gets a
  // little dark under it - weighted to the foot of the frame, nothing across
  // her face.
  .hero__stage::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: linear-gradient(
      to top,
      rgb(var(--rgb-void) / 0.66) 0%,
      rgb(var(--rgb-void) / 0.38) 24%,
      rgb(var(--rgb-void) / 0.10) 48%,
      transparent 70%
    );
  }
}

</style>
