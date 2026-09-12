<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { MOTION, reveal } from "../../composables/useMotion";

const props = withDefaults(defineProps<{
  /** One entry per typeset line. Kept explicit so line breaks are a design
      decision rather than whatever the current viewport happens to produce. */
  lines: string[];
  as?: string;
  mode?: "lines" | "words" | "chars";
  delay?: number;
  stagger?: number;
  rise?: number;
  immediate?: boolean;
}>(), {
  as: "h2",
  mode: "lines",
  delay: 0,
  immediate: false,
});

const root = ref<HTMLElement | null>(null);
const reverts: Array<() => void> = [];
const plays: Array<() => void> = [];

defineExpose({ play: () => plays.forEach((p) => p()) });

onMounted(async () => {
  await nextTick();
  if (!root.value) return;

  const lineEls = [...root.value.querySelectorAll<HTMLElement>("[data-line]")];

  lineEls.forEach((lineEl, i) => {
    const handle = reveal(lineEl, {
      mode: props.mode === "lines" ? "lines" : props.mode,
      // Lines hand off to each other; characters inside a line stagger on top
      // of that, so a three-line heading reads as three gestures, not thirty.
      delay: props.delay + i * (props.stagger ?? MOTION.handoff),
      stagger: props.mode === "lines" ? 0 : (props.stagger ?? MOTION.stagger),
      rise: props.rise,
      scrub: !props.immediate,
    });
    plays.push(handle.play);
    if (handle.revert) reverts.push(handle.revert);
  });

  if (props.immediate) plays.forEach((p) => p());
});

onBeforeUnmount(() => reverts.forEach((r) => r()));
</script>

<template>
  <component :is="as" ref="root" class="split">
    <span v-for="(line, i) in lines" :key="i" data-line class="split__line">{{ line }}</span>
  </component>
</template>

<style scoped lang="scss">
.split { display: block; }

.split__line {
  display: block;
  // The line box clips its own content so the parts rise out of nothing.
  // `overflow: hidden` on a display:block line is what gives the masked look.
  overflow: hidden;
  // The outer clip needs the same descender allowance as the inner one, or it
  // simply cuts the tails the inner box just made room for.
  padding-bottom: 0.18em;
  margin-bottom: -0.18em;
}
</style>
