<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ progress: number; chapter: string; index: number; total: number }>();
const emit = defineEmits<{ jump: [id: string] }>();

const pad = (n: number) => String(n).padStart(2, "0");
const readout = computed(() => `${pad(props.index + 1)} / ${pad(props.total)}`);

// Never quite zero. At the very top the rule would otherwise be an empty
// channel, and an empty channel reads as a missing element rather than as a
// measure with nothing in it yet.
const filled = computed(() => Math.max(0.008, Math.min(1, props.progress)));
</script>

<template>
  <header class="head">
    <a class="head__mark" href="#top" data-cursor="Top" @click.prevent="emit('jump', 'top')">
      <span class="head__glyph" aria-hidden="true" />
      <span class="head__name">Halcyon</span>
    </a>

    <div class="head__meta">
      <!-- The rule sits above the readout, and it is the page's own progress:
           it fills left to right and is full at the foot of the document. -->
      <div class="head__bar" aria-hidden="true">
        <i :style="{ transform: `scaleX(${filled})` }" />
      </div>
      <div class="head__readout">
        <span class="head__chapter">{{ chapter }}</span>
        <span class="head__count">{{ readout }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.head {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 60;
  // Three tracks, so the wordmark is optically centred in the frame rather than
  // centred in whatever space the meta block leaves it. The hero used to print
  // its own copy of the mark because this one sat hard left; there is only one
  // now, and it is here.
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 1rem;
  padding: clamp(1.1rem, 2.4vw, 1.9rem) var(--gutter);
  mix-blend-mode: difference;
}

.head__mark {
  grid-column: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  justify-self: center;
}

.head__glyph {
  width: 0.62rem;
  height: 0.62rem;
  border-radius: 50%;
  border: 1px solid var(--c-accent);
  // A slow pulse, tied to nothing — it is the one piece of motion that keeps
  // going while the page is still, so the site never looks frozen.
  animation: mark-pulse 4.6s var(--e-in-out-cubic) infinite;
}

@keyframes mark-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(0.6); opacity: 0.55; }
}

.head__name {
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
}

.head__meta {
  grid-column: 3;
  justify-self: end;
  position: relative;
  display: grid;
  gap: clamp(0.5rem, 1vh, 0.8rem);
  justify-items: stretch;
  min-width: clamp(9rem, 18vw, 15rem);
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
}

.head__readout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.7rem, 1.6vw, 1.4rem);
}

.head__chapter {
  color: var(--c-bone);
  @media (max-width: 40rem) { display: none; }
}

.head__count {
  color: var(--c-bone-dim);
  font-variant-numeric: tabular-nums;
}

.head__bar {
  position: relative;
  width: 100%;
  height: 1px;
  background: var(--c-bone-faint);
  overflow: hidden;

  i {
    position: absolute;
    inset: 0;
    // Was `--c-mint`, which this project has never defined — so the fill was
    // painting an invalid colour and the rule read as a static line at every
    // scroll position. The token is `--c-accent`.
    background: var(--c-accent);
    transform-origin: left center;
    // No transition: the value already arrives eased from the scroll engine,
    // and a second easing here would make the bar lag the page visibly.
  }
}
</style>
