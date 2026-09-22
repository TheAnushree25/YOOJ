<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import ActionButton from "../ui/ActionButton.vue";
import { ScrollTrigger, prefersReduced } from "../../composables/useMotion";
import { FrameSequence } from "../../lib/frame-sequence";
import { HANDS_COUNT, handsFrame, heroImageReady } from "../../lib/hero-image";

/**
 * The first screen: the promise, and two hands that close on it as the reader
 * moves.
 *
 * The words are built to the design, in the design's own pixels (`--u`). The
 * hands are a film: at rest they are reaching for each other, and the scroll
 * plays them together - fingers meeting, one hand closing over the other,
 * held - so the first thing the reader does on the page is what the page is
 * about. The film runs the full width of the screen at its own proportions,
 * starting where the design puts the drawing and carrying on past the fold,
 * and it is multiplied onto the ground, so its paper is the page.
 *
 * Not held in place. Like the reference it scrolls up as it plays, and the
 * clasp completes as the hands reach the upper part of the screen - the
 * reader watches it happen rather than waiting for it.
 */

const film = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

let sequence: FrameSequence | null = null;
let trigger: ScrollTrigger | null = null;

/**
 * Whether the entrance has played. The page says when - the moment the gate
 * has lifted - and a reader who asked for less motion simply arrives on the
 * finished frame.
 */
const reduced = prefersReduced();
const shown = ref(reduced);

defineExpose({ play: () => { shown.value = true; } });

/** Broken where the design breaks it. On a phone the lines run together. */
const aside = [
  "Good healthcare shouldn’t depend on",
  "where you live. YOOJ is building a",
  "connected primary-care network for the",
  "people who keep India moving.",
];

onMounted(() => {
  if (!canvas.value || !film.value) return;
  try {
    sequence = new FrameSequence(canvas.value, {
      url: (i) => handsFrame(i),
      count: HANDS_COUNT,
      // The clasp sits a little right of centre in the film; a phone, which
      // sees only a slice of the width, is given that slice.
      focusX: 0.52,
      focusY: 0.5,
    });
  } catch {
    return;
  }

  const seq = sequence;
  window.addEventListener("resize", seq.resize);
  // Dev-only handle, for headless checks of which frame is on the canvas.
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__hands = seq;

  if (reduced) {
    // The finished clasp, and nothing to scrub.
    void seq.prime(HANDS_COUNT - 1);
    return;
  }

  // The opening frame first - the gate has already waited for it, so it is in
  // the cache - and the rest of the film behind it, coarse to fine.
  void heroImageReady.then(() => seq.prime(0)).then(() => seq.loadAll());

  trigger = ScrollTrigger.create({
    trigger: film.value,
    // From the page's first pixel of travel: the hands begin to move the
    // moment the reader does.
    start: 0,
    // Complete as the film's centre reaches the upper third of the screen.
    end: "center 30%",
    onUpdate: (self) => seq.setProgress(self.progress),
    // Re-measured with everything else on a refresh; the film's height is a
    // share of the width, so a resize moves where the clasp completes.
    invalidateOnRefresh: true,
  });
});

onBeforeUnmount(() => {
  trigger?.kill();
  if (sequence) window.removeEventListener("resize", sequence.resize);
  sequence?.dispose();
});
</script>

<template>
  <section id="top" class="hero" :class="{ 'is-shown': shown }">
    <!-- The film: full width, at its own shape, from where the design puts the
         drawing down past the fold. Under the words and the thread. -->
    <div ref="film" class="hero__film" aria-hidden="true">
      <canvas ref="canvas" class="hero__canvas" />
    </div>

    <div class="hero__frame">
      <!-- The page's thread: down from the wordmark and one step sideways.
           The straight run below the step is its own line, so it can reach
           the foot of the section however tall the film makes it. -->
      <div class="hero__thread" aria-hidden="true">
        <svg viewBox="0 0 41 200" preserveAspectRatio="none" focusable="false">
          <path d="M 40 0 V 170 C 40 188 1 182 1 200" />
        </svg>
      </div>

      <!-- The header's own mark stands down while this one is on screen;
           see SiteHeader's `markHidden`. -->
      <p class="hero__brand" aria-hidden="true">YOOJ</p>

      <h1 class="hero__title">
        <span class="hero__line"><span>Better health for more lives</span></span>
        <span class="hero__line hero__line--strong"><span>everyday.</span></span>
      </h1>

      <div class="hero__cta">
        <ActionButton label="Start your YOOJ journey" to="/solutions" variant="pill" />
      </div>

      <p class="hero__aside">
        <span v-for="line in aside" :key="line">{{ `${line} ` }}</span>
      </p>
    </div>

    <span class="hero__run" aria-hidden="true" />
  </section>
</template>

<style scoped lang="scss">
/**
 * The design's frame is 917 x 730. `--u` is one of its pixels at the largest
 * scale that fits all of it on the first screen: on a laptop that is set by
 * the height, so the composition keeps its vertical rhythm and gains room at
 * the sides.
 *
 * The section is the first screen plus the film's run below it: the film
 * starts where the design puts the drawing (278 of 730) and is as tall as the
 * screen's width makes it.
 */
.hero {
  --u: min(calc(100vw / 917), calc(var(--vh, 1vh) * 100 / 730));
  /// The first screen, and where the design's frame begins inside it.
  --screen: calc(var(--vh, 1vh) * 100);
  --top: calc(var(--screen) - 730 * var(--u));
  /// The film: its own proportions (1280 x 696), the full width.
  --film-top: calc(var(--top) + 278 * var(--u));
  --film-h: calc(100vw * 696 / 1280);

  position: relative;
  height: calc(var(--film-top) + var(--film-h));
  min-height: var(--screen);
  overflow: hidden;
  isolation: isolate;
  // Blush at the head of the frame, clearing to white just above the hands,
  // and white all the way down past them. The stops are the design's.
  background: linear-gradient(
    to bottom,
    #FEB4B8 var(--top),
    #FDC2C6 calc(var(--top) + 80 * var(--u)),
    #FDD6DA calc(var(--top) + 200 * var(--u)),
    #FCE8EB calc(var(--top) + 260 * var(--u)),
    #FDF3F4 calc(var(--top) + 300 * var(--u)),
    #FFFFFF calc(var(--top) + 350 * var(--u))
  );
}

/* --------------------------------------------------------------- the film */

.hero__film {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--film-top);
  height: var(--film-h);
  z-index: 1;
  pointer-events: none;
  // The frames are drawn on white paper; multiplied, the paper is the page.
  mix-blend-mode: multiply;
  opacity: 0;
  transform: translate3d(0, 2.5%, 0);
  transition:
    opacity 1.4s var(--e-out-quart) 0.1s,
    transform 1.8s var(--e-out-expo) 0.1s;
}

.is-shown .hero__film { opacity: 1; transform: none; }

.hero__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

/* ------------------------------------------------------------ the words */

// The first screen's composition, standing on the foot of the first screen.
.hero__frame {
  position: absolute;
  left: 0;
  right: 0;
  top: var(--top);
  z-index: 2;
  height: calc(730 * var(--u));
  pointer-events: none;
}

// Drawn over the hands and under the words is not what the design does: it
// crosses the button as a dark hairline on the wine, so it is over everything.
.hero__thread {
  position: absolute;
  z-index: 3;
  left: calc(50% + 2.5 * var(--u));
  top: calc(80 * var(--u));
  width: calc(41 * var(--u));
  height: calc(200 * var(--u));
  clip-path: inset(0 0 100% 0);
  transition: clip-path 1.2s var(--e-in-out-quart) 0.3s;

  svg {
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    overflow: visible;
  }

  path {
    fill: none;
    stroke: rgb(var(--rgb-ink) / 0.24);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

// The straight run: from the foot of the step, through the hands, to the
// bottom of the section, where the next screen's thread picks it up three
// and a half design pixels right of centre.
.hero__run {
  position: absolute;
  z-index: 3;
  left: calc(50% + 3.5 * var(--u) - 0.5px);
  top: calc(var(--top) + 280 * var(--u));
  bottom: 0;
  width: 1px;
  background: rgb(var(--rgb-ink) / 0.24);
  pointer-events: none;
  transform: scaleY(0);
  transform-origin: top center;
  transition: transform 1.6s var(--e-in-out-quart) 1.2s;
}

.is-shown {
  .hero__thread { clip-path: inset(0); }
  .hero__run { transform: none; }
}

// Each placed on its own baseline from the design: line-height 1 puts the
// baseline 0.86em below the top of the box in Montserrat, so a top of
// `baseline - 0.86 * size` lands the letters where they are drawn.
.hero__brand {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(44.2 * var(--u));
  z-index: 1;
  text-align: center;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: calc(26.5 * var(--u));
  line-height: 1;
  letter-spacing: -0.05em;
  color: var(--c-wine);
}

.hero__title {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(141 * var(--u));
  z-index: 1;
  text-align: center;
  font-family: var(--font-say);
  font-weight: 300;
  font-size: calc(40.4 * var(--u));
  line-height: calc(49 * var(--u));
  letter-spacing: 0;
  color: var(--c-wine);
}

// Masked, so each line rises into place. The mask is given room below the
// baseline for the tail of the "y", and the same room is taken back.
.hero__line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.12em;
  margin-bottom: -0.12em;

  > span {
    display: block;
    white-space: nowrap;
    transform: translate3d(0, 110%, 0);
    transition: transform 1.2s var(--e-out-quart) 0.1s;
  }

  & + & > span { transition-delay: 0.22s; }
}

.hero__line--strong { font-weight: 800; }

.is-shown .hero__line > span { transform: none; }

.hero__cta {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(280 * var(--u));
  z-index: 1;
  display: flex;
  justify-content: center;
  --pill-h: calc(35 * var(--u));
  --pill-px: calc(21 * var(--u));
  --pill-fs: max(10px, calc(11.3 * var(--u)));

  :deep(.act) { pointer-events: auto; }
}

// Against the right edge of the screen, as the design sets it, ragged left.
.hero__aside {
  position: absolute;
  right: calc(27 * var(--u));
  top: calc(346 * var(--u));
  z-index: 1;
  text-align: right;
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(11px, calc(13.35 * var(--u)));
  line-height: max(14px, calc(16.3 * var(--u)));
  color: #121212;
  pointer-events: auto;

  span {
    display: block;
    white-space: nowrap;
  }
}

.hero__brand,
.hero__cta,
.hero__aside {
  opacity: 0;
  transform: translate3d(0, calc(14 * var(--u)), 0);
  transition:
    opacity 1.1s var(--e-out-quart),
    transform 1.1s var(--e-out-quart);
}

.hero__cta { transition-delay: 0.5s; }
.hero__aside { transition-delay: 0.65s; }

.is-shown {
  .hero__brand,
  .hero__cta,
  .hero__aside { opacity: 1; transform: none; }
}

/**
 * Portrait: the same screen, stacked.
 *
 * A frame wider than it is tall cannot be fitted into a phone without every
 * word shrinking to a caption, so the words stand in a column from the top and
 * the film takes the rest of the screen and a stretch below it, cropped to the
 * clasp: the arms run off both sides, as they do on a wide screen.
 */
@media (orientation: portrait) {
  .hero {
    --m: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 844));
    --top: 0px;
    // The lower half of the screen. Cropped to a phone's width at this
    // height, the slice kept is about half the film - the whole of the clasp,
    // at a scale the 1280 frames still hold sharply.
    --film-top: calc(var(--screen) * 0.5);
    --film-h: min(calc(var(--screen) * 0.5), 130vw);
    background: linear-gradient(
      to bottom,
      #FEB4B8 0,
      #FDC2C6 calc(var(--screen) * 0.11),
      #FDD6DA calc(var(--screen) * 0.25),
      #FCE8EB calc(var(--screen) * 0.34),
      #FDF3F4 calc(var(--screen) * 0.40),
      #FFFFFF calc(var(--screen) * 0.47)
    );
  }

  .hero__frame {
    top: 0;
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: calc(62 * var(--m)) calc(20 * var(--m)) 0;
  }

  .hero__brand,
  .hero__title,
  .hero__cta,
  .hero__aside {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
  }

  .hero__brand { font-size: calc(22 * var(--m)); }

  .hero__title {
    margin-top: calc(30 * var(--m));
    max-width: calc(340 * var(--m));
    font-size: calc(33 * var(--m));
    line-height: calc(40 * var(--m));
  }

  .hero__line > span { white-space: normal; }

  .hero__cta {
    margin-top: calc(28 * var(--m));
    --pill-h: calc(42 * var(--m));
    --pill-px: calc(24 * var(--m));
    --pill-fs: max(10.5px, calc(11.5 * var(--m)));
  }

  .hero__aside {
    margin-top: calc(26 * var(--m));
    max-width: calc(316 * var(--m));
    text-align: center;
    font-size: calc(14 * var(--m));
    line-height: 1.5;

    span { display: inline; white-space: normal; }
  }

  // Under the words here, not over them: stacked and centred, every block of
  // copy sits on the thread's line, and drawn on top it read as a strike
  // through the paragraph.
  .hero__thread {
    z-index: 0;
    left: calc(50% + 2.5 * var(--m));
    top: calc(92 * var(--m));
    width: calc(41 * var(--m));
    height: calc(120 * var(--m));
  }

  .hero__run {
    z-index: 1;
    left: calc(50% + 3.5 * var(--m) - 0.5px);
    top: calc(212 * var(--m));
  }
}
</style>
