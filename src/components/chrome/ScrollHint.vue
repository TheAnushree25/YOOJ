<script setup lang="ts">
defineProps<{ hidden: boolean }>();
const letters = "Scroll".split("");
</script>

<template>
  <div class="hint" :class="{ 'is-hidden': hidden }" aria-hidden="true">
    <span class="hint__word">
      <!-- Per-letter spans so the word can breathe as a wave rather than
           blinking as one block. -->
      <i v-for="(l, i) in letters" :key="i" :style="{ animationDelay: `${i * 90}ms` }">{{ l }}</i>
    </span>
    <span class="hint__line" />
  </div>
</template>

<style scoped lang="scss">
.hint {
  position: fixed;
  bottom: clamp(1.1rem, 2.6vw, 1.9rem);
  left: var(--gutter);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  transition: opacity 0.6s var(--e-out-quart), transform 0.6s var(--e-out-quart);

  &.is-hidden {
    opacity: 0;
    transform: translateY(0.5rem);
    pointer-events: none;
  }
}

.hint__word {
  display: inline-flex;
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: var(--c-bone-dim);

  i {
    font-style: normal;
    animation: hint-wave 2.8s var(--e-in-out-cubic) infinite;
  }
}

@keyframes hint-wave {
  0%, 62%, 100% { opacity: 0.45; transform: translateY(0); }
  28%           { opacity: 1;    transform: translateY(-0.18em); }
}

.hint__line {
  width: 2.6rem;
  height: 1px;
  background: var(--c-bone-faint);
  overflow: hidden;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--c-accent);
    transform-origin: left center;
    animation: hint-sweep 2.8s var(--e-in-out-quart) infinite;
  }
}

@keyframes hint-sweep {
  0%        { transform: scaleX(0); transform-origin: left center; }
  45%       { transform: scaleX(1); transform-origin: left center; }
  46%, 100% { transform: scaleX(0); transform-origin: right center; }
}
</style>
