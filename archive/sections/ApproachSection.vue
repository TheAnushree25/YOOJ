<script setup lang="ts">
import SplitHeading from "../SplitHeading.vue";
const rows = [
  { k: "Signal", h: "Passive and asked", p: "Sleep, activity and routine come from a wearable the person already owns. Everything subjective is asked, briefly, and never inferred." },
  { k: "Model",  h: "Personal baselines", p: "A change is only meaningful against that person's own normal, so every model is fitted per individual rather than to a population average." },
  { k: "Review", h: "Clinician in the loop", p: "Every flag lands in a queue a human clears. The system proposes, ranks and explains; it never contacts anyone on its own." },
];
</script>

<template>
  <section id="approach" class="section section--light approach">
    <div class="ambient ambient--faint" aria-hidden="true">
      <img src="/ambient/clinic.jpg" alt="" decoding="async" loading="lazy">
    </div>

    <div class="wrap">
      <SplitHeading
        as="p"
        class="label"
        mode="chars"
        :lines="['Approach']"
        :rise="14"
      />
      <SplitHeading
        as="h2"
        class="h1 approach__h"
        mode="lines"
        :lines="['Three moving', 'parts, one loop.']"
      />

      <div class="approach__rows">
        <div v-reveal class="rule" />
        <article v-for="(r, i) in rows" :key="r.k" class="row" :style="{ '--d': `${i * 90}ms` }">
          <div v-reveal class="row__inner">
            <span class="row__k">{{ r.k }}</span>
            <h3 class="h3 row__h">{{ r.h }}</h3>
            <p class="row__p">{{ r.p }}</p>
          </div>
          <div v-reveal class="rule" />
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.approach { position: relative; overflow: hidden; }

.approach .wrap { position: relative; z-index: 1; }

// On the pale ground the eyebrow carries the indigo and the body goes to ink.
.approach .row__k { color: var(--c-indigo); }
.approach .row__p { color: rgba(11, 29, 51, 0.62); }

.approach__h { max-width: 14ch; margin: clamp(1.2rem, 3vh, 2rem) 0 clamp(3rem, 9vh, 5.5rem); }

.row__inner {
  display: grid;
  gap: clamp(0.6rem, 1.6vw, 1.4rem);
  padding: clamp(1.6rem, 4vh, 2.8rem) 0;
  grid-template-columns: minmax(0, 1fr);

  @media (min-width: 60rem) {
    grid-template-columns: 8rem 22ch minmax(0, 1fr);
    align-items: baseline;
  }
}

.row__k {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-mint);
}

.row__p { color: var(--c-bone-dim); max-width: 46ch; }
</style>
