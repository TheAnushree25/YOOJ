<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import BrandMark from "../ui/BrandMark.vue";
import { DeckError, requestAccess, type DeckAccess } from "../../lib/deck-api";

/**
 * The gate: an address for the deck.
 *
 * Laid out as the reference lays its own - the brand's statement on the
 * ground at the left, the form on a pale panel at the right - in this site's
 * voice: the dark wine ground with its rose light walking, the lockup, and the
 * hero's own line set as the hero sets it, a regular line and a bold word.
 */

defineProps<{ notice?: string }>();
const emit = defineEmits<{ admit: [access: DeckAccess] }>();

const email = ref("");
const busy = ref(false);
const error = ref("");
const field = ref<HTMLInputElement | null>(null);

// Enough to know when to wake the button. The server has the final word.
const valid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim()));

onMounted(() => {
  // Straight into the field on a desk; on a phone that would throw the
  // keyboard up over the page before the reader has seen it.
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) field.value?.focus({ preventScroll: true });
});

const MESSAGES: Record<string, string> = {
  email: "Enter a valid email address.",
  unavailable: "The deck isn’t available right now. Please try again later.",
  network: "We couldn’t reach the deck. Check your connection and try again.",
};

const submit = async () => {
  if (busy.value) return;
  if (!valid.value) {
    error.value = MESSAGES.email;
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    emit("admit", await requestAccess(email.value.trim()));
  } catch (e) {
    const code = e instanceof DeckError ? e.code : "server";
    error.value = MESSAGES[code] ?? "Something went wrong. Please try again.";
    busy.value = false;
  }
};
</script>

<template>
  <section class="gt">
    <div class="gt__hero ground-drift">
      <RouterLink class="gt__brand" to="/" data-cursor="scale" aria-label="YOOJ, back to the site">
        <BrandMark class="gt__glyph" />
        <span>YOOJ</span>
      </RouterLink>

      <div class="gt__say">
        <h1 class="gt__statement">
          <span class="gt__line">Better health for more lives</span>
          <span class="gt__line gt__line--strong">everyday<span class="gt__dot">.</span></span>
        </h1>
        <p class="gt__aside">
          Good healthcare shouldn’t depend on where you live. YOOJ is building a connected
          primary-care network for the people who keep India moving.
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
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'gt-error' : undefined"
            @input="error = ''"
          />
        </label>

        <button class="gt__submit" type="submit" :disabled="!valid || busy" data-cursor="scale">
          {{ busy ? "Opening…" : "View the deck" }}
        </button>
        <p v-if="error" id="gt-error" class="gt__error" role="alert">{{ error }}</p>

        <p class="gt__fine">
          Every page carries your email as a watermark. This device keeps you signed in for 30 days.
        </p>
        <RouterLink class="gt__back" to="/" data-cursor="scale">← Back to site</RouterLink>
      </form>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

.gt {
  display: grid;
  grid-template-columns: minmax(0, 63fr) minmax(0, 37fr);
  min-height: 100dvh;
}

/* ------------------------------------------------------------------ hero */

.gt__hero {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding:
    calc(clamp(1.75rem, 3.6vw, 3.5rem) + var(--safe-t))
    clamp(1.75rem, 4vw, 3.5rem)
    clamp(1.75rem, 3.6vw, 3.5rem)
    max(clamp(1.75rem, 4vw, 3.5rem), var(--safe-l));
  color: var(--c-bone);
  background: var(--ground-dark);
  background-size: 190% 190%;
  isolation: isolate;

  // A shade from the reading edge, as the reference lays one over its photo:
  // the light walks the ground, and must never walk under the statement.
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(90deg, rgb(var(--rgb-void) / 0.5) 0%, rgb(var(--rgb-void) / 0.2) 45%, transparent 80%);
    pointer-events: none;
  }
}

.gt__brand {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.55em;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: clamp(0.95rem, 1.1vw, 1.1rem);
  line-height: 1;
  letter-spacing: 0.22em;
}

.gt__glyph {
  width: 1.3em;
  height: 1.3em;
}

.gt__say {
  margin-top: clamp(3rem, 16vh, 11rem);
  max-width: 44rem;
}

.gt__statement {
  font-family: var(--font-say);
  font-weight: 400;
  font-size: clamp(2.5rem, 5.1vw, 5.1rem);
  line-height: 1.04;
  letter-spacing: -0.022em;
  text-wrap: balance;
}

.gt__line { display: block; }
.gt__line--strong { font-weight: 700; }

.gt__hero .gt__dot { color: #FEB3B8; }

.gt__aside {
  margin-top: clamp(1.25rem, 2.6vh, 1.9rem);
  max-width: 29rem;
  font-family: var(--font-say);
  font-size: clamp(1rem, 1.3vw, 1.2rem);
  line-height: 1.55;
  color: rgb(var(--rgb-bone) / 0.86);
  text-wrap: pretty;
}

/* ----------------------------------------------------------------- panel */

.gt__panel {
  display: grid;
  place-items: center;
  padding: clamp(2.5rem, 6vh, 4rem) clamp(1.75rem, 3.5vw, 3rem);
  padding-right: max(clamp(1.75rem, 3.5vw, 3rem), var(--safe-r));
  background: #FFF5F6;
  color: var(--ga-ink);
}

.gt__form {
  width: 100%;
  max-width: 23.75rem;
  text-align: center;
}

.gt__title {
  font-family: var(--font-say);
  font-weight: 700;
  font-size: clamp(2rem, 2.8vw, 2.5rem);
  line-height: 1.05;
  letter-spacing: -0.015em;
}

.gt__panel .gt__dot { color: var(--ga-dot); }

.gt__lede {
  margin-top: 0.75rem;
  font-family: var(--font-say);
  font-size: 1rem;
  line-height: 1.6;
  color: rgb(var(--rgb-ink) / 0.62);
}

.gt__notice {
  margin-top: 1rem;
  padding: 0.7rem 1rem;
  border-radius: 0.9rem;
  font-family: var(--font-say);
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--ga-ink);
  background: rgb(158 18 53 / 0.07);
}

.gt__field {
  display: block;
  margin-top: 1.75rem;
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
  height: 3.5rem;
  padding: 0 1.5rem;
  border: 1px solid rgb(60 1 14 / 0.16);
  border-radius: 999px;
  background: #FFFFFF;
  font-family: var(--font-say);
  font-weight: 500;
  // 16px at least, or a phone zooms the page to the field on focus.
  font-size: 1rem;
  color: var(--ga-ink);
  outline: none;
  -webkit-user-select: text;
  user-select: text;
  transition: border-color var(--t-hover) var(--e-out-quart), box-shadow var(--t-hover) var(--e-out-quart);

  &::placeholder { color: rgb(60 1 14 / 0.42); }

  &:focus {
    border-color: var(--ga-dot);
    box-shadow: 0 0 0 4px rgb(158 18 53 / 0.12);
  }

  &[aria-invalid="true"] { border-color: var(--ga-dot); }
}

.gt__submit {
  width: 100%;
  height: 3.5rem;
  margin-top: 1rem;
  border-radius: 999px;
  background: var(--c-wine);
  color: #FFF5F6;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.01em;
  transition:
    background-color var(--t-hover) var(--e-out-quart),
    opacity var(--t-hover) var(--e-out-quart),
    transform 0.2s var(--e-out-quart);

  &:active:not(:disabled) { transform: scale(0.98); }
  &:disabled { opacity: 0.5; cursor: default; }

  &:focus-visible {
    outline: 2px solid var(--ga-dot);
    outline-offset: 3px;
  }
}

@include hover {
  .gt__submit:hover:not(:disabled) { background: var(--ga-dot); }
  .gt__back:hover { opacity: 0.62; }
}

.gt__error {
  margin-top: 0.8rem;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--ga-dot);
}

.gt__fine {
  margin-top: 1rem;
  font-family: var(--font-say);
  font-size: 0.8125rem;
  line-height: 1.5;
  color: rgb(var(--rgb-ink) / 0.58);
  text-wrap: pretty;
}

.gt__back {
  display: inline-block;
  margin-top: 2rem;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--ga-ink);
  transition: opacity var(--t-hover) var(--e-out-quart);

  &:focus-visible {
    outline: 2px solid var(--ga-dot);
    outline-offset: 4px;
    border-radius: 4px;
  }
}

/* -------------------------------------------------------------- handheld */

/**
 * Stacked: the ground as a band across the top with the lockup and the line,
 * and the form below it - the reference's own phone layout.
 */
@include compact {
  .gt {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .gt__hero {
    min-height: 44dvh;
    padding-right: max(1.5rem, var(--safe-r));
    padding-left: max(1.5rem, var(--safe-l));
  }

  .gt__say { margin-top: auto; }

  .gt__statement { font-size: clamp(2.1rem, 8.4vw, 3.4rem); }

  .gt__aside { font-size: 0.975rem; }

  .gt__panel {
    align-items: start;
    padding: 2.5rem max(1.5rem, var(--safe-r)) calc(2.5rem + var(--safe-b)) max(1.5rem, var(--safe-l));
  }
}

/** A phone on its side: side by side again, and the line a size down. */
@include short {
  .gt {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: none;
  }

  .gt__hero { min-height: 100dvh; }
  .gt__statement { font-size: clamp(1.7rem, 4.4vw, 2.4rem); }
  .gt__aside { display: none; }
  .gt__panel { align-items: center; padding-block: 1.5rem; }
  .gt__title { font-size: 1.75rem; }
  .gt__field { margin-top: 1.1rem; }
  .gt__back { margin-top: 1.1rem; }
}
</style>
