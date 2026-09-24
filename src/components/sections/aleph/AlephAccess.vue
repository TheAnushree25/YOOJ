<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { onDark } from "../../../lib/session";

/**
 * The ask, and the end of the page.
 *
 * Everything above is a held frame; this is the one place the reader is invited
 * to do something rather than watch. So it is ordinary flow, ordinary type, and
 * the only saturated mark on the page is the button — which is the point.
 *
 * The ground is a pale field with broad diagonals cut across it. They are drawn
 * as gradients rather than as elements: at this scale and this little contrast,
 * an element would be a box to keep in position at every viewport, and a
 * gradient is a paint instruction that cannot be out of place.
 */

const root = ref<HTMLElement | null>(null);
const p = ref(0);
let trigger: ReturnType<typeof scrubThrough> = null;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const beat = (from: number, to: number) => ease(clamp01((p.value - from) / (to - from)));

/**
 * The form the brief asks for: who you are, and how to reach you.
 *
 * Five fields and one choice, in two columns: the business name and the choice
 * share the last row, since they are the two halves of one question. Nothing
 * here is sent anywhere yet — there is no endpoint — so the submit is
 * prevented and the markup is kept real, so that connecting it later is a
 * handler rather than a rebuild.
 */
const fields = [
  { name: "name", label: "Name", type: "text", autocomplete: "name", inputmode: "text" },
  { name: "phone", label: "Phone Number", type: "tel", autocomplete: "tel", inputmode: "tel" },
  { name: "city", label: "City", type: "text", autocomplete: "address-level2", inputmode: "text" },
  { name: "email", label: "Email", type: "email", autocomplete: "email", inputmode: "email" },
  { name: "business", label: "Business Name", type: "text", autocomplete: "organization", inputmode: "text" },
] as const;
const whoOptions = ["Clinic OPDs", "Pathology", "Radiology", "Pharmacy"] as const;
const entry = ref<Record<string, string>>({
  name: "", phone: "", city: "", email: "", business: "", who: "",
});

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) { p.value = 1; onDark.value = true; return; }
  trigger = scrubThrough(root.value, (v, active) => {
    p.value = v;
    // The last section is dark again, so the chrome changes back with it. The
    // pale page between them is the only light ground left on this route.
    if (active) onDark.value = true;
  }, { start: "top 88%", end: "bottom bottom" });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="aleph-access" ref="root" class="ac ground-drift">
    <span class="ac__ring" aria-hidden="true" />

    <h2 class="ac__say">
      <span
        v-for="(line, i) in ['Join the', 'YOOJ network']"
        :key="i"
        :style="{
          opacity: beat(0.04 + i * 0.06, 0.24 + i * 0.06),
          transform: `translate3d(0, ${((1 - beat(0.04 + i * 0.06, 0.28 + i * 0.06)) * 1.4).toFixed(2)}rem, 0)`,
        }"
      >{{ line }}</span>
    </h2>

    <p
      class="ac__copy"
      :style="{
        opacity: beat(0.2, 0.4),
        transform: `translate3d(0, ${((1 - beat(0.2, 0.44)) * 1).toFixed(2)}rem, 0)`,
      }"
    >
      YOOJ is building a connected primary-care network along with an existing
      infrastructure in India.
    </p>

    <!-- Nothing is wired to a recipient: there is no endpoint for this yet, and
         a form that looks like it sends and does not is worse than one that
         plainly does not. The markup is real so that connecting it later is a
         handler and not a rebuild. -->
    <form
      class="ac__form"
      :style="{
        opacity: beat(0.3, 0.5),
        transform: `translate3d(0, ${((1 - beat(0.3, 0.54)) * 1).toFixed(2)}rem, 0)`,
      }"
      @submit.prevent
    >
      <label v-for="f in fields" :key="f.name" class="ac__field">
        <span class="ac__vh">{{ f.label }}</span>
        <input
          v-model="entry[f.name]"
          :type="f.type"
          :name="f.name"
          :autocomplete="f.autocomplete"
          :inputmode="f.inputmode"
          :placeholder="f.label"
          data-cursor="scale"
        >
      </label>
      <label class="ac__field ac__field--who" :class="{ 'is-set': entry.who }">
        <span class="ac__vh">You are</span>
        <select v-model="entry.who" name="who" data-cursor="scale">
          <option value="" disabled>You are</option>
          <option v-for="w in whoOptions" :key="w" :value="w">{{ w }}</option>
        </select>
        <!-- A pill with nothing to say it opens reads as one more field to
             type in; the chevron is the only thing that says "choose". -->
        <svg class="ac__chev" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
          <path d="M1 1.5 L6 6.5 L11 1.5" />
        </svg>
      </label>
      <button type="submit" class="ac__go" data-cursor="scale">Get in touch</button>
    </form>
  </section>
</template>

<style scoped lang="scss">
/**
 * The ground: the room, one last time.
 *
 * The page closes on the deep wine it travelled the corridor in rather than on
 * the pale page above it. An invitation is the one thing here the reader is
 * asked to act on, and it lands harder against the dark — on the pale ground
 * the white card had nothing to be bright against, and the section read as a
 * form pinned to a blank page.
 *
 * The two broad diagonals are paint, not elements: at this scale and this
 * little contrast an element would be a box to keep in position at every
 * viewport, and a gradient is a paint instruction that cannot be out of place.
 */
.ac {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: clamp(1.6rem, 4.5vh, 3rem);
  min-height: 100vh;
  min-height: calc(var(--vh, 1vh) * 100);
  padding: var(--stack) var(--gutter);
  text-align: center;
  color: #FFF5F6;
  overflow: hidden;
  background: var(--ground-dark);
  // Declared here, beside the shorthand, and not in the drift class.
  // `background:` resets `background-size` to auto, and a scoped rule outranks
  // an unscoped one — so the size set on .ground-drift was being thrown away
  // and a gradient exactly the size of its own box has nowhere to move to. The
  // position animated correctly and nothing on screen changed.
  background-size: 190% 190%;
}

// The reference's small open circle, high and to the left. It is the only
// thing on the page that is not type or the button, and it is there to stop
// the upper field being empty rather than to mean anything.
.ac__ring {
  position: absolute;
  left: clamp(2rem, 17vw, 16rem);
  top: clamp(4rem, 17vh, 11rem);
  width: 4.4rem;
  height: 4.4rem;
  border: 1px solid rgb(255 245 246 / 0.22);
  border-radius: 50%;
}

// 80 / 80 at -2px, over two lines. The measure is wide enough that the break
// falls where it is authored rather than wherever the column runs out.
.ac__say {
  display: grid;
  max-width: 20em;
  margin: 0;
  font-size: var(--ta-display);
  line-height: var(--la-display);
  letter-spacing: var(--ls-display);
  font-weight: 200;

  span { display: block; will-change: transform, opacity; }
}

// Two even lines rather than two and an orphan: at 28rem the sentence left
// "India." standing on a line of its own.
.ac__copy {
  max-width: 31rem;
  text-wrap: balance;
  color: rgb(255 245 246 / 0.82);
  margin: 0;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  will-change: transform, opacity;
}

/* ----------------------------------------------------------------- the ask */

// One card holding the fields: two columns of pills, the choice across the
// full width beneath them, and the one saturated control on the page last.
.ac__form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  width: min(38rem, 92vw);
  margin-top: clamp(0.6rem, 2vh, 1.4rem);
  padding: 0.6rem;
  background: #FFFFFF;
  border-radius: 1.8rem;
  box-shadow: 0 1px 2px rgb(20 3 9 / 0.3), 0 18px 60px rgb(20 3 9 / 0.45);
  will-change: transform, opacity;

  @media (max-width: 34rem) { grid-template-columns: 1fr; }
}

.ac__field { display: block; }

.ac__field input,
.ac__field select {
  width: 100%;
  padding: 1.05rem 1.4rem;
  border: 0;
  border-radius: 999px;
  background: rgb(254 179 184 / 0.18);
  font: inherit;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  color: var(--ga-ink);

  &::placeholder { color: rgb(60 1 14 / 0.45); }

  // Never remove the ring without replacing it: these are the only controls
  // on the page and they have to be findable from the keyboard.
  &:focus { outline: none; }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; }
}

.ac__field select {
  appearance: none;
  cursor: pointer;
  // Room for the chevron, so a long choice never runs under it.
  padding-right: 3rem;
}

// Beside the business name, not across the card: the choice is the second
// half of the same question.
.ac__field--who {
  position: relative;

  // Until something is chosen, "You are" is a prompt like the placeholders
  // beside it, and is set in their tint rather than as an answer.
  &:not(.is-set) select { color: rgb(60 1 14 / 0.45); }
}

.ac__chev {
  position: absolute;
  right: 1.4rem;
  top: 50%;
  width: 0.7rem;
  height: 0.7rem;
  translate: 0 -50%;
  overflow: visible;
  pointer-events: none;

  path {
    fill: none;
    stroke: var(--ga-ink);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }
}

// The options list is drawn by the system, on its own ground, and would
// otherwise inherit the prompt's tint.
.ac__field option { color: var(--ga-ink); }

.ac__go {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.9em;
  padding: 1.05rem clamp(1.4rem, 3vw, 2.2rem);
  border: 0;
  border-radius: 999px;
  background: var(--ga-ink);
  color: #FFFFFF;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--ta-label);
  line-height: var(--la-label);
  letter-spacing: var(--ls-fine);
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.4s var(--e-out-quart), transform 0.4s var(--e-out-quart);

  &::before {
    content: "";
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: #FEB3B8;
  }

  &:hover { background: #520E22; transform: translateY(-1px); }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; }
}

// Present for a screen reader, absent for everyone else — the visible label is
// the placeholder, and a placeholder is not a label.
.ac__vh {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .ac__say span,
  .ac__copy,
  .ac__form {
    opacity: 1 !important;
    transform: none !important;
  }

  .ac__go { transition: none; }
}
</style>
