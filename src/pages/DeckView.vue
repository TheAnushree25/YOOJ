<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import DeckGate from "../components/deck/DeckGate.vue";
import DeckViewer from "../components/deck/DeckViewer.vue";
import { rememberEmail, type DeckAccess, type DeckMeta } from "../lib/deck-api";
import { guardDeck, type Guard } from "../lib/deck-guard";
import { ambientLive, soundOn, startAmbient, stopAmbient } from "../lib/sound";
// The deck's interface weight. Loaded with this page only; the rest of the
// site never asks for it.
import "@fontsource/montserrat/500.css";

/**
 * /deck: the investor deck, behind an email.
 *
 * Two screens on one ground. The gate asks for an address and trades it for a
 * signed pass; the viewer shows the deck one slide at a time, each slide
 * fetched from the server with that address already drawn into it.
 *
 * Every visit starts at the gate. The pass is held here, in memory, for this
 * visit only - so each sitting is a fresh entry in the admin's sheet, and a
 * device lent to someone else does not open the deck in the last reader's
 * name. The address is remembered to put back in the field, which keeps a
 * returning reader one press from the deck.
 *
 * The whole route runs under lib/deck-guard: no context menu, no inspector
 * shortcuts, no selecting, copying or printing.
 */

type Phase = "gate" | "deck";

const phase = ref<Phase>("gate");
const pass = ref<string | null>(null);
const meta = shallowRef<DeckMeta | null>(null);
const notice = ref("");

let guard: Guard | null = null;
const undo: (() => void)[] = [];

/**
 * The site's sound answers to M anywhere on the page. The deck has no sound,
 * and a reader pressing M here would silently flip the preference the front
 * page remembers for their next visit.
 */
const swallowMute = (e: KeyboardEvent) => {
  if (e.code === "KeyM" && !e.ctrlKey && !e.metaKey && !e.altKey) e.stopPropagation();
};

/** Whether the bed was playing when the reader arrived, so leaving can put it back. */
let bedWasPlaying = false;

onMounted(() => {
  const title = document.title;
  document.title = "The deck — YOOJ";
  const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  const robotsWas = robots?.content ?? null;
  if (robots) robots.content = "noindex, nofollow";
  document.documentElement.classList.add("is-deck");
  window.addEventListener("keydown", swallowMute, true);
  undo.push(() => {
    document.title = title;
    if (robots && robotsWas !== null) robots.content = robotsWas;
    document.documentElement.classList.remove("is-deck");
    window.removeEventListener("keydown", swallowMute, true);
  });

  if (ambientLive.value) {
    bedWasPlaying = true;
    stopAmbient();
  }

  guard = guardDeck();
});

onBeforeUnmount(() => {
  guard?.stop();
  undo.splice(0).forEach((fn) => fn());
  if (bedWasPlaying && soundOn.value) void startAmbient();
});

const admit = (access: DeckAccess) => {
  rememberEmail(access.email);
  pass.value = access.token;
  meta.value = access;
  notice.value = "";
  phase.value = "deck";
};

const leave = (message = "") => {
  pass.value = null;
  meta.value = null;
  notice.value = message;
  phase.value = "gate";
};

const expired = () => leave("Your session with the deck has ended. Enter your email to open it again.");
</script>

<template>
  <div class="dk">
    <!-- The site's pale ground, lit and drifting, under both screens: it does
         not change as the gate hands over to the deck. -->
    <div class="dk__ground ground-drift" aria-hidden="true" />
    <div class="dk__bloom" aria-hidden="true" />

    <!-- The gate stays on top as it leaves, playing its own launch, while the
         deck builds up underneath it: one movement rather than two screens. -->
    <Transition name="dk-swap" :duration="{ enter: 0, leave: 900 }">
      <DeckGate v-if="phase === 'gate'" key="gate" :notice="notice" @admit="admit" />
      <DeckViewer
        v-else-if="pass && meta"
        key="deck"
        :pass="pass"
        :meta="meta"
        @expired="expired"
        @leave="leave()"
      />
    </Transition>
  </div>
</template>

<style scoped lang="scss">
/**
 * Nothing on this route can be selected, dragged or long-pressed into a save
 * menu. The email field opts back in (DeckGate).
 */
.dk {
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  overflow-x: clip;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

// The drifting pale ground every light section of the site stands on.
.dk__ground {
  position: fixed;
  inset: 0;
  z-index: -2;
  background: var(--ground-light);
  // Beside the shorthand, which resets it, and not in the drift class.
  background-size: 190% 190%;
  pointer-events: none;
}

// And a white light high on the left, as the hero has: the ground reads as
// lit paper rather than as a flat pink.
.dk__bloom {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(52vw 46vh at 18% 12%, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0) 70%),
    radial-gradient(40vw 40vh at 88% 92%, rgb(254 179 184 / 0.28), rgb(254 179 184 / 0) 72%);
  pointer-events: none;
}

// The leaving gate is lifted out of the flow and laid over the deck arriving
// beneath it, and fades as its own launch plays.
.dk-swap-leave-active {
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  transition: opacity 0.5s var(--e-out-quart) 0.35s;
}

.dk-swap-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .dk-swap-leave-active { transition-duration: 0.01ms; transition-delay: 0s; }
}
</style>

<style lang="scss">
// The page behind the deck is pale, so the document is too - otherwise the
// site's dark body shows through at the edges of an overscroll on a phone.
html.is-deck,
html.is-deck body {
  background: #FFF5F6;
}
</style>
