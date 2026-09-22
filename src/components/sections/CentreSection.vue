<script setup lang="ts">
/**
 * The YOOJ Primary Care Centre: one roof, and what is under it.
 *
 * One screen, laid out to the design in the design's own pixels (`--u`), on
 * the site's light ground - the same drifting blush the next section stands
 * on, in step with it, so the two read as one room.
 *
 * The three pictures are set as a row centred under the heading. The design
 * draws the row a few pixels right of centre, with the last picture running
 * into the frame's edge; on any screen wider than the design that reads as a
 * mistake rather than a choice, so the row is centred on the same axis as the
 * words above it and otherwise drawn exactly as specified.
 */

const photos = [
  { src: "/centre/consult.webp", alt: "A nurse taking a patient’s blood pressure" },
  { src: "/centre/pharmacy.webp", alt: "A hand choosing medicine from a box of prescriptions" },
  { src: "/centre/diagnostics.webp", alt: "A laboratory technician at a microscope, with blood samples" },
];
</script>

<template>
  <section id="centre" class="ce">
    <div class="ce__stage">
      <div class="ce__wash ground-drift" aria-hidden="true" />

      <div class="ce__frame">
        <p v-reveal class="ce__eyebrow reveal">The YOOJ Primary Care Centre</p>

        <h2 class="ce__title">
          <span v-reveal="80" class="reveal-line">
            <span>One roof. <strong>Four services.</strong></span>
          </span>
        </h2>

        <p v-reveal="180" class="ce__body reveal">
          <span>A standardised, brand-owned Primary Care Centre for Tier 3 India the flagship</span>
          <span>of every YOOJ cluster, and the anchor the affiliate network plugs into.</span>
        </p>

        <ul class="ce__row">
          <li v-for="(photo, i) in photos" :key="photo.src" v-reveal="260 + i * 110" class="ce__photo reveal">
            <img :src="photo.src" :alt="photo.alt" loading="lazy" decoding="async" draggable="false">
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ce {
  position: relative;
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);
}

/**
 * The design's frame is 918 x 662, fitted whole into the screen and centred
 * in it. Offsets are the design's baselines, set in Montserrat's line-height-1
 * box, whose baseline sits 0.86em below its top.
 */
.ce__stage {
  --u: min(calc(100vw / 918), calc(var(--vh, 1vh) * 100 / 662));

  position: relative;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  background: var(--ga-bg);
}

// The site's light ground, drifting - the Frontier section's own, in step.
.ce__wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
}

.ce__frame {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - 331 * var(--u));
  z-index: 1;
  height: calc(662 * var(--u));
}

.ce__eyebrow {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(96.6 * var(--u));
  text-align: center;
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(11px, calc(20.2 * var(--u)));
  line-height: 1;
  letter-spacing: 0;
  text-transform: uppercase;
  color: #000000;

  // The thread, down from the top of the screen to just over the word.
  &::before {
    content: "";
    position: absolute;
    left: calc(50% + 6 * var(--u));
    bottom: calc(100% + 4.6 * var(--u));
    width: 1px;
    height: 200vh;
    background: rgb(var(--rgb-ink) / 0.2);
  }
}

.ce__title {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(124.9 * var(--u));
  text-align: center;
  font-family: var(--font-say);
  font-weight: 300;
  font-size: calc(45.5 * var(--u));
  line-height: 1;
  letter-spacing: 0;
  color: var(--c-wine);

  strong { font-weight: 700; }

  // The mask needs room for descenders the line-height-1 box does not give.
  .reveal-line {
    padding-bottom: 0.14em;
    margin-bottom: -0.14em;
  }
}

.ce__body {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(203.8 * var(--u));
  text-align: center;
  font-family: var(--font-say);
  font-weight: 400;
  font-size: max(11px, calc(17.8 * var(--u)));
  line-height: max(14px, calc(21.5 * var(--u)));
  color: #121212;

  span { display: block; }
}

.ce__row {
  position: absolute;
  left: calc(50% - 439.5 * var(--u));
  top: calc(299 * var(--u));
  display: flex;
  gap: calc(15 * var(--u));
  margin: 0;
  padding: 0;
  list-style: none;
}

.ce__photo {
  flex: none;
  width: calc(283 * var(--u));
  height: calc(283 * var(--u));
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: cover;
  }
}

/**
 * Portrait: the words stacked over a row of pictures that runs off the right
 * edge and can be swiped - the row the design draws at its frame's edge,
 * made a row a phone can hold.
 */
@media (orientation: portrait) {
  .ce__stage {
    --m: min(calc(100vw / 390), calc(var(--vh, 1vh) * 100 / 844));
  }

  .ce__frame {
    top: 0;
    bottom: 0;
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .ce__eyebrow,
  .ce__title,
  .ce__body,
  .ce__row {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
  }

  .ce__eyebrow {
    padding-inline: calc(20 * var(--m));
    font-size: calc(13 * var(--m));

    &::before {
      left: calc(50% + 6 * var(--m));
      bottom: calc(100% + 14 * var(--m));
    }
  }

  .ce__title {
    margin-top: calc(18 * var(--m));
    font-size: calc(34 * var(--m));
    line-height: calc(40 * var(--m));

    strong { display: block; }
  }

  .ce__body {
    margin-top: calc(18 * var(--m));
    padding-inline: calc(24 * var(--m));
    font-size: calc(15 * var(--m));
    line-height: 1.5;

    span { display: inline; }
    span + span::before { content: " "; }
  }

  .ce__row {
    align-self: stretch;
    margin-top: calc(28 * var(--m));
    gap: calc(12 * var(--m));
    padding: 0 calc(20 * var(--m));
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: calc(20 * var(--m));
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar { display: none; }
  }

  .ce__photo {
    width: 72vw;
    height: 72vw;
    max-width: calc(var(--vh, 1vh) * 34);
    max-height: calc(var(--vh, 1vh) * 34);
    scroll-snap-align: start;
  }
}
</style>
