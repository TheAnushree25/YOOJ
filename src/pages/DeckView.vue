<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import DeckGate from "../components/deck/DeckGate.vue";
import DeckViewer from "../components/deck/DeckViewer.vue";
import {
  DeckError, dropPass, fetchMeta, keepPass, storedPass,
  type DeckAccess, type DeckMeta,
} from "../lib/deck-api";
import { guardDeck, type Guard } from "../lib/deck-guard";
import { ambientLive, soundOn, startAmbient, stopAmbient } from "../lib/sound";
// The deck's interface weight. Loaded with this page only; the rest of the
// site never asks for it.
import "@fontsource/montserrat/500.css";

/**
 * /deck: the investor deck, behind an email.
 *
 * Two screens. The gate asks for an address and trades it for a signed pass;
 * the viewer shows the deck one slide at a time, each slide fetched from the
 * server with that address already drawn into it. A reader who has a pass on
 * this device goes straight to the viewer.
 *
 * The whole route runs under lib/deck-guard: no context menu, no inspector
 * shortcuts, no selecting, copying or printing.
 */

type Phase = "checking" | "gate" | "deck";

const phase = ref<Phase>("checking");
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

onMounted(async () => {
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

  const saved = storedPass();
  if (!saved) {
    phase.value = "gate";
    return;
  }
  try {
    meta.value = await fetchMeta(saved);
    pass.value = saved;
    phase.value = "deck";
  } catch (error) {
    if (error instanceof DeckError && error.code === "pass") dropPass();
    else notice.value = "The deck couldn’t be reached just now. Please try again.";
    phase.value = "gate";
  }
});

onBeforeUnmount(() => {
  guard?.stop();
  undo.splice(0).forEach((fn) => fn());
  if (bedWasPlaying && soundOn.value) void startAmbient();
});

const admit = (access: DeckAccess) => {
  keepPass(access.token);
  pass.value = access.token;
  meta.value = access;
  notice.value = "";
  phase.value = "deck";
};

const leave = (message = "") => {
  dropPass();
  pass.value = null;
  meta.value = null;
  notice.value = message;
  phase.value = "gate";
};

const expired = () => leave("Your access has lapsed. Enter your email to open the deck again.");
</script>

<template>
  <div class="dk">
    <DeckGate v-if="phase === 'gate'" :notice="notice" @admit="admit" />
    <DeckViewer
      v-else-if="phase === 'deck' && pass && meta"
      :pass="pass"
      :meta="meta"
      @expired="expired"
      @leave="leave()"
    />
    <div v-else class="dk__hold" aria-busy="true" />
  </div>
</template>

<style scoped lang="scss">
/**
 * Nothing on this route can be selected, dragged or long-pressed into a save
 * menu. The email field opts back in (DeckGate).
 */
.dk {
  min-height: 100dvh;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

.dk__hold { min-height: 100dvh; }
</style>

<style lang="scss">
// The page behind the deck is pale, so the document is too - otherwise the
// site's dark body shows through at the edges of an overscroll on a phone.
html.is-deck,
html.is-deck body {
  background: #FFF5F6;
}
</style>
