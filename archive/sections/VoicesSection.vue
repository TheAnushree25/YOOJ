<script setup lang="ts">
import SplitHeading from "../SplitHeading.vue";
// Composite illustrations drawn from published research themes on access and
// continuity, written for this page. Attributed by role only — no real person
// is quoted here, and none should be invented to look like one.
const voices = [
  { q: "The waiting is the part nobody prepares you for. By the time the appointment came round, the thing I needed help with had already changed shape.", r: "Illustrative — service user, adult pathway" },
  { q: "I have the notes and I have the person in front of me. What I do not have is what happened in the eleven weeks between.", r: "Illustrative — primary care clinician" },
  { q: "Every handover means telling it again from the start. You get good at the summary and worse at the truth.", r: "Illustrative — service user, transferred care" },
];
</script>

<template>
  <section id="voices" class="section voices">
    <div class="voices__portrait" aria-hidden="true">
      <img src="/people/voices.png" alt="" decoding="async" loading="lazy">
    </div>

    <div class="wrap">
      <SplitHeading
        as="p"
        class="label"
        mode="chars"
        :lines="['Why this work']"
        :rise="14"
      />
      <SplitHeading
        as="h2"
        class="h1 voices__h"
        mode="lines"
        :lines="['The same three problems,', 'everywhere we looked.']"
      />

      <div class="voices__grid">
        <figure v-for="(v, i) in voices" :key="i" v-reveal="i * 120" class="voice">
          <span class="voice__quote" aria-hidden="true">&ldquo;</span>
          <blockquote class="voice__q">{{ v.q }}</blockquote>
          <figcaption class="voice__r">{{ v.r }}</figcaption>
        </figure>
      </div>

      <p v-reveal class="voices__note">
        These are composites written to describe documented patterns in access,
        continuity and reassessment. They are not quotations from individuals.
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
.voices { position: relative; overflow: hidden; }

// Held to the right and below the grid, so she reads as someone present in the
// section rather than an illustration of any one quote in it.
.voices__portrait {
  position: absolute;
  right: -6%;
  bottom: 0;
  width: min(46%, 34rem);
  z-index: 0;
  pointer-events: none;
  opacity: 0.5;
  mask-image: linear-gradient(to bottom, #000 55%, transparent 96%);

  img { width: 100%; height: auto; }

  @media (max-width: 62rem) { display: none; }
}

.voices__grid, .voices__note { position: relative; z-index: 1; }

.voices__h { max-width: 16ch; margin: clamp(1.2rem, 3vh, 2rem) 0 clamp(3rem, 9vh, 5.5rem); }

.voices__grid {
  display: grid;
  gap: clamp(1.4rem, 3vw, 2.2rem);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
}

.voice {
  position: relative;
  display: grid;
  gap: 1.1rem;
  align-content: start;
  padding: clamp(1.6rem, 3.4vw, 2.4rem);
  border: 1px solid var(--c-line);
  background: rgba(8, 26, 24, 0.34);
  backdrop-filter: blur(6px);
  transition: border-color 0.6s var(--e-out-quart), transform 0.6s var(--e-out-quart);

  &:hover { border-color: rgba(127, 209, 185, 0.34); transform: translateY(-3px); }
}

.voice__quote {
  font-size: 3rem;
  line-height: 0.6;
  color: var(--c-mint);
  opacity: 0.5;
}

.voice__q { font-size: var(--t-lead); line-height: 1.45; }

.voice__r {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-bone-dim);
}

.voices__note {
  margin-top: clamp(1.6rem, 4vh, 2.6rem);
  max-width: 52ch;
  font-size: var(--t-label);
  letter-spacing: 0.04em;
  color: var(--c-bone-dim);
}
</style>
