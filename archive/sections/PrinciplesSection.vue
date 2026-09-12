<script setup lang="ts">
import SplitHeading from "../SplitHeading.vue";
import { ref } from "vue";

const items = [
  { n: 1, h: "Consent is the interface", p: "A person can see every signal held about them, switch any of it off, and take the record with them. Nothing is collected that cannot be explained in a sentence." },
  { n: 2, h: "Explain or do not ship", p: "If we cannot say why a flag was raised in language a person understands, the flag does not leave the lab. Accuracy that cannot be inspected is not accuracy." },
  { n: 3, h: "Escalation beats prediction", p: "Reaching the right human quickly is worth more than forecasting a crisis precisely. We optimise for the handover, not the score." },
];

// One open at a time, first open by default: an accordion that starts fully
// closed reads as broken, and one that opens on hover fights a touch screen.
const open = ref(1);
const toggle = (n: number) => (open.value = open.value === n ? 0 : n);
</script>

<template>
  <section id="principles" class="section principles">
    <div class="wrap">
      <SplitHeading
        as="p"
        class="label"
        mode="chars"
        :lines="['Principles']"
        :rise="14"
      />
      <SplitHeading
        as="h2"
        class="h1 principles__h"
        mode="lines"
        :lines="['What we hold to', 'when it costs us.']"
      />

      <ul class="principles__list">
        <li v-for="(it, i) in items" :key="it.n" v-reveal="i * 100" class="pr" :class="{ 'is-open': open === it.n }">
          <button class="pr__head" :aria-expanded="open === it.n" @click="toggle(it.n)">
            <span class="pr__n">{{ String(it.n).padStart(2, "0") }}</span>
            <span class="h2 pr__h">{{ it.h }}</span>
            <span class="pr__sign" aria-hidden="true" />
          </button>
          <div class="pr__body"><p class="lead">{{ it.p }}</p></div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped lang="scss">
.principles__h { max-width: 15ch; margin: clamp(1.2rem, 3vh, 2rem) 0 clamp(3rem, 9vh, 5.5rem); }

.pr { border-top: 1px solid var(--c-line); &:last-child { border-bottom: 1px solid var(--c-line); } }

.pr__head {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr) 2rem;
  align-items: center;
  gap: clamp(0.8rem, 2vw, 1.6rem);
  width: 100%;
  padding: clamp(1.3rem, 3.4vh, 2.3rem) 0;
  text-align: left;
}

.pr__n {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  color: var(--c-mint);
}

.pr__h { transition: color 0.5s var(--e-out-quart); }
.pr:hover .pr__h, .pr.is-open .pr__h { color: var(--c-mint); }

.pr__sign {
  position: relative;
  width: 0.85rem;
  height: 0.85rem;
  justify-self: end;

  &::before, &::after {
    content: "";
    position: absolute;
    inset: 50% 0 auto;
    height: 1px;
    background: currentColor;
    transition: transform 0.5s var(--e-out-quart);
  }
  &::after { transform: rotate(90deg); }
}

.pr.is-open .pr__sign::after { transform: rotate(0deg); }

.pr__body {
  display: grid;
  grid-template-rows: 0fr;
  // `grid-template-rows` animates where `height: auto` cannot, so the panel
  // opens to its real content height without a measured pixel value.
  transition: grid-template-rows 0.65s var(--e-in-out-quart);

  > p {
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.5s var(--e-out-quart);

    // Indented to sit under the heading column, but only once that column
    // exists — on a narrow screen the grid is one column and an indent here
    // would just eat the line length.
    @media (min-width: 48rem) { padding-left: 4.8rem; }
  }
}

.pr.is-open .pr__body {
  grid-template-rows: 1fr;
  > p { opacity: 1; padding-bottom: clamp(1.3rem, 3.4vh, 2.3rem); }
}
</style>
