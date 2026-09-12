<script setup lang="ts">
import SplitHeading from "../SplitHeading.vue";
import { onMounted, ref } from "vue";
import { parallax } from "../../composables/useMotion";

const backdrop = ref<HTMLImageElement | null>(null);
// The backdrop drifts against the scroll. Depth here is a difference in rate
// between the image and the copy over it, nothing more.
onMounted(() => { if (backdrop.value) parallax(backdrop.value, 0.18); });
// A long section on purpose: the copy is metered out over several viewports so
// the reader arrives at each line rather than scanning a wall of them.
const beats = [
  {
    k: "01",
    h: "A mind is weather, not a photograph",
    p: "Most assessment captures a single day and treats it as a diagnosis. Mood, sleep, focus and load move continuously, and the interesting signal lives in how they move together.",
  },
  {
    k: "02",
    h: "The gap is time, not intent",
    p: "Clinicians are not short of judgement. They are short of the weeks between a question being asked and an answer arriving. We build to close that distance.",
  },
  {
    k: "03",
    h: "Instruments, not verdicts",
    p: "Nothing here decides anything about a person. The work is to show a clinician a clearer picture sooner, and to show a person their own pattern in language they recognise.",
  },
];
</script>

<template>
  <section id="vision" class="section vision">
    <div class="ambient ambient--soft" aria-hidden="true">
      <img ref="backdrop" src="/ambient/vision.jpg" alt="" decoding="async" loading="lazy">
    </div>

    <div class="wrap">
      <SplitHeading
        as="p"
        class="label"
        mode="chars"
        :lines="['Vision']"
        :rise="14"
      />

      <SplitHeading
        as="h2"
        class="h1 vision__lede"
        mode="lines"
        :lines="['We measure the shape', 'of a week, not the', 'mood of a minute.']"
      />

      <div class="vision__beats">
        <article v-for="(b, i) in beats" :key="b.k" class="beat">
          <span v-reveal class="beat__key">{{ b.k }}</span>
          <div class="beat__body">
            <h3 v-reveal="80" class="h2 beat__h">{{ b.h }}</h3>
            <p v-reveal="160" class="lead beat__p">{{ b.p }}</p>
          </div>
          <div v-if="i < beats.length - 1" v-reveal class="rule beat__rule" />
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.vision { position: relative; overflow: hidden; }

.vision__lede {
  max-width: 18ch;
  margin: clamp(1.4rem, 4vh, 2.6rem) 0 clamp(4rem, 14vh, 9rem);
}

.vision__beats { display: grid; gap: clamp(4rem, 14vh, 9rem); }

.beat {
  display: grid;
  gap: clamp(1rem, 2.4vw, 2rem);
  grid-template-columns: minmax(0, 1fr);

  @media (min-width: 56rem) {
    grid-template-columns: 6rem minmax(0, 1fr);
    align-items: start;
  }
}

.beat__key {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: 0.2em;
  color: var(--c-mint);
  padding-top: 0.65em;
}

.beat__body { display: grid; gap: clamp(0.9rem, 2vh, 1.4rem); max-width: 34ch; }
.beat__h { max-width: 16ch; }
.beat__p { max-width: 44ch; }

.beat__rule {
  grid-column: 1 / -1;
  margin-top: clamp(2rem, 6vh, 4rem);
}
</style>
