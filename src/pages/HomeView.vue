<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Backdrop } from "../webgl/Backdrop";
import { usePointer } from "../composables/usePointer";
import { useSmoothScroll } from "../composables/useSmoothScroll";
import { ScrollTrigger, prefersReduced } from "../composables/useMotion";
import { cinema, entered, onPale, pulseCorner } from "../lib/session";
import { heroImageReady } from "../lib/hero-image";
import { holdAmbient, startAmbient } from "../lib/sound";

import OpeningFilm from "../components/chrome/OpeningFilm.vue";
import ScrollHint from "../components/chrome/ScrollHint.vue";
import SiteHeader from "../components/chrome/SiteHeader.vue";
import SiteMenu from "../components/chrome/SiteMenu.vue";
import SplashGate from "../components/chrome/SplashGate.vue";

import CloseSection from "../components/sections/CloseSection.vue";
import FrontierSection from "../components/sections/FrontierSection.vue";
import HeroSection from "../components/sections/HeroSection.vue";
import PerspectivesSection from "../components/sections/PerspectivesSection.vue";
import ReconnectSection from "../components/sections/ReconnectSection.vue";
import SolutionSection from "../components/sections/SolutionSection.vue";
import TenetsSection from "../components/sections/TenetsSection.vue";

const canvas = ref<HTMLCanvasElement | null>(null);
const hero = ref<InstanceType<typeof HeroSection> | null>(null);
const film = ref<InstanceType<typeof OpeningFilm> | null>(null);

/**
 * Whether the opening film is due.
 *
 * Decided once, as the page is set up. The film plays exactly once, on the
 * press that lifts the gate, and only for a reader who has not asked for less
 * motion. A reader arriving from the second page has already answered the
 * gate somewhere else and gets the hero straight away - as they did before
 * there was a film.
 */
const filmDue = ref(!entered.value && !prefersReduced());

/**
 * The film's readiness, for the gate to wait on beside the hero's subject.
 * Resolved by the film once it can play through - or has failed, which is
 * also an answer - and ceilinged by the gate, like everything it waits for.
 */
let filmLoaded: () => void = () => {};
const filmReady = filmDue.value
  ? new Promise<void>((resolve) => { filmLoaded = resolve; })
  : Promise.resolve();
const onFilmReady = () => filmLoaded();
const gateWait = Promise.all([heroImageReady, filmReady]);

const { progress, scrolled, mount, scrollTo, lock, unlock, toTop } = useSmoothScroll();
const { x, y } = usePointer();

let backdrop: Backdrop | null = null;

const chapters = [
  { id: "top", label: "Vision" },
  { id: "reconnect", label: "Reconnecting healthcare" },
  { id: "frontier", label: "Beyond fragmented care" },
  { id: "tenets", label: "The 4 R’s" },
  { id: "perspectives", label: "Perspectives" },
  { id: "solution", label: "JeevanBhar" },
  { id: "contact", label: "Contact" },
];

const chapterIndex = ref(0);

/** The chapters that stand on the light ground throughout. The rest are wine. */
const PALE = new Set(["frontier", "solution"]);

/**
 * The second section is three grounds in one — a pale panel, the field once
 * the panel has faded, and a dome climbing over both — so its chapter id is
 * not an answer. Its state is read off the elements themselves: the panel's
 * opacity and the dome's rounded crown, both of which the section writes
 * inline every frame. The dome cannot be asked by hit test (its wrapper takes
 * no pointer events), but its crown is a half-ellipse the full width of the
 * dome, and an ellipse is easy to ask directly.
 */
const paleInReconnect = (x: number, y: number) => {
  const panel = document.querySelector<HTMLElement>(".rc__ground");
  if (!panel || parseFloat(panel.style.opacity || "1") < 0.5) return false;
  const dome = document.querySelector<HTMLElement>(".rc__dome");
  if (!dome) return true;
  const r = dome.getBoundingClientRect();
  if (x < r.left || x > r.right || y > r.bottom || y < r.top) return true;
  const crown = parseFloat(dome.style.borderRadius.split("/")[1] ?? "0") / 100;
  const ry = crown * r.height;
  // Below the crown band the dome is solid.
  if (y >= r.top + ry) return false;
  const dx = (x - (r.left + r.right) / 2) / (r.width / 2);
  const dy = (y - (r.top + ry)) / ry;
  return dx * dx + dy * dy > 1;
};

/** Resolved once rather than per scroll frame; the ids are fixed. */
let chapterEls: Array<HTMLElement | null> = [];
const findChapters = () => {
  chapterEls = chapters.map((c) => document.getElementById(c.id));
};

/**
 * Whichever section fills most of the viewport is the one being read.
 *
 * The previous test asked which section had started above a line 42% down the
 * viewport. That line sits below the top of a short section and below its
 * bottom as well, so any section shorter than it was skipped entirely — the
 * product section is 495px against a 768px viewport, and the header jumped
 * straight from it to the footer. Measuring overlap instead has no opinion
 * about how tall a section is.
 */
const updateChapter = () => {
  // Re-resolve if anything cached has left the document. The list is held
  // between frames so the ids are not queried on every scroll event, but a
  // detached node answers `getBoundingClientRect` with zeros — so after any
  // swap of a section (a hot reload during development is the common one)
  // every measurement came back zero, nothing ever beat the initial best of
  // index 0, and the header read the first chapter for the whole page.
  if (chapterEls.length !== chapters.length || chapterEls.some((el) => el && !el.isConnected)) {
    findChapters();
  }

  const view = window.innerHeight;
  let best = 0;
  let most = -1;
  // The section under the pulse.
  const { x: px, y: corner } = pulseCorner();
  let under = -1;

  chapterEls.forEach((el, i) => {
    if (!el) return;
    const { top, bottom } = el.getBoundingClientRect();
    // Clipped against the viewport, so a section half off screen counts only
    // the half that is on it. Never negative.
    const seen = Math.max(0, Math.min(view, bottom) - Math.max(0, top));
    if (seen > most) { most = seen; best = i; }
    if (top <= corner && bottom >= corner) under = i;
  });

  chapterIndex.value = best;
  const id = under >= 0 ? chapters[under]?.id : undefined;
  onPale.value = id === "reconnect" ? paleInReconnect(px, corner) : PALE.has(id ?? "");
};

const chapter = computed(() => chapters[chapterIndex.value]?.label ?? "Vision");

/**
 * The menu, and the page held still behind it.
 *
 * Lenis keeps gliding through a wheel gesture after the wheel stops, so a
 * menu opened mid-scroll would otherwise have the whole page still moving
 * under it. Stopping the engine is the same mechanism the gate uses.
 */
const menuOpen = ref(false);
const openMenu = () => { menuOpen.value = true; lock(); };
const closeMenu = () => { menuOpen.value = false; unlock(); };

const jump = (id: string) => {
  const el = document.getElementById(id);
  if (el) scrollTo(el);
};

// The gate hands off to the film, and the film to the hero.
//
// The page is already laid out behind the gate, so each entrance plays into a
// settled page rather than racing the first paint. With no film due - a reader
// who asked for less motion, or one whose browser would not play it - the gate
// hands straight to the hero, as it always did.
//
// Deliberately not scheduled on requestAnimationFrame. rAF does not run in a
// background tab, and the hero's parts start at opacity 0 — so a reader who
// pressed Enter and switched away came back to a blank page that never
// recovered. A timer still fires there, and the tween picks up on its own once
// the tab is visible again.
const onPress = () => {
  // Inside the reader's press, which is what lets a film sound at all.
  film.value?.prime();
};

const onEnter = () => {
  entered.value = true;
  setTimeout(async () => {
    // Whatever the page did while it was covered, the reader arrives at the
    // hero. Immediate rather than eased: this is the first frame after the
    // gate lifts, and a long glide down from wherever the document happened to
    // be is the bug, not the fix.
    toTop();
    // A hard refresh, and only now. Triggers created during mount measured a
    // page whose fonts had not loaded and whose sections had not reached their
    // real heights — the pinned section computed a start of zero and pinned
    // itself over the hero on arrival. Re-measuring once the page has settled
    // is what puts every start and end where the reader will actually meet it.
    ScrollTrigger.refresh(true);

    if (filmDue.value && film.value) {
      // The page stays held under the film, which says when it is over.
      if (await film.value.start()) return;
      // It could not be played. On with the page as if there were no film,
      // bed and all.
      filmDue.value = false;
      holdAmbient(false);
      void startAmbient();
    }

    unlock();
    hero.value?.play();
  }, 0);
};

/** The film has finished and the cue is on its way: the bed rises under it. */
const onFilmOver = () => {
  holdAmbient(false);
  void startAmbient();
};

/** The curtain is lifting: the hero rises as it is uncovered. */
const onFilmLeave = () => {
  setTimeout(() => hero.value?.play(), 120);
};

/** The film stopped working partway. The page carries on as if there were none. */
const onFilmSkip = () => {
  holdAmbient(false);
  void startAmbient();
  unlock();
  hero.value?.play();
};

/** The layer is gone; the page is the reader's. */
const onFilmDone = () => {
  filmDue.value = false;
  unlock();
};

// After the render, not before it: the corner test reads inline styles the
// sections write from the same scroll event, and a pre-flush watcher would
// measure the previous frame's dome against this frame's position.
watch(scrolled, updateChapter, { flush: "post" });
watch([x, y], () => backdrop?.setPointer(x.value, y.value));
watch(progress, (p) => backdrop?.setProgress(p));

onMounted(() => {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);

  if (canvas.value) {
    backdrop = new Backdrop(canvas.value);
    backdrop.start();
    window.addEventListener("resize", backdrop.resize);
  }
  findChapters();
  mount();
  // The bed waits for the film. Set before any key can ask for it.
  if (filmDue.value) holdAmbient(true);
  // Held at the top until the gate is answered.
  //
  // Asserted twice. Setting `history.scrollRestoration` to manual does not
  // reliably stop Chrome putting the document back where it was, and the
  // restore lands *after* this handler — so the page sat at the old offset
  // behind the gate and snapped to the hero only once the gate had already
  // faded, which is a visible flash of the wrong section. The second assert
  // runs after load, by which time the restore has happened.
  if (!entered.value) {
    toTop();
    lock();
    const settle = () => requestAnimationFrame(() => { if (!entered.value) toTop(); });
    if (document.readyState === "complete") settle();
    else window.addEventListener("load", settle, { once: true });
  }
  // Arrived from the second page, with the gate already answered: no gate
  // and no film will call the entrance, and the hero's parts start at
  // opacity 0. A timer rather than a frame, for the reason given above.
  if (entered.value) setTimeout(() => hero.value?.play(), 0);
  // Read once before any scroll arrives. A reload lands at the browser's
  // restored position, and until the first scroll event the header still read
  // the first chapter from the middle of the second section.
  updateChapter();
});

onBeforeUnmount(() => {
  if (backdrop) window.removeEventListener("resize", backdrop.resize);
  backdrop?.dispose();
  // The next page measures its own ground.
  onPale.value = false;
  // And starts its own bed, if the film never got to release this one.
  holdAmbient(false);
});
</script>

<template>
  <!-- The field sits behind everything and never moves; the content scrolls
       over it. That separation keeps the shader off the scroll's critical path. -->
  <div class="backdrop"><canvas ref="canvas" /></div>

  <!-- Held until the hero's subject has decoded, so the page behind the
       gate is whole when it lifts. -->
  <SplashGate
    v-if="!entered"
    :wait-for="gateWait"
    :hold-sound="filmDue"
    @press="onPress"
    @enter="onEnter"
  />

  <!-- The opening: between the gate and the hero, once, with the page held
       still beneath it. A fixed layer rather than a section, so the hero
       stays laid out at the top of a document that has not moved. -->
  <OpeningFilm
    v-if="filmDue"
    ref="film"
    src="/intro/opening.mp4"
    poster="/intro/opening.jpg"
    @ready="onFilmReady"
    @over="onFilmOver"
    @leave="onFilmLeave"
    @skip="onFilmSkip"
    @done="onFilmDone"
  />


  <SiteHeader
    :progress="progress"
    :chapter="chapter"
    :index="chapterIndex"
    :total="chapters.length"
    :hidden="cinema"
    @jump="jump"
    @menu="openMenu"
  />

  <SiteMenu :open="menuOpen" contact-href="#contact" @close="closeMenu" />

  <main class="content">
    <HeroSection ref="hero" :progress="progress" />
    <ReconnectSection />
    <FrontierSection />
    <TenetsSection />
    <PerspectivesSection />
    <SolutionSection />
  </main>

  <CloseSection @jump="jump" />

  <ScrollHint :hidden="progress > 0.02 || !entered || filmDue" />
</template>

<style scoped lang="scss">
// Named for what it is, and deliberately not `.field` — a child component's
// root element inherits its parent's scope id as well as its own, so a class
// this generic silently reached the section that shares the name and fixed it
// to the viewport on top of the hero.
// Named for what it is, and deliberately not `.field` — a child component's
// root element inherits its parent's scope id as well as its own, so a class
// this generic silently reached the section that shares the name and fixed it
// to the viewport on top of the hero.
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;

  canvas { width: 100%; height: 100%; }

  // The veil over the field, in one place and applied once.
  //
  // Each dark section used to carry its own. Two problems with that, and both
  // showed as a hard line between sections: identical gradients are still
  // phased against whichever box paints them, and — worse — a sticky wash with
  // a cancelling negative margin overflows its own section, so at a boundary
  // two veils stacked and the ground abruptly doubled in density. Painted here
  // it cannot overlap itself, and every section that shows the field gets
  // exactly the same ground.
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--veil);
    pointer-events: none;
  }
}

.content {
  position: relative;
  z-index: 10;
  width: 100%;
}

</style>
