<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { duckAmbient, soundOn } from "../../lib/sound";

/**
 * The second screen: the people living the gap.
 *
 * Laid out to the design, in its own pixels (`--u`), like the hero above it.
 * It is the first beat of the Reconnect section - the pale panel the dome
 * rises over - so the wine ground climbs over *this* screen when the reader
 * moves on, exactly as it used to climb over the old belief statement.
 *
 * The picture is a film's poster: dimmed, with the play mark over it. The
 * film itself is not part of the site yet. Drop it in at GAP_FILM and the
 * mark becomes a control; until then it is the design's mark and nothing
 * more - not focusable, not announced, and not promising a film that is not
 * there.
 */

const props = withDefaults(defineProps<{
  /** The approach, 0 to 1: the stage rising into place from below. */
  entry?: number;
}>(), { entry: 1 });

const GAP_FILM = "/gap/people.mp4";
const POSTER = "/gap/people.webp";

const video = ref<HTMLVideoElement | null>(null);
/**
 * Whether there is a film to play. Asked of the element itself rather than
 * of the server: the site's rewrite answers every missing path with the page,
 * so a request succeeding says nothing - a video that cannot decode does.
 */
const available = ref(false);
const playing = ref(false);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const arrive = (from: number, to: number) => ease(clamp01((props.entry - from) / (to - from)));

const toggle = async () => {
  const v = video.value;
  if (!v || !available.value) return;
  if (!v.paused) { v.pause(); return; }
  v.muted = !soundOn.value;
  try {
    await v.play();
  } catch {
    v.muted = true;
    await v.play().catch(() => {});
  }
};

// The bed steps aside while the film is sounding, and comes back after.
const onPlay = () => { playing.value = true; if (!video.value?.muted) duckAmbient(true); };
const onStop = () => { playing.value = false; duckAmbient(false); };

watch(soundOn, (on) => { if (video.value) video.value.muted = !on; });

onBeforeUnmount(() => {
  if (playing.value) duckAmbient(false);
});
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
        class="gp__film"
        :class="{ 'is-playing': playing, 'is-live': available }"
        :style="{
          opacity: arrive(0.45, 0.95),
          transform: `translate3d(0, ${(1 - arrive(0.45, 1)) * 5}%, 0)`,
        }"
      >
        <img class="gp__poster" :src="POSTER" alt="" decoding="async" loading="lazy" draggable="false">
        <video
          ref="video"
          class="gp__video"
          :src="GAP_FILM"
          preload="metadata"
          playsinline
          disablepictureinpicture
          @loadedmetadata="available = true"
          @error="available = false"
          @play="onPlay"
          @pause="onStop"
          @ended="onStop"
          @click="toggle"
        />
        <div class="gp__shade" aria-hidden="true" />

        <button
          v-if="available"
          class="gp__play"
          type="button"
          :aria-label="playing ? 'Pause the film' : 'Play the film'"
          data-cursor="scale"
          @click="toggle"
        >
          <i class="gp__ring" aria-hidden="true" />
          <i class="gp__tri" aria-hidden="true" />
        </button>
        <span v-else class="gp__play" aria-hidden="true">
          <i class="gp__ring" />
          <i class="gp__tri" />
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
  font-size: max(11px, calc(20.3 * var(--u)));
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

.gp__poster,
.gp__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
  object-position: center;
}

// Hidden until it is actually playing: the poster is the picture, and a
// video element that failed to load draws nothing useful.
.gp__video {
  opacity: 0;
  transition: opacity 0.5s var(--e-out-quart);

  .is-playing & { opacity: 1; }
  .is-live & { cursor: pointer; }
}

// Half-dark, as the design dims it: the play mark has to read over any frame.
.gp__shade {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  pointer-events: none;
  transition: opacity 0.6s var(--e-out-quart);

  .is-playing & { opacity: 0; }
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
  transition: opacity 0.4s var(--e-out-quart), transform var(--t-hover) var(--e-out-quart);

  > i { grid-area: 1 / 1; }

  .is-playing & { opacity: 0; }
  .is-playing &:hover,
  .is-playing &:focus-visible { opacity: 1; }
}

button.gp__play {
  &:hover { transform: scale(1.05); }
  &:focus-visible { outline: none; box-shadow: 0 0 0 3px rgb(var(--rgb-accent) / 0.6); }
}

.gp__ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.85);
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

/**
 * Portrait: stacked from the top, with the picture as wide as the column and
 * a little taller than the design's, so the people in it are not a strip.
 */
@media (orientation: portrait) {
  .gp {
    --m: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 844));
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
    font-size: calc(14 * var(--m));

    &::before {
      left: calc(50% + 3.5 * var(--m));
      bottom: calc(100% + 16 * var(--m));
    }
  }

  .gp__title {
    margin-top: calc(22 * var(--m));
    font-size: calc(33 * var(--m));
    line-height: calc(41 * var(--m));
  }

  .gp__film {
    margin-top: calc(30 * var(--m));
    width: 100%;
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
