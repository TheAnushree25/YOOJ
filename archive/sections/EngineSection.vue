<script setup lang="ts">
import SplitHeading from "../SplitHeading.vue";
const specs = [
  ["Cadence", "Continuous, reviewed weekly"],
  ["Inputs", "Sleep, activity, routine, self-report"],
  ["Output", "A ranked queue, with reasons"],
  ["Data", "Exportable and deletable, always"],
];
</script>

<template>
  <section id="engine" class="section engine">
    <div class="ambient ambient--screen" aria-hidden="true">
      <img src="/ambient/signal.png" alt="" decoding="async" loading="lazy">
    </div>

    <div class="wrap engine__grid">
      <div class="engine__lead">
        <SplitHeading
          as="p"
          class="label"
          mode="chars"
          :lines="['The instrument']"
          :rise="14"
        />
        <SplitHeading
          as="h2"
          class="h1 engine__h"
          mode="chars"
          :lines="['Meet Tideline']"
        />
        <p v-reveal="160" class="lead engine__p">
          Tideline watches a personal baseline drift and says when the drift is
          worth a clinician's attention. It ranks who to see next and shows the
          working behind the rank, so the judgement stays human and the search
          stops being manual.
        </p>
        <a v-reveal="240" class="btn" href="#contact" data-cursor="Read">
          <span>How it works</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
        </a>
      </div>

      <dl v-reveal="200" class="engine__specs">
        <div v-for="[k, v] in specs" :key="k" class="spec">
          <dt>{{ k }}</dt>
          <dd>{{ v }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped lang="scss">
.engine { position: relative; overflow: hidden; }

.engine__grid {
  position: relative;
  z-index: 1;
  display: grid;
  gap: clamp(2.4rem, 6vw, 5rem);
  align-items: start;

  @media (min-width: 62rem) { grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); }
}

.engine__lead { display: grid; gap: clamp(1rem, 2.6vh, 1.8rem); justify-items: start; }
.engine__h { max-width: 12ch; }
.engine__p { max-width: 44ch; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.6rem;
  padding: 0.85rem 1.5rem;
  border: 1px solid var(--c-bone-faint);
  border-radius: 999px;
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  transition: border-color 0.5s var(--e-out-quart), background-color 0.5s var(--e-out-quart);

  svg { width: 1rem; height: 1rem; transition: transform 0.5s var(--e-out-quart); }

  &:hover {
    border-color: var(--c-mint);
    background: rgba(127, 209, 185, 0.08);
    svg { transform: translateX(0.24rem); }
  }
}

.engine__specs { display: grid; border-top: 1px solid var(--c-line); }

.spec {
  display: grid;
  grid-template-columns: 9rem minmax(0, 1fr);
  gap: 1rem;
  padding: clamp(0.9rem, 2.2vh, 1.3rem) 0;
  border-bottom: 1px solid var(--c-line);

  dt {
    font-family: "Space Grotesk", monospace;
    font-size: var(--t-label);
    letter-spacing: var(--ls-label);
    text-transform: uppercase;
    color: var(--c-mint);
  }

  dd { color: var(--c-bone-dim); }
}
</style>
