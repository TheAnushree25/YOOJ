<script setup lang="ts">
import { ref } from "vue";
import FilmPlayer from "../ui/FilmPlayer.vue";

/**
 * The second screen: the people living the gap.
 *
 * Laid out to the design, in its own pixels (`--u`), like the hero above it.
 * It is the first beat of the Reconnect section - the pale panel the dome
 * rises over - so the wine ground climbs over *this* screen when the reader
 * moves on, exactly as it used to climb over the old belief statement.
 *
 * The picture is the film's poster: dimmed, with the play mark over it. The
 * whole poster is the control. Pressed, the film rises out of it and takes the
 * screen (ui/FilmPlayer); closed, it comes back down into the same place.
 */

const props = withDefaults(defineProps<{
  /** The approach, 0 to 1: the stage rising into place from below. */
  entry?: number;
}>(), { entry: 1 });

const POSTER = "/gap/people.webp";

/**
 * The film, in two cuts. Versioned by folder, so a new cut ships under a new
 * name rather than over one a browser may be holding.
 */
const FILM = [
  { width: 1280, src: "/film/v1/720.mp4" },
  { width: 1920, src: "/film/v1/1080.mp4" },
] as const;

/** The page's dimming of the poster, which the film matches as it lifts off. */
const SHADE = 0.5;

const film = ref<HTMLElement | null>(null);
const player = ref<InstanceType<typeof FilmPlayer> | null>(null);
/** The film is up, and the poster it rose from stands empty under it. */
const lifted = ref(false);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const arrive = (from: number, to: number) => ease(clamp01((props.entry - from) / (to - from)));

const play = () => player.value?.open();
const warm = () => player.value?.warm();
</script>

<template>
  <div class="gp">
    <div class="gp__frame">
      <p class="gp__eyebrow" :style="{ opacity: arrive(0.3, 0.72) }">The perspective</p>

      <h2 class="gp__title">
        <span class="gp__line">
          <span :style="{ transform: `translate3d(0, ${(1 - arrive(0.36, 0.86)) * 110}%, 0)` }">The people living</span>
        </span>
        <span class="gp__line gp__line--strong">
          <span :style="{ transform: `translate3d(0, ${(1 - arrive(0.44, 0.94)) * 110}%, 0)` }">the gap</span>
        </span>
      </h2>

      <div
        ref="film"
        class="gp__film"
        :class="{ 'is-lifted': lifted }"
        :style="{
          opacity: arrive(0.45, 0.95),
          transform: `translate3d(0, ${(1 - arrive(0.45, 1)) * 5}%, 0)`,
          '--shade': SHADE,
        }"
      >
        <img class="gp__poster" :src="POSTER" alt="" decoding="async" loading="lazy" draggable="false">
        <div class="gp__shade" aria-hidden="true" />

        <!-- The whole poster is the control; the mark is what it looks like. -->
        <button
          class="gp__press"
          type="button"
          aria-label="Play the film: The people living the gap"
          aria-haspopup="dialog"
          data-cursor="Play"
          @click="play"
          @pointerenter="warm"
          @focus="warm"
        >
          <span class="gp__play" data-film-mark aria-hidden="true">
            <i class="gp__pulse" />
            <i class="gp__ring" />
            <i class="gp__tri" />
          </span>
        </button>
      </div>
    </div>

    <FilmPlayer
      ref="player"
      :origin="film"
      :sources="FILM"
      :poster="POSTER"
      :shade="SHADE"
      eyebrow="The perspective"
      :title="['The people living', 'the gap']"
      @lifted="lifted = $event"
    />
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

/**
 * The design's frame is 917 x 718, fitted whole into the screen and centred
 * in it. White ground: the section behind supplies it (see ReconnectSection's
 * `.rc__ground`), so the dome that rises over this has something to rise
 * against.
 */
.gp {
  --u: min(calc(100vw / 917), calc(var(--vh, 1vh) * 100 / 718));
  position: absolute;
  inset: 0;
}

.gp__frame {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - 359 * var(--u));
  height: calc(718 * var(--u));
}

// Sets its letters on the design's baseline: in Montserrat the baseline sits
// 0.86em below the top of a line-height-1 box.
.gp__eyebrow {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(63.5 * var(--u));
  text-align: center;
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(12px, calc(20.3 * var(--u)));
  line-height: 1;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #000000;

  // The thread, coming down from the hero: from above the top of the screen
  // (clipped there) to just over the word. Hung off the word rather than the
  // frame, so it always ends where the word begins.
  &::before {
    content: "";
    position: absolute;
    left: calc(50% + 3.5 * var(--u));
    bottom: calc(100% + 17.5 * var(--u));
    width: 1px;
    height: 200vh;
    background: rgb(var(--rgb-ink) / 0.24);
  }
}

.gp__title {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100.5 * var(--u));
  text-align: center;
  font-family: var(--font-say);
  font-weight: 300;
  font-size: calc(45.8 * var(--u));
  line-height: calc(56 * var(--u));
  letter-spacing: 0;
  color: var(--c-wine);
}

.gp__line {
  display: block;
  overflow: hidden;
  padding-bottom: 0.12em;
  margin-bottom: -0.12em;

  > span { display: block; will-change: transform; }
}

.gp__line--strong { font-weight: 800; }

.gp__film {
  position: absolute;
  left: calc(50% - 349 * var(--u));
  top: calc(255 * var(--u));
  width: calc(699 * var(--u));
  height: calc(381.5 * var(--u));
  border-radius: calc(3.5 * var(--u));
  overflow: hidden;
  isolation: isolate;
  background: #1A1A1A;
  will-change: transform, opacity;
}

.gp__poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: center;
  transition: transform 1.4s var(--e-out-expo);
}

// Half-dark, as the design dims it: the play mark has to read over any frame.
.gp__shade {
  position: absolute;
  inset: 0;
  background: #000000;
  opacity: var(--shade, 0.5);
  pointer-events: none;
  transition: opacity 0.8s var(--e-out-quart);
}

// The film has risen out of this poster and stands over the page; the place
// it came from is left empty under it, and taken back when it comes home.
.gp__film.is-lifted { visibility: hidden; }

// The whole poster is the control.
.gp__press {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;

  &:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 3px rgb(var(--rgb-accent) / 0.7);
  }
}

.gp__play {
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  width: calc(78 * var(--u));
  height: calc(78 * var(--u));
  margin: calc(-39 * var(--u)) 0 0 calc(-39 * var(--u));
  border-radius: 50%;
  transition: transform 0.7s var(--e-out-expo);

  > i { grid-area: 1 / 1; }
}

// Pointed at, the picture leans in and lightens and the mark comes forward:
// the poster saying it is a film before it is pressed.
@include hover {
  .gp__press:hover {
    .gp__play { transform: scale(1.08); }
  }

  .gp__film:has(.gp__press:hover) {
    .gp__poster { transform: scale(1.035); }
    .gp__shade { opacity: calc(var(--shade, 0.5) - 0.14); }
  }
}

.gp__ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.85);
}

// A slow ring breathing out of the mark, so the still reads as something that
// plays. Transform and opacity only: it runs on the compositor and costs the
// page nothing while it is being scrolled.
.gp__pulse {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.6);
  opacity: 0;
  animation: gp-pulse 3.2s var(--e-out-quart) 1.2s infinite;
}

@keyframes gp-pulse {
  0%   { transform: scale(1); opacity: 0.55; }
  70%  { transform: scale(1.75); opacity: 0; }
  100% { transform: scale(1.75); opacity: 0; }
}

// A triangle pointing right, its balance point on the ring's centre: the box
// is two design pixels short of equilateral, as the design draws it, and a
// third of its width sits left of the centre.
.gp__tri {
  width: calc(28 * var(--u));
  height: calc(35 * var(--u));
  margin-left: calc(28 * var(--u) / 3);
  background: #FEB3B8;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

@media (prefers-reduced-motion: reduce) {
  .gp__pulse { animation: none; }
}

/**
 * Portrait: stacked from the top, with the picture as wide as the column and
 * a little taller than the design's, so the people in it are not a strip.
 *
 * `--m` is one pixel of a 390-wide phone design. It used to be capped by an
 * 844-tall one as well, which is the phone's *screen* - but a browser shows
 * a good deal less of it than that, so on a real phone every size here came
 * out at four-fifths and the eyebrow at nine pixels. The height term is now
 * the page a phone actually shows, and the type has floors besides.
 */
@media (orientation: portrait) {
  .gp {
    --m: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 760));
  }

  .gp__frame {
    top: 0;
    bottom: 0;
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 calc(20 * var(--m)) calc(24 * var(--m));
  }

  .gp__eyebrow,
  .gp__title,
  .gp__film {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
  }

  .gp__eyebrow {
    font-size: max(12px, calc(14 * var(--m)));

    &::before {
      left: calc(50% + 3.5 * var(--m));
      bottom: calc(100% + 16 * var(--m));
    }
  }

  .gp__title {
    margin-top: calc(22 * var(--m));
    font-size: max(26px, calc(33 * var(--m)));
    line-height: 1.24;
  }

  // As wide as the column on a phone; on a tablet held upright that was a
  // picture the size of the screen, so it stops at a comfortable width.
  .gp__film {
    margin-top: calc(30 * var(--m));
    width: min(100%, 36rem);
    height: auto;
    aspect-ratio: 4 / 3;
    border-radius: calc(4 * var(--m));
  }

  .gp__play {
    width: calc(64 * var(--m));
    height: calc(64 * var(--m));
    margin: calc(-32 * var(--m)) 0 0 calc(-32 * var(--m));
  }

  .gp__tri {
    width: calc(22 * var(--m));
    height: calc(28 * var(--m));
    margin-left: calc(22 * var(--m) / 3);
  }
}
</style>
