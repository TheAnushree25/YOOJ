<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import gsap from "gsap";
import { RouterLink } from "vue-router";
import { splitText } from "../../composables/useSplitText";

const props = withDefaults(defineProps<{
  label: string;
  href?: string;
  /**
   * A route, when the control leads to another page.
   *
   * Given this, the control renders as a RouterLink rather than a bare
   * anchor: the page swaps instead of reloading - which on this site means
   * the gate does not run a second time - and the link still behaves like a
   * link, so middle-click and open-in-new-tab keep working.
   */
  to?: string;
  variant?: "line" | "solid";
}>(), { href: "#", variant: "line" });

const emit = defineEmits<{ activate: [] }>();

const root = ref<HTMLElement | null>(null);
const labelEl = ref<HTMLElement | null>(null);
const dot = ref<HTMLElement | null>(null);

let revert: (() => void) | null = null;
let chars: HTMLElement[] = [];

/**
 * The hover is two movements against each other: the dot travels the width of
 * the control while the label yields a little to make room. Done as one
 * timeline so the two can never desynchronise on a fast in-out.
 */
const enter = () => {
  if (!root.value || !dot.value) return;
  const travel = root.value.offsetWidth - dot.value.offsetWidth - 24;
  gsap.to(dot.value, { x: travel, duration: 0.55, ease: "expo.out", overwrite: "auto" });
  gsap.to(labelEl.value, { x: -8, duration: 0.55, ease: "expo.out", overwrite: "auto" });
  gsap.to(chars, {
    y: -2,
    duration: 0.4,
    ease: "power2.out",
    stagger: { each: 0.012, from: "start" },
    overwrite: "auto",
  });
};

const leave = () => {
  gsap.to([dot.value, labelEl.value], { x: 0, duration: 0.65, ease: "expo.out", overwrite: "auto" });
  gsap.to(chars, {
    y: 0,
    duration: 0.45,
    ease: "power2.out",
    stagger: { each: 0.012, from: "end" },
    overwrite: "auto",
  });
};

onMounted(() => {
  if (!labelEl.value) return;
  const split = splitText(labelEl.value, "chars");
  chars = split.parts;
  revert = split.revert;
});

onBeforeUnmount(() => revert?.());
</script>

<template>
  <component
    :is="to ? RouterLink : 'a'"
    ref="root"
    class="act"
    :class="`act--${variant}`"
    v-bind="to ? { to } : { href }"
    data-cursor="scale"
    @pointerenter="enter"
    @pointerleave="leave"
    @click="emit('activate')"
  >
    <span ref="dot" class="act__dot" aria-hidden="true" />
    <span ref="labelEl" class="act__label">{{ label }}</span>
  </component>
</template>

<style scoped lang="scss">
.act {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.95rem 1.6rem;
  border-radius: 999px;
  border: 1px solid var(--c-bone-faint);
  font-family: "Space Grotesk", monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  overflow: hidden;
  transition: border-color var(--t-hover) var(--e-none), background-color var(--t-hover) var(--e-none), color var(--t-hover) var(--e-none);

  &:hover { border-color: var(--c-accent); }

  // The primary action. Indigo rather than the cyan accent: the accent is
  // already doing the work of every label and rule on the page, and a call to
  // action that shares its colour stops being the loudest thing on screen.
  &--solid {
    background: var(--c-indigo);
    border-color: var(--c-indigo);
    color: var(--c-bone);
    &:hover { background: #B81A42; border-color: #B81A42; }
  }
}

.act__dot {
  width: 0.44rem;
  height: 0.44rem;
  border-radius: 50%;
  background: var(--c-accent);
  flex: none;
  will-change: transform;

  .act--solid & { background: var(--c-accent); }
}

.act__label {
  display: inline-block;
  will-change: transform;
}
</style>
