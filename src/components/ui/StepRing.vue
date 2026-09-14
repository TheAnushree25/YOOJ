<script setup lang="ts">
/**
 * The reference's step ring.
 *
 * A hairline circle with a number in it and an arc drawn round it — the arc is
 * how far through the current step the reader is, the number is which step.
 * It is set beside a run of statements and moves with them, so the reader can
 * see both where they are in the run and how much of this one is left, without
 * either being written down.
 *
 * Pure presentation. Whoever mounts it knows what a step is; this only draws.
 */
defineProps<{
  /** Zero-based; drawn one-based. */
  index: number;
  total: number;
  /** 0 to 1 through the current step. */
  progress: number;
  /** Set on a dark ground. */
  light?: boolean;
}>();

const R = 26;
const ARC = 2 * Math.PI * R;
</script>

<template>
  <div class="ring" :class="{ 'is-light': light }" aria-hidden="true">
    <svg viewBox="0 0 60 60">
      <circle class="ring__rail" cx="30" cy="30" :r="R" />
      <circle
        class="ring__arc"
        cx="30"
        cy="30"
        :r="R"
        :style="{ strokeDasharray: ARC, strokeDashoffset: (1 - Math.min(1, Math.max(0, progress))) * ARC }"
      />
    </svg>
    <span class="ring__n">{{ String(index + 1).padStart(2, "0") }}</span>
  </div>
</template>

<style scoped lang="scss">
.ring {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--ring-size, 3.6rem);
  height: var(--ring-size, 3.6rem);
  color: var(--ga-ink);

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    // Drawn from the top, clockwise.
    transform: rotate(-90deg);
    overflow: visible;
  }

  circle {
    fill: none;
    stroke: currentColor;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

.ring__rail { opacity: 0.28; }

.ring__arc {
  stroke-width: 1.4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.22s linear;
}

.ring__n {
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: 1;
  letter-spacing: var(--ls-fine);
  font-variant-numeric: tabular-nums;
}

.ring.is-light { color: #FFF5F6; }

@media (prefers-reduced-motion: reduce) {
  .ring__arc { transition: none; }
}
</style>
