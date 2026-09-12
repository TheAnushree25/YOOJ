<script setup lang="ts">
import ActionButton from "../ui/ActionButton.vue";
import SplitHeading from "../ui/SplitHeading.vue";

/**
 * The fifth movement: the instrument, named.
 *
 * Everything before this argues that a week has a shape and that nobody is
 * currently reading it. This is the one section that says what we built, and it
 * is deliberately the plainest on the page — a centred statement, a paragraph
 * set off to one side, and a single control. After four sections of geometry a
 * reader who has decided to act should not have to hunt for the way in.
 *
 * Light ground, and the last one before the close. The page runs pale, deep,
 * pale, deep; arriving here from the navy of the principles is what makes the
 * closing section land as an ending rather than as another chapter.
 */

const title = ["The next shape of", "cognitive care"];

const body =
  "Tideline is the instrument we have in development. It reads a person's week "
  + "as one continuous signal — sleep, load, mood and focus moving together — and "
  + "puts the shape of a change in front of a clinician while there is still "
  + "something useful to do about it.";
</script>

<template>
  <section id="solution" class="sl">
    <div class="sl__wash" aria-hidden="true" />

    <div class="sl__inner">
      <SplitHeading
        as="h2"
        class="sl__h"
        mode="lines"
        :lines="title"
      />

      <div class="sl__note">
        <p v-reveal class="sl__eyebrow">Meet Tideline</p>
        <p v-reveal="120" class="sl__body">{{ body }}</p>
        <div v-reveal="240" class="sl__act">
          <ActionButton label="Discover the instrument" href="#contact" variant="solid" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.sl {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: clamp(7rem, 20vh, 14rem) 0 clamp(12rem, 34vh, 24rem);
  background: var(--c-bone);
}

// Light through a window: broad, soft diagonal bands rather than a smooth ramp.
// The reference's ground is not a gradient but a fan, and the bands are what
// keep a near-white section from reading as an empty div.
.sl__wash {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    linear-gradient(158deg, transparent 22%, rgba(255, 255, 255, 0.92) 42%, rgba(255, 255, 255, 0.5) 52%, transparent 66%),
    linear-gradient(202deg, transparent 28%, rgba(255, 255, 255, 0.7) 50%, transparent 70%),
    linear-gradient(136deg, rgba(255, 255, 255, 0.62) 4%, transparent 30%),
    radial-gradient(62% 58% at 2% 96%, #EBC0AC 0%, rgb(var(--rgb-accent) / 0.4) 40%, transparent 74%),
    linear-gradient(112deg, #EFC7B4 0%, #F6DFD4 30%, #FDF7F4 60%, #F7E6DD 100%);
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

// Set against the centre line rather than under it. A centred paragraph beneath
// a centred heading reads as a caption; offset, it reads as a note the heading
// is pointing at.
.sl__note {
  margin: clamp(3.5rem, 11vh, 7rem) auto 0;
  padding-inline: var(--gutter);
  width: min(38ch, 84vw);

  @media (min-width: 60rem) {
    margin-left: 50.5%;
    margin-right: 0;
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
