<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { prefersReduced, scrubThrough } from "../../../composables/useMotion";
import { onDark } from "../../../lib/session";
import { sendAffiliate, type AffiliateField } from "../../../lib/affiliate-api";

/**
 * The ask: join the network.
 *
 * Everything above is a held frame; this is the one place the reader is invited
 * to do something rather than watch. So it is ordinary flow, ordinary type, and
 * the only saturated mark on the page is the button — which is the point.
 *
 * It stands where the corridor comes out into the light, on the pale ground the
 * dawn at the end of that section hands over to, and the page's close follows
 * it. The menu's "Affiliate with us" lands here, from either page.
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
 * share the last row, since they are the two halves of one question. It goes
 * to /api/affiliate, which writes it into the admin's Google Sheet; the thank-
 * you appears only once the row is written.
 */
const fields = [
  { name: "name", label: "Name", type: "text", autocomplete: "name", inputmode: "text" },
  { name: "phone", label: "Phone Number", type: "tel", autocomplete: "tel", inputmode: "tel" },
  { name: "city", label: "City", type: "text", autocomplete: "address-level2", inputmode: "text" },
  { name: "email", label: "Email", type: "email", autocomplete: "email", inputmode: "email" },
  { name: "business", label: "Business Name", type: "text", autocomplete: "organization", inputmode: "text" },
] as const;
/** The choices. The server checks against the same four (api/affiliate.ts). */
const whoOptions = ["Clinic OPDs", "Pathology", "Radiology", "Pharmacy"] as const;
const entry = ref<Record<AffiliateField | "website", string>>({
  name: "", phone: "", city: "", email: "", business: "", who: "", website: "",
});

/* ------------------------------------------------------------- sending */

type Status = "idle" | "sending" | "sent";
const status = ref<Status>("idle");
const message = ref("");
/** The fields to point at: the ones the check below, or the server, turned back. */
const bad = ref(new Set<AffiliateField>());
const formEl = ref<HTMLFormElement | null>(null);

/** How each field is named in a sentence asking for it. */
const NAMED: Record<AffiliateField, string> = {
  name: "name",
  phone: "phone number",
  city: "city",
  email: "email",
  business: "business name",
  who: "what you are",
};

/** "a", "a and b", "a, b and c". */
const listed = (words: string[]) =>
  words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

/**
 * The same checks the server makes, so almost every refusal is answered here,
 * at once, and names the field rather than the request.
 */
const check = (): AffiliateField[] => {
  const e = entry.value;
  const text = (v: string, min: number) => v.replace(/\s+/g, " ").trim().length >= min;
  const digits = e.phone.replace(/\D/g, "").length;
  const out: AffiliateField[] = [];
  if (!text(e.name, 2)) out.push("name");
  if (!/^\+?[\d\s()-]+$/.test(e.phone.trim()) || digits < 7 || digits > 15) out.push("phone");
  if (!text(e.city, 2)) out.push("city");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.email.trim())) out.push("email");
  if (!text(e.business, 2)) out.push("business");
  if (!e.who) out.push("who");
  return out;
};

const firstName = computed(() => entry.value.name.trim().split(/\s+/)[0] ?? "");

const focusFirstBad = () =>
  nextTick(() => formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

const submit = async () => {
  if (status.value === "sending") return;
  const wrong = check();
  bad.value = new Set(wrong);
  if (wrong.length) {
    message.value = `Please check your ${listed(wrong.map((f) => NAMED[f]))}.`;
    void focusFirstBad();
    return;
  }

  status.value = "sending";
  message.value = "";
  const result = await sendAffiliate({ ...entry.value } as Parameters<typeof sendAffiliate>[0]);
  if (result.ok) {
    status.value = "sent";
    return;
  }
  status.value = "idle";
  if (result.reason === "fields") {
    bad.value = new Set(result.fields);
    message.value = `Please check your ${listed(result.fields.map((f) => NAMED[f]))}.`;
    void focusFirstBad();
  } else if (result.reason === "busy") {
    message.value = "That’s a few tries in a row. Please wait a minute and send it again.";
  } else {
    message.value = "We couldn’t send this just now. Please try again, or write to hello@yooj.example.";
  }
};

/** Typing in a field takes back the complaint about it. */
const touched = (field: AffiliateField) => {
  if (!bad.value.has(field)) return;
  const left = new Set(bad.value);
  left.delete(field);
  bad.value = left;
  if (!left.size) message.value = "";
};

onMounted(() => {
  if (!root.value) return;
  if (prefersReduced()) { p.value = 1; onDark.value = false; return; }
  trigger = scrubThrough(root.value, (v, active) => {
    p.value = v;
    // The chrome changes sides here: the first thing on the page standing on
    // a light ground since the corridor went dark. The close, below, takes it
    // back to night when it arrives.
    if (active) onDark.value = false;
  }, { start: "top 92%", end: "bottom bottom" });
});

onBeforeUnmount(() => trigger?.kill());
</script>

<template>
  <section id="affiliate" ref="root" class="ac ground-drift">
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

    <!-- The card: the form, and in its place once the row is written, the
         thanks. One card, so the answer lands where the question was. -->
    <div
      class="ac__card"
      :style="{
        opacity: beat(0.3, 0.5),
        transform: `translate3d(0, ${((1 - beat(0.3, 0.54)) * 1).toFixed(2)}rem, 0)`,
      }"
    >
      <Transition name="ac-swap" mode="out-in">
        <form
          v-if="status !== 'sent'"
          ref="formEl"
          class="ac__form"
          :class="{ 'is-sending': status === 'sending' }"
          novalidate
          :aria-busy="status === 'sending'"
          @submit.prevent="submit"
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
              :aria-invalid="bad.has(f.name) ? 'true' : undefined"
              :aria-describedby="message ? 'ac-message' : undefined"
              :disabled="status === 'sending'"
              data-cursor="scale"
              @input="touched(f.name)"
            >
          </label>
          <label class="ac__field ac__field--who" :class="{ 'is-set': entry.who }">
            <span class="ac__vh">You are</span>
            <select
              v-model="entry.who"
              name="who"
              :aria-invalid="bad.has('who') ? 'true' : undefined"
              :aria-describedby="message ? 'ac-message' : undefined"
              :disabled="status === 'sending'"
              data-cursor="scale"
              @change="touched('who')"
            >
              <option value="" disabled>You are</option>
              <option v-for="w in whoOptions" :key="w" :value="w">{{ w }}</option>
            </select>
            <!-- A pill with nothing to say it opens reads as one more field to
                 type in; the chevron is the only thing that says "choose". -->
            <svg class="ac__chev" viewBox="0 0 12 8" aria-hidden="true" focusable="false">
              <path d="M1 1.5 L6 6.5 L11 1.5" />
            </svg>
          </label>

          <!-- The honeypot: out of sight, out of the tab order, and filled in
               only by something that reads the markup instead of the page. -->
          <input
            v-model="entry.website"
            class="ac__trap"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          >

          <button type="submit" class="ac__go" data-cursor="scale" :disabled="status === 'sending'">
            {{ status === "sending" ? "Sending…" : "Get in touch" }}
          </button>

          <p v-if="message" id="ac-message" class="ac__message" role="alert">{{ message }}</p>
        </form>

        <div v-else class="ac__thanks" role="status" tabindex="-1">
          <svg class="ac__tick" viewBox="0 0 52 52" aria-hidden="true" focusable="false">
            <circle cx="26" cy="26" r="24" />
            <path d="M15.5 27.2 22.6 34 37 19.5" />
          </svg>
          <p class="ac__thanks-h">Thank you{{ firstName ? `, ${firstName}` : "" }}.</p>
          <p class="ac__thanks-p">
            We’ve received your details, and the YOOJ team will be in touch
            with you soon.
          </p>
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped lang="scss">
/**
 * The ground: the light the corridor comes out into.
 *
 * The white the corridor's dawn resolves to, carried on as the page's pale
 * field - the same ground the section here before it stood on, so the hand-
 * over from the dark is unchanged. On it the card has to be lifted rather
 * than lit: a long, soft wine shadow and a hairline edge, where on the dark
 * ground its own white did the work.
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
  color: var(--ga-ink);
  overflow: hidden;
  // A light in it, not just a ramp: a plain vertical gradient has almost
  // nothing to move when the ground drifts. The radial gives the drift
  // something to carry.
  background: var(--ground-light);
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
  border: 1px solid rgb(60 1 14 / 0.16);
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
  color: rgb(60 1 14 / 0.74);
  margin: 0;
  font-size: var(--ta-body);
  line-height: var(--la-body);
  font-weight: 300;
  will-change: transform, opacity;
}

/* ----------------------------------------------------------------- the ask */

// One card holding the fields: two columns of pills, the choice across the
// full width beneath them, and the one saturated control on the page last.
// What the scroll moves in: the form, or the thanks that takes its place.
.ac__card {
  width: min(38rem, 92vw);
  margin-top: clamp(0.6rem, 2vh, 1.4rem);
  will-change: transform, opacity;
}

// The card itself, for both: white on the pale ground, lifted by a hairline
// and a long soft wine shadow.
%ac-sheet {
  background: #FFFFFF;
  border-radius: 1.8rem;
  box-shadow:
    0 0 0 1px rgb(60 1 14 / 0.05),
    0 1px 2px rgb(60 1 14 / 0.06),
    0 1.6rem 3.6rem -1.2rem rgb(117 2 39 / 0.3),
    0 0.4rem 1rem -0.4rem rgb(117 2 39 / 0.12);
}

.ac__form {
  @extend %ac-sheet;
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  padding: 0.6rem;
  transition: opacity 0.3s var(--e-out-quart);

  &.is-sending { opacity: 0.85; }

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

  &:hover:not(:disabled) { background: #520E22; transform: translateY(-1px); }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; }
  &:disabled { cursor: default; }

  .is-sending &::before { animation: ac-beat 0.9s var(--e-in-out-quad) infinite alternate; }
}

@keyframes ac-beat { to { opacity: 0.25; transform: scale(0.6); } }

// A field sent back: the ring the focus draws, in the dot's wine, until the
// reader types in it.
.ac__field [aria-invalid="true"] {
  box-shadow: inset 0 0 0 1.5px rgb(158 18 53 / 0.7);
  background: rgb(254 179 184 / 0.28);
}

.ac__field input:disabled,
.ac__field select:disabled { opacity: 0.7; }

.ac__message {
  grid-column: 1 / -1;
  padding: 0.3rem 1rem 0.5rem;
  font-size: 0.9rem;
  line-height: 1.45;
  font-weight: 400;
  color: var(--ga-dot);
  text-wrap: pretty;
}

// The honeypot. Not `display: none`: some bots skip fields that are.
.ac__trap {
  position: absolute;
  left: -200vw;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

/* ----------------------------------------------------------------- thanks */

.ac__thanks {
  @extend %ac-sheet;
  display: grid;
  justify-items: center;
  gap: 0.9rem;
  padding: clamp(2rem, 5vw, 2.8rem) clamp(1.5rem, 5vw, 3rem);
  outline: none;
}

// A ring drawn round, then the tick struck through it.
.ac__tick {
  width: 3.4rem;
  height: 3.4rem;
  overflow: visible;

  circle,
  path {
    fill: none;
    stroke: var(--ga-dot);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  circle {
    stroke: rgb(158 18 53 / 0.25);
    stroke-dasharray: 151;
    stroke-dashoffset: 151;
    animation: ac-draw 0.9s var(--e-out-quart) 0.1s forwards;
  }

  path {
    stroke-dasharray: 32;
    stroke-dashoffset: 32;
    animation: ac-draw 0.55s var(--e-out-quart) 0.65s forwards;
  }
}

@keyframes ac-draw { to { stroke-dashoffset: 0; } }

.ac__thanks-h {
  margin: 0;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: clamp(1.5rem, 2.6vw, 2rem);
  line-height: 1.15;
  letter-spacing: -0.015em;
  color: var(--c-wine);
}

.ac__thanks-p {
  max-width: 26rem;
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.55;
  font-weight: 300;
  color: rgb(60 1 14 / 0.74);
  text-wrap: balance;
}

// The form folds away and the thanks rises into its place.
.ac-swap-leave-active { transition: opacity 0.3s var(--e-out-quart), transform 0.35s var(--e-out-quart); }
.ac-swap-leave-to { opacity: 0; transform: scale(0.97); }
.ac-swap-enter-active { transition: opacity 0.5s var(--e-out-quart), transform 0.7s var(--e-out-expo); }
.ac-swap-enter-from { opacity: 0; transform: translate3d(0, 0.8rem, 0) scale(0.98); }

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
  .ac__card {
    opacity: 1 !important;
    transform: none !important;
  }

  .ac__go { transition: none; }

  .ac__tick circle,
  .ac__tick path { animation: none; stroke-dashoffset: 0; }
}
</style>
