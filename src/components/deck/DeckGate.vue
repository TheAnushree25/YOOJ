<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import BrandMark from "../ui/BrandMark.vue";
import { prefersReduced } from "../../composables/useMotion";
import { DeckError, rememberedEmail, requestAccess, type DeckAccess } from "../../lib/deck-api";

/**
 * The gate: an address for the deck.
 *
 * Laid out as the reference lays its own (mish-mash.co/deck): a photograph
 * the height of the screen on the left with the brand's statement over it,
 * and the ask on the right - the deck's name, one field, one press - on the
 * site's pale ground.
 *
 * The photograph is a YOOJ clinician in the brand's scrubs, on a studio ground
 * of the site's own wine (public/gate/nurse.jpg, and a 1280px copy for
 * phones). Its composition - subject right, clear ground left - is what the
 * layout below is built around.
 */

defineProps<{ notice?: string }>();
const emit = defineEmits<{ admit: [access: DeckAccess] }>();

const email = ref(rememberedEmail());
const busy = ref(false);
const error = ref("");
const field = ref<HTMLInputElement | null>(null);

/** Set a beat after mounting, so the page arrives rather than appearing. */
const ready = ref(false);
/** The address was accepted: the form steps back and the gate hands over. */
const launching = ref(false);

const reduced = prefersReduced();

// Enough to know when to wake the button. The server has the final word.
const valid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()));

let readyTimer: ReturnType<typeof setTimeout> | null = null;
let launchTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
  // A timer, not a frame: rAF does not run in a background tab, and the page
  // would wait there unarrived.
  readyTimer = setTimeout(() => { ready.value = true; }, 40);

  // Straight into the field on a desk; on a phone that would throw the
  // keyboard up over the page before the reader has seen it.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) field.value?.focus({ preventScroll: true });
});

onBeforeUnmount(() => {
  if (readyTimer) clearTimeout(readyTimer);
  if (launchTimer) clearTimeout(launchTimer);
});

const MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  busy: "Too many attempts just now. Please wait a minute and try again.",
  unavailable: "The deck isn’t available right now. Please try again later.",
  network: "We couldn’t reach the deck. Check your connection and try again.",
};

const submit = async () => {
  if (busy.value || launching.value) return;
  if (!valid.value) {
    error.value = MESSAGES.email;
    field.value?.focus();
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const access = await requestAccess(email.value.trim());
    // The form steps back first; the deck is handed over while it is still
    // going, so the viewer is already building up behind the fading gate.
    launching.value = true;
    launchTimer = setTimeout(() => emit("admit", access), reduced ? 0 : 280);
  } catch (e) {
    const code = e instanceof DeckError ? e.code : "server";
    error.value = MESSAGES[code] ?? "Something went wrong. Please try again.";
    busy.value = false;
    // After the field is enabled again, which is the next render.
    void nextTick(() => field.value?.focus());
  }
};
</script>

<template>
  <section class="gt" :class="{ 'is-ready': ready, 'is-launching': launching }">
    <div class="gt__hero">
      <img
        class="gt__photo"
        src="/gate/nurse.jpg"
        srcset="/gate/nurse-1280.jpg 1280w, /gate/nurse.jpg 1920w"
        sizes="(max-width: 60rem) 200vw, 90vw"
        width="1920"
        height="1080"
        alt=""
        decoding="async"
        fetchpriority="high"
        draggable="false"
      />
      <div class="gt__shade" aria-hidden="true" />

      <RouterLink class="gt__brand" to="/" data-cursor="scale" aria-label="YOOJ, back to the site">
        <BrandMark class="gt__glyph" />
        <span>YOOJ</span>
      </RouterLink>

      <div class="gt__say">
        <h1 class="gt__statement">
          <span class="gt__line">Better health</span>
          <span class="gt__line">for more lives</span>
          <span class="gt__line gt__line--strong">everyday<span class="gt__dot">.</span></span>
        </h1>
        <p class="gt__aside">
          Connecting the doctors, pharmacies, diagnostics and records that already
          exist into one trusted network.
        </p>
      </div>
    </div>

    <div class="gt__panel">
      <form class="gt__form" novalidate @submit.prevent="submit">
        <h2 class="gt__title">The deck<span class="gt__dot">.</span></h2>
        <p class="gt__lede">Enter your email to view the deck.</p>
        <p v-if="notice" class="gt__notice" role="status">{{ notice }}</p>

        <label class="gt__field">
          <span class="gt__hidden">Email address</span>
          <input
            ref="field"
            v-model="email"
            class="gt__input"
            type="email"
            name="email"
            autocomplete="email"
            inputmode="email"
            autocapitalize="off"
            spellcheck="false"
            placeholder="Email address"
            required
            :disabled="busy"
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'gt-error gt-fine' : 'gt-fine'"
            @input="error = ''"
          />
        </label>

        <button class="gt__submit" type="submit" :disabled="!valid || busy" data-cursor="scale">
          {{ busy ? "Opening…" : "View the deck" }}
        </button>
        <p v-if="error" id="gt-error" class="gt__error" role="alert">{{ error }}</p>

        <p class="gt__tagline">India’s primary healthcare needs a new trusted identity.</p>

        <RouterLink class="gt__back" to="/" data-cursor="scale">
          <span aria-hidden="true">←</span> Back to site
        </RouterLink>
      </form>

      <p id="gt-fine" class="gt__fine">
        Every page carries your email as a watermark, and each visit is recorded.
      </p>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

// 65 / 35, the reference's own split: the picture has the screen, the ask
// has a column.
.gt {
  display: grid;
  grid-template-columns: minmax(0, 65fr) minmax(0, 35fr);
  min-height: 100dvh;
}

/* ------------------------------------------------------------------- hero */

/**
 * The photograph's own wine continues past its edges: it is a studio ground,
 * lit in the middle and falling to the site's darkest wine at the rim, so the
 * panel is painted in the same fall and the picture's top edge is feathered
 * into it. A size container, so the picture and the words can be measured
 * against the panel's width.
 */
.gt__hero {
  position: relative;
  isolation: isolate;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding:
    calc(clamp(1.75rem, 3.6vw, 3.75rem) + var(--safe-t))
    clamp(1.75rem, 4vw, 4rem)
    clamp(2rem, 5vw, 5rem)
    max(clamp(1.75rem, 3.6vw, 4.4rem), var(--safe-l));
  color: #FFFFFF;
  background: radial-gradient(120% 95% at 72% 62%, #5A021B 0%, #440112 55%, #3B010F 100%);
}

/**
 * The photograph: its subject on the right, her ground on the left - which is
 * where the statement goes, so the two must never meet.
 *
 * Anchored to the panel's lower right and as tall as the panel - until the
 * panel is too narrow for that to keep her clear of the words. Past that
 * point it is held at 79% of the panel's width in height, which puts her
 * left edge at 45% of the panel on any window shape, and the band left above
 * her is the ground the top edge is feathered into.
 *
 * It drifts slowly nearer while the gate waits, from that same corner, so she
 * never walks into the words either.
 */
.gt__photo {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: -2;
  height: min(100%, 79cqw);
  width: auto;
  max-width: none;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 16%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 16%);
  transform-origin: 100% 100%;
  opacity: 0;
  transform: scale(1.06);
  transition: opacity 1.2s var(--e-out-quart), transform 2.4s var(--e-out-expo);
  -webkit-user-drag: none;

  .is-ready & {
    opacity: 1;
    transform: scale(1);
    animation: gt-drift 26s var(--e-in-out-quad) 2.4s infinite alternate;
  }

  .is-launching & {
    transform: scale(1.05);
    transition: transform 1.2s var(--e-out-expo);
    animation: none;
  }
}

@keyframes gt-drift {
  from { transform: scale(1); }
  to   { transform: scale(1.035); }
}

// Only where the words stand over the picture itself (a phone, below). On a
// wide screen they stand on the photograph's own clear ground, which needs
// nothing.
.gt__shade {
  position: absolute;
  inset: 0;
  z-index: -1;
  display: none;
  pointer-events: none;
}

.gt__brand {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.55em;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: clamp(1.1rem, 1.5vw, 1.55rem);
  line-height: 1;
  letter-spacing: 0.22em;
  color: #FFFFFF;
  transition: opacity var(--t-hover) var(--e-out-quart);

  &:focus-visible { outline: 2px solid #FEB3B8; outline-offset: 6px; border-radius: 4px; }
}

.gt__glyph { width: 1.3em; height: 1.3em; }

// The words keep to the photograph's clear ground: the left 45% of the panel,
// less a gap before her.
.gt__say {
  margin-top: auto;
  margin-bottom: auto;
  padding-top: clamp(2rem, 8vh, 6rem);
  max-width: calc(45cqw - 3.5rem);
}

// The hero's own voice: regular lines and a bold last word. Sized to that
// ground, so the longest line ("for more lives", about 6.35 of its own
// heights wide) ends before she begins at any width.
.gt__statement {
  font-family: var(--font-say);
  font-weight: 400;
  font-size: clamp(2.2rem, calc((45cqw - 5.5rem) / 6.4), 5.6rem);
  line-height: 1.02;
  letter-spacing: -0.028em;
  text-shadow: 0 2px 30px rgb(20 3 9 / 0.35);
}

.gt__line {
  display: block;
  opacity: 0;
  transform: translate3d(0, 1.4rem, 0);
  transition: opacity 1s var(--e-out-quart), transform 1.3s var(--e-out-expo);

  @for $i from 1 through 3 {
    &:nth-child(#{$i}) { transition-delay: #{0.25s + $i * 0.09s}; }
  }

  .is-ready & { opacity: 1; transform: none; }
}

.gt__line--strong { font-weight: 700; }

.gt__hero .gt__dot { color: #FEB3B8; }

.gt__aside {
  margin-top: clamp(1.25rem, 3vh, 2rem);
  max-width: min(33rem, 100%);
  font-family: var(--font-say);
  font-size: clamp(1rem, 1.3vw, 1.4rem);
  line-height: 1.5;
  color: rgb(255 255 255 / 0.9);
  text-wrap: pretty;
  opacity: 0;
  transform: translate3d(0, 1rem, 0);
  transition: opacity 1s var(--e-out-quart) 0.65s, transform 1.3s var(--e-out-expo) 0.65s;

  .is-ready & { opacity: 1; transform: none; }
}

/* ------------------------------------------------------------------ panel */

/**
 * The ask, on the site's pale ground (DeckView paints it behind the whole
 * page), washed whiter at the top the way the reference's panel is white.
 */
.gt__panel {
  position: relative;
  display: grid;
  place-items: center;
  padding:
    calc(clamp(2.5rem, 7vh, 5rem) + var(--safe-t))
    max(clamp(1.75rem, 3vw, 3.25rem), var(--safe-r))
    calc(clamp(4rem, 9vh, 6rem) + var(--safe-b))
    clamp(1.75rem, 3vw, 3.25rem);
  background: radial-gradient(130% 70% at 60% 0%, rgb(255 255 255 / 0.92) 0%, rgb(255 255 255 / 0.55) 55%, rgb(255 255 255 / 0.2) 100%);
  color: var(--ga-ink);
}

.gt__form {
  width: 100%;
  max-width: 29.75rem;
  text-align: center;

  > * {
    opacity: 0;
    transform: translate3d(0, 0.9rem, 0);
    transition: opacity 0.9s var(--e-out-quart), transform 1.1s var(--e-out-expo);
  }

  @for $i from 1 through 8 {
    > :nth-child(#{$i}) { transition-delay: #{0.2s + $i * 0.06s}; }
  }

  .is-ready & > * { opacity: 1; transform: none; }

  .is-launching & > * {
    opacity: 0;
    transform: translate3d(0, -0.8rem, 0);
    transition-duration: 0.45s;
    transition-delay: 0s;
  }
}

.gt__title {
  font-family: var(--font-say);
  font-weight: 700;
  font-size: clamp(2.3rem, 3.1vw, 3.3rem);
  line-height: 1.05;
  letter-spacing: -0.035em;
  color: var(--c-wine);
}

.gt__panel .gt__dot { color: var(--ga-dot); }

.gt__lede {
  margin-top: clamp(0.8rem, 1.6vh, 1.1rem);
  font-family: var(--font-say);
  font-size: clamp(1rem, 1.15vw, 1.2rem);
  line-height: 1.55;
  color: rgb(60 1 14 / 0.72);
}

.gt__notice {
  margin-top: 1.1rem;
  padding: 0.75rem 1.1rem;
  border-radius: 1rem;
  font-family: var(--font-say);
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--ga-ink);
  background: rgb(255 255 255 / 0.75);
  box-shadow: 0 0 0 1px rgb(158 18 53 / 0.16);
}

.gt__field {
  display: block;
  margin-top: clamp(1.75rem, 4vh, 2.5rem);
}

.gt__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.gt__input {
  width: 100%;
  height: clamp(3.6rem, 7.6vh, 4.4rem);
  padding: 0 1.75rem;
  border: 1px solid rgb(60 1 14 / 0.16);
  border-radius: 999px;
  background: #FFFFFF;
  font-family: var(--font-say);
  font-weight: 500;
  // 16px at least, or a phone zooms the page to the field on focus.
  font-size: 1.05rem;
  color: var(--ga-ink);
  outline: none;
  box-shadow: 0 0.8rem 2rem -1.4rem rgb(117 2 39 / 0.3);
  -webkit-user-select: text;
  user-select: text;
  transition: border-color var(--t-hover) var(--e-out-quart), box-shadow var(--t-hover) var(--e-out-quart);

  &::placeholder { color: rgb(60 1 14 / 0.42); }

  &:focus {
    border-color: var(--ga-dot);
    box-shadow: 0 0 0 4px rgb(158 18 53 / 0.12), 0 0.8rem 2rem -1.4rem rgb(117 2 39 / 0.3);
  }

  &[aria-invalid="true"] { border-color: var(--ga-dot); }
  &:disabled { opacity: 0.7; }
}

.gt__submit {
  width: 100%;
  height: clamp(3.6rem, 7.6vh, 4.4rem);
  margin-top: 1.1rem;
  border-radius: 999px;
  background: linear-gradient(135deg, #C21C4E 0%, #9E1235 44%, #750227 100%);
  color: #FFFFFF;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: 1.1rem;
  letter-spacing: 0.005em;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.22),
    0 1.2rem 2.4rem -1.2rem rgb(117 2 39 / 0.55);
  transition:
    opacity var(--t-hover) var(--e-out-quart),
    transform 0.2s var(--e-out-quart),
    box-shadow 0.5s var(--e-out-expo),
    filter var(--t-hover) var(--e-out-quart);

  // Waiting for an address: the brand's colour, faded - as the reference
  // keeps its own, rather than a grey that reads as broken.
  &:disabled { opacity: 0.5; cursor: default; }
  &:active:not(:disabled) { transform: scale(0.985); }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; }
}

@include hover {
  .gt__submit:hover:not(:disabled) {
    filter: brightness(1.08);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.28),
      0 1.5rem 2.8rem -1.2rem rgb(117 2 39 / 0.65);
  }

  .gt__back:hover { opacity: 0.62; }
  .gt__brand:hover { opacity: 0.8; }
}

.gt__error {
  margin-top: 0.85rem;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 0.92rem;
  color: var(--ga-dot);
}

.gt__tagline {
  margin-top: clamp(1.25rem, 2.6vh, 1.6rem);
  font-family: var(--font-say);
  font-weight: 500;
  font-size: clamp(0.98rem, 1.05vw, 1.08rem);
  line-height: 1.5;
  color: rgb(60 1 14 / 0.72);
  text-wrap: balance;
}

.gt__back {
  display: inline-block;
  margin-top: clamp(1.75rem, 4.5vh, 2.75rem);
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 1.02rem;
  color: var(--ga-ink);
  transition: opacity var(--t-hover) var(--e-out-quart);

  &:focus-visible {
    outline: 2px solid var(--ga-dot);
    outline-offset: 4px;
    border-radius: 4px;
  }
}

// The small print, on the floor of the panel: what giving the address means.
.gt__fine {
  position: absolute;
  left: clamp(1.75rem, 3vw, 3.25rem);
  right: max(clamp(1.75rem, 3vw, 3.25rem), var(--safe-r));
  bottom: calc(clamp(1.25rem, 3vh, 2rem) + var(--safe-b));
  font-family: var(--font-say);
  font-size: 0.78rem;
  line-height: 1.45;
  text-align: center;
  color: rgb(60 1 14 / 0.5);
  text-wrap: balance;
  opacity: 0;
  transition: opacity 1s var(--e-out-quart) 0.9s;

  .is-ready & { opacity: 1; }
  .is-launching & { opacity: 0; transition-delay: 0s; transition-duration: 0.3s; }
}

/* -------------------------------------------------------------- handheld */

/**
 * Stacked: the picture as a band across the top with the lockup and the
 * statement, and the ask below it - the reference's own phone layout.
 */
@include handheld {
  .gt {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .gt__hero {
    min-height: min(58dvh, 36rem);
    padding-right: max(1.5rem, var(--safe-r));
    padding-left: max(1.5rem, var(--safe-l));
    padding-bottom: 2rem;
  }

  // The band is too narrow to keep her and the words apart: she fills it,
  // framed on her face and shoulders, and the words stand low over her
  // scrubs - the same wine as the ground - on a shade rising from the foot.
  .gt__photo {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    aspect-ratio: auto;
    object-position: 80% 16%;
    -webkit-mask-image: none;
    mask-image: none;
  }

  .gt__shade {
    display: block;
    background:
      linear-gradient(0deg, rgb(20 3 9 / 0.86) 0%, rgb(20 3 9 / 0.6) 30%, rgb(20 3 9 / 0.12) 58%, rgb(20 3 9 / 0) 100%);
  }

  .gt__say {
    margin-bottom: 0;
    max-width: none;
  }

  .gt__statement { font-size: clamp(2.1rem, 8.4vw, 3.6rem); }

  .gt__aside { font-size: 1rem; }

  .gt__panel {
    align-items: start;
    padding: 2.5rem max(1.5rem, var(--safe-r)) calc(1.75rem + var(--safe-b)) max(1.5rem, var(--safe-l));
    grid-template-rows: 1fr auto;
    gap: 2rem;
  }

  // In the flow on a phone: under the form rather than pinned to a floor
  // the keyboard can lift into it.
  .gt__fine {
    position: static;
    align-self: end;
  }
}

@include phone {
  .gt__aside { display: none; }
}

/** A phone on its side: side by side again, and everything a size down. */
@include short {
  .gt {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: none;
  }

  .gt__hero { min-height: 100dvh; padding-bottom: 1.25rem; }
  .gt__photo { object-position: 84% 14%; }
  .gt__say { margin-top: auto; margin-bottom: 0; padding-top: 1rem; }
  .gt__statement { font-size: clamp(1.6rem, 4.2vw, 2.3rem); }
  .gt__aside { display: none; }

  .gt__panel {
    align-items: center;
    grid-template-rows: none;
    padding-block: 1.25rem;
  }

  .gt__title { font-size: 1.9rem; }
  .gt__lede { margin-top: 0.4rem; font-size: 0.95rem; }
  .gt__field { margin-top: 1rem; }
  .gt__input,
  .gt__submit { height: 3.1rem; }
  .gt__submit { margin-top: 0.6rem; }
  .gt__tagline { margin-top: 0.8rem; font-size: 0.9rem; }
  .gt__back { margin-top: 0.9rem; font-size: 0.92rem; }
  .gt__fine { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .gt__photo,
  .gt__line,
  .gt__aside,
  .gt__form > *,
  .gt__fine {
    transition-duration: 0.01ms !important;
    transition-delay: 0s !important;
    animation: none !important;
  }
}
</style>
