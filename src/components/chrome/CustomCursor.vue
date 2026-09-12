<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps<{ x: number; y: number; down: boolean; enabled: boolean }>();

const dot = ref<HTMLElement | null>(null);
const ring = ref<HTMLElement | null>(null);
const label = ref("");
const mode = ref<"idle" | "scale" | "next" | "label">("idle");

let frame = 0;
// The dot tracks the pointer exactly; the ring lags behind it. The distance
// between the two is the whole effect — one element moving at one speed reads
// as a laggy cursor rather than a deliberate one.
let rx = 0, ry = 0;

// `data-cursor` is the contract: a bare keyword changes the cursor's shape, and
// anything else becomes a caption. Declared on the element so a section can
// describe its own affordance without importing anything.
const KEYWORDS = new Set(["scale", "drag", "view", "sound"]);

// `next` is its own shape rather than a caption: the ring opens to a disc with
// an arrow in it, which is what the reference puts over a carousel. A word
// there would be read as a label for the quote underneath it.
const SHAPES = new Set(["next"]);

const scaleFor = () => {
  if (mode.value === "scale") return 1.85;
  if (mode.value === "next") return 2.6;
  if (mode.value === "label") return 2.4;
  return 1;
};

const tick = () => {
  frame = requestAnimationFrame(tick);
  rx += (props.x - rx) * 0.14;
  ry += (props.y - ry) * 0.14;
  if (dot.value) {
    dot.value.style.transform = `translate3d(${props.x}px, ${props.y}px, 0) translate(-50%, -50%)`;
  }
  if (ring.value) {
    ring.value.style.transform =
      `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${scaleFor() * (props.down ? 0.88 : 1)})`;
  }
};

const onOver = (event: PointerEvent) => {
  const target = (event.target as HTMLElement | null)?.closest?.("[data-cursor], a, button");
  if (!target) { mode.value = "idle"; label.value = ""; return; }

  const value = target.getAttribute("data-cursor") ?? "";
  if (SHAPES.has(value)) {
    mode.value = value as "next";
    label.value = "";
  } else if (!value || KEYWORDS.has(value)) {
    mode.value = "scale";
    label.value = "";
  } else {
    mode.value = "label";
    label.value = value;
  }
};

onMounted(() => {
  rx = props.x; ry = props.y;
  frame = requestAnimationFrame(tick);
  window.addEventListener("pointerover", onOver, { passive: true });
});

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener("pointerover", onOver);
});
</script>

<template>
  <div v-if="enabled" class="cursor" aria-hidden="true">
    <div ref="ring" class="cursor__ring" :class="[`is-${mode}`]">
      <svg v-if="mode === 'next'" class="cursor__arrow" viewBox="0 0 24 12" aria-hidden="true">
        <path d="M0 6h21M16 1l5 5-5 5" />
      </svg>
      <span v-else-if="label" class="cursor__label">{{ label }}</span>
    </div>
    <div ref="dot" class="cursor__dot" :class="{ 'is-hidden': mode !== 'idle' }" />
  </div>
</template>

<style scoped lang="scss">
// Above everything, without exception. The reset hides the system cursor on
// pointer devices, so this is not decoration layered over the page — it is the
// only cursor there is, and anything that covers it leaves the reader with
// none. At 90 it sat under the splash gate's 100, which is exactly where a
// visitor meets the site first.
.cursor {
  position: fixed;
  inset: 0;
  z-index: 200;
  pointer-events: none;
  // Inverted against whatever it is over, rather than painted one colour.
  //
  // The system cursor is hidden on pointer devices, so this is the only
  // cursor there is — and drawn in bone it vanished completely over the near
  // white reading panel. A reader could not see what they were pointing at and
  // the close control read as unclickable even though it was receiving the
  // click. Difference blending means it is always the opposite of its ground:
  // dark on the light sections, light on the field.
  mix-blend-mode: difference;
}

.cursor__dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #FFFFFF;
  will-change: transform;
  transition: opacity var(--t-hover) var(--e-none);

  // The dot stands down when the ring takes over, so the two never read as
  // two cursors at once.
  &.is-hidden { opacity: 0; }
}

.cursor__ring {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(255 255 255 / 0.45);
  border-radius: 50%;
  will-change: transform;
  transition: border-color var(--t-hover) var(--e-none), background-color var(--t-hover) var(--e-none);

  &.is-scale, &.is-label, &.is-next {
    border-color: rgb(255 255 255 / 0.85);
    background: rgb(255 255 255 / 0.12);
  }
}

// Drawn at the ring's own scale, so it does not grow with it into a banner.
.cursor__arrow {
  width: 9px;
  height: 4.5px;
  overflow: visible;

  path {
    fill: none;
    stroke: #FFFFFF;
    stroke-width: 1.6;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.cursor__label {
  font-family: "Space Grotesk", monospace;
  font-size: 0.5rem;
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: #FFFFFF;
  white-space: nowrap;
}
</style>
