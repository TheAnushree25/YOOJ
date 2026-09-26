<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { prefersReduced } from "../../composables/useMotion";
import { useViewport } from "../../composables/useViewport";
import { DeckError, fetchSlide, type DeckMeta } from "../../lib/deck-api";
import { stampSlide } from "../../lib/deck-stamp";

/**
 * The deck itself, one slide at a time - and the slide is the page.
 *
 * It stands in a 3D stage as large as the screen allows at the deck's own
 * ratio: the frame is a size container, so the slide is measured against the
 * room it actually has rather than against a guess at the chrome. It builds up
 * out of the page as the gate hands it over, leans a degree or two after the
 * pointer, and turns in depth from one slide to the next.
 *
 * Slides are fetched as blobs and cached in a small ring; the two either side
 * of the reader are warmed ahead so a press is a swap, not a wait. Each blob
 * is stamped with the reader's address - on the server, or here where the
 * host cannot draw on images (yooj.care's Worker). Object URLs are revoked
 * when they age out of the ring and when the deck unmounts, so no decoded
 * slide is left behind.
 */

const props = defineProps<{ pass: string; meta: DeckMeta }>();
const emit = defineEmits<{ expired: []; leave: [] }>();

const vp = useViewport();
const reduced = prefersReduced();

/** The page asked for, and the one actually on screen - they differ while a slide is arriving. */
const page = ref(1);
const shown = shallowRef<{ page: number; url: string } | null>(null);
/** Which way the last turn went: into the deck, back through it, or the first slide arriving. */
const dir = ref<1 | -1 | 0>(0);
const loading = ref(true);
const error = ref("");

const card = ref<HTMLElement | null>(null);
/** Carries the lean as custom properties: the rig tilts by them, the floor shadow slides by them. */
const frame = ref<HTMLElement | null>(null);

/* ------------------------------------------------------------------ slides */

/**
 * page -> the object URL, and the width the server actually sent. A handful
 * deep: the slide, its neighbours, and headroom.
 */
const cache = new Map<number, { url: string; width: number }>();
const inflight = new Map<number, Promise<string>>();
const RING = 7;

/** The width to ask the server for, from the slide's rendered size and the display density. */
const askWidth = () => {
  const box = card.value?.clientWidth || window.innerWidth;
  return Math.min(2400, Math.round(box * Math.min(window.devicePixelRatio || 1, 2)));
};

const trim = () => {
  if (cache.size <= RING) return;
  const keep = new Set<number>();
  for (let d = -2; d <= 2; d++) keep.add(page.value + d);
  if (shown.value) keep.add(shown.value.page);
  for (const [key, value] of [...cache.entries()]) {
    if (cache.size <= RING) break;
    if (keep.has(key)) continue;
    URL.revokeObjectURL(value.url);
    cache.delete(key);
  }
};

/**
 * A slide, from the ring or from the server. `sharper` asks again when the
 * copy in the ring is narrower than the slide is now drawn - after a move to
 * full screen, or a window made larger.
 */
const load = (n: number, ahead = false, sharper = false): Promise<string> => {
  const have = cache.get(n);
  if (have && !(sharper && have.width < askWidth())) return Promise.resolve(have.url);
  const already = inflight.get(n);
  if (already) return already;

  const job = fetchSlide(props.pass, n, askWidth(), { ahead })
    // A slide the host could not stamp (yooj.care) is stamped here, before anything shows it.
    .then(async ({ blob, width, stamped }) => ({ blob: stamped ? blob : await stampSlide(blob, props.meta.email), width }))
    .then(({ blob, width }) => {
      const objectUrl = URL.createObjectURL(blob);
      const old = cache.get(n);
      cache.set(n, { url: objectUrl, width });
      // The narrower copy goes once nothing shows it any more.
      if (old && old.url !== shown.value?.url) URL.revokeObjectURL(old.url);
      trim();
      return objectUrl;
    })
    .finally(() => inflight.delete(n));
  inflight.set(n, job);
  return job;
};

/**
 * The slide on screen, again at the width it is now drawn. The same page, so
 * no turn: the sharper copy simply takes the place of the softer one.
 */
const sharpen = async () => {
  const on = shown.value;
  if (!on) return;
  const have = cache.get(on.page);
  if (!have || have.width >= askWidth()) return;
  try {
    const url = await load(on.page, false, true);
    if (shown.value?.page !== on.page || url === on.url) return;
    const softer = on.url;
    shown.value = { page: on.page, url };
    setTimeout(() => URL.revokeObjectURL(softer), 1000);
  } catch {
    // The softer copy stays; nothing the reader needs to hear about.
  }
};

let sharpenTimer: ReturnType<typeof setTimeout> | null = null;
const sharpenSoon = () => {
  if (sharpenTimer) clearTimeout(sharpenTimer);
  sharpenTimer = setTimeout(() => { sharpenTimer = null; void sharpen(); }, 400);
};

const show = async (n: number) => {
  const target = Math.min(Math.max(1, n), props.meta.pages);
  page.value = target;
  loading.value = !cache.has(target);
  error.value = "";
  try {
    const objectUrl = await load(target);
    // The reader may have moved on while this one was arriving.
    if (page.value !== target) return;
    const from = shown.value?.page;
    dir.value = from === undefined ? 0 : target > from ? 1 : target < from ? -1 : dir.value;
    shown.value = { page: target, url: objectUrl };
    loading.value = false;
  } catch (e) {
    if (page.value !== target) return;
    loading.value = false;
    if (e instanceof DeckError && (e.code === "pass" || e.status === 401)) {
      emit("expired");
      return;
    }
    error.value = "This slide couldn’t be loaded. Try again.";
    return;
  }
  // Warm the neighbours, next first: that is the way a reader most often goes.
  if (target < props.meta.pages) void load(target + 1, true).catch(() => {});
  if (target > 1) void load(target - 1, true).catch(() => {});
};

const next = () => { if (page.value < props.meta.pages) void show(page.value + 1); };
const prev = () => { if (page.value > 1) void show(page.value - 1); };
const retry = () => void show(page.value);

const atStart = computed(() => page.value <= 1);
const atEnd = computed(() => page.value >= props.meta.pages);
const pad = (n: number) => String(n).padStart(2, "0");
const turnName = computed(() => (reduced ? "turn-fade" : dir.value === 0 ? "turn-first" : dir.value > 0 ? "turn-next" : "turn-prev"));

/* -------------------------------------------------------------- the build */

/** The slide builds up out of the page a beat after mounting - as the gate's fade is under way. */
const risen = ref(reduced);
let riseTimer: ReturnType<typeof setTimeout> | null = null;

/* ------------------------------------------------------------------- lean */

/**
 * A degree or two after the pointer, on a spring eased by the time between
 * frames. Only for a mouse: a finger has no hover to follow, and a deck that
 * tilted under a reading thumb would be a deck that is hard to read.
 */
let aimX = 0;
let aimY = 0;
let lx = 0;
let ly = 0;
let raf = 0;
let last = 0;

const paint = () => {
  frame.value?.style.setProperty("--tx", lx.toFixed(4));
  frame.value?.style.setProperty("--ty", ly.toFixed(4));
};

const step = (now: number) => {
  const dt = Math.min(64, now - (last || now));
  last = now;
  const k = 1 - Math.exp(-dt / 180);
  lx += (aimX - lx) * k;
  ly += (aimY - ly) * k;
  paint();
  if (Math.abs(aimX - lx) + Math.abs(aimY - ly) > 0.0008) raf = requestAnimationFrame(step);
  else { raf = 0; last = 0; }
};

const wake = () => { if (!raf) raf = requestAnimationFrame(step); };

const onPointer = (e: PointerEvent) => {
  poke();
  if (reduced || e.pointerType !== "mouse" || turned.value) return;
  aimX = (e.clientX / window.innerWidth) * 2 - 1;
  aimY = (e.clientY / window.innerHeight) * 2 - 1;
  wake();
};

const onLeaveWindow = () => { aimX = 0; aimY = 0; wake(); };

/* ------------------------------------------------------------ full screen */

const canFull = ref(false);
const full = ref(false);

const toggleFull = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // Refused (an iframe, a browser setting): the button simply does nothing.
  }
};

const onFullChange = () => {
  full.value = document.fullscreenElement === document.documentElement;
  poke();
  sharpenSoon();
};

/* ------------------------------------------------------------- landscape */

/**
 * A phone held upright would show a wide slide a third of the screen tall, so
 * on a phone the deck opens in landscape: the whole viewer - slide, controls
 * and all - is laid on its side, and the reader turns the phone once to read
 * it full screen. That works with rotation locked, where the browser itself
 * never turns. With rotation unlocked, turning the phone turns the browser, the
 * screen is no longer upright, and the viewer simply stands the right way up.
 *
 * A tablet held upright has room for the slide as it is, and starts upright;
 * either can be switched with the phone button, and the reader's choice then
 * stands for the visit.
 */
const canTurn = computed(() => vp.touch && vp.portrait);
const choice = ref<"turned" | "upright" | null>(null);
const turned = computed(() => canTurn.value && (choice.value ? choice.value === "turned" : vp.phone));

const toggleTurn = () => {
  choice.value = turned.value ? "upright" : "turned";
  poke();
};

/**
 * "Turn your phone", upright on the screen while the viewer lies on its side:
 * shown a moment after the deck arrives turned, and gone after a few seconds
 * or at the first touch.
 */
const turnHint = ref(false);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

const hintTurn = () => {
  if (hintTimer) clearTimeout(hintTimer);
  turnHint.value = true;
  hintTimer = setTimeout(() => { turnHint.value = false; }, 3200);
};

watch(turned, (now) => { if (now) hintTurn(); else turnHint.value = false; });

// On arrival, once the first slide is actually there to be turned towards -
// not before it, when the cue would come and go over an empty frame.
const stopFirst = watch(shown, (now) => {
  if (!now) return;
  stopFirst();
  if (turned.value) hintTimer = setTimeout(hintTurn, 450);
});

/* ------------------------------------------------------------------- idle */

/**
 * Where the controls lie over the slide - full screen, or a phone on its side
 * - they step aside after a few quiet seconds and come back at the first sign
 * of the reader.
 */
const idle = ref(false);
let idleTimer: ReturnType<typeof setTimeout> | null = null;

const poke = () => {
  idle.value = false;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { idle.value = true; }, 2800);
};

/* --------------------------------------------------------------- controls */

const onKey = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  poke();
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
    case "PageDown":
    case " ": e.preventDefault(); next(); break;
    case "ArrowLeft":
    case "ArrowUp":
    case "PageUp": e.preventDefault(); prev(); break;
    case "Home": e.preventDefault(); void show(1); break;
    case "End": e.preventDefault(); void show(props.meta.pages); break;
    case "f":
    case "F": if (canFull.value) { e.preventDefault(); void toggleFull(); } break;
  }
};

// A swipe on the stage, past a threshold and mostly along one axis. Turned,
// the viewer's left-to-right runs down the screen, so a swipe to the reader's
// left - the next slide - is a swipe up the glass.
let touchX = 0;
let touchY = 0;
const onTouchStart = (e: TouchEvent) => {
  touchX = e.changedTouches[0].clientX;
  touchY = e.changedTouches[0].clientY;
  turnHint.value = false;
  poke();
};
const onTouchEnd = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  const [along, across] = turned.value ? [dy, dx] : [dx, dy];
  if (Math.abs(along) > 45 && Math.abs(along) > Math.abs(across) * 1.4) (along < 0 ? next : prev)();
};

onMounted(() => {
  canFull.value = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen);
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointermove", onPointer, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeaveWindow);
  document.addEventListener("fullscreenchange", onFullChange);
  window.addEventListener("resize", sharpenSoon);
  // A timer, not a frame: rAF does not run in a background tab.
  if (!reduced) riseTimer = setTimeout(() => { risen.value = true; }, 260);
  poke();
  void show(1);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("pointermove", onPointer);
  document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
  document.removeEventListener("fullscreenchange", onFullChange);
  window.removeEventListener("resize", sharpenSoon);
  if (sharpenTimer) clearTimeout(sharpenTimer);
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  if (riseTimer) clearTimeout(riseTimer);
  if (idleTimer) clearTimeout(idleTimer);
  if (hintTimer) clearTimeout(hintTimer);
  cancelAnimationFrame(raf);
  for (const value of cache.values()) URL.revokeObjectURL(value.url);
  if (shown.value) URL.revokeObjectURL(shown.value.url);
  cache.clear();
  inflight.clear();
});
</script>

<template>
  <div class="vwr">
  <section
    class="vw"
    :class="{
      'is-risen': risen,
      'is-full': full,
      'is-idle': idle,
      'is-turned': turned,
    }"
    :style="{ '--ratio': String(meta.ratio || 16 / 9) }"
  >
    <header class="vw__bar">
      <h1 class="vw__title">{{ meta.title }}<span class="vw__dot">.</span></h1>
      <p class="vw__who">
        <span class="vw__who-text">Private link for {{ meta.email }}</span>
        <button class="vw__switch" type="button" data-cursor="scale" @click="emit('leave')">Not you?</button>
      </p>
    </header>

    <div
      class="vw__stage"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- Sized to the stage at the deck's ratio, and centred on it. -->
      <div ref="frame" class="vw__frame">
        <div class="vw__rise">
          <div class="vw__rig">
            <div ref="card" class="vw__card" @click="poke">
              <Transition :name="turnName">
                <img
                  v-if="shown"
                  :key="shown.page"
                  :src="shown.url"
                  class="vw__slide"
                  :alt="`${meta.title}, slide ${shown.page} of ${meta.pages}`"
                  draggable="false"
                />
              </Transition>

              <div v-if="!shown && !error" class="vw__skeleton" aria-hidden="true" />
              <div v-if="loading && shown" class="vw__busy" aria-hidden="true"><i /></div>

              <div v-if="error" class="vw__error" role="alert">
                <p>{{ error }}</p>
                <button type="button" class="vw__retry" data-cursor="scale" @click.stop="retry">Try again</button>
              </div>

              <i class="vw__glare" aria-hidden="true" />

              <!-- Most of the slide moves the deck on: a press on either side. -->
              <button
                class="vw__edge vw__edge--prev"
                type="button"
                aria-label="Previous slide"
                data-cursor="Prev"
                :disabled="atStart"
                @click.stop="prev"
              />
              <button
                class="vw__edge vw__edge--next"
                type="button"
                aria-label="Next slide"
                data-cursor="Next"
                :disabled="atEnd"
                @click.stop="next"
              />
            </div>
          </div>
        </div>
        <div class="vw__floor" aria-hidden="true" />
      </div>
    </div>

    <nav class="vw__nav" aria-label="Slides">
      <div class="vw__pill">
        <button class="vw__arrow" type="button" aria-label="Previous slide" data-cursor="scale" :disabled="atStart" @click="prev">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.5 12h-14M11 5.5 4.5 12 11 18.5" /></svg>
        </button>

        <p class="vw__count" aria-live="polite">
          <span class="vw__now">{{ pad(page) }}</span><span class="vw__of"> / {{ pad(meta.pages) }}</span>
        </p>

        <span class="vw__track" aria-hidden="true">
          <i :style="{ transform: `scaleX(${(page / meta.pages).toFixed(4)})` }" />
        </span>

        <button class="vw__arrow" type="button" aria-label="Next slide" data-cursor="scale" :disabled="atEnd" @click="next">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.5 12h14M13 5.5 19.5 12 13 18.5" /></svg>
        </button>

        <template v-if="canTurn || canFull">
          <span class="vw__sep" aria-hidden="true" />
          <button
            v-if="canTurn"
            class="vw__tool"
            type="button"
            :aria-pressed="turned"
            aria-label="Landscape view"
            @click="toggleTurn"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <rect x="7" y="3.5" width="10" height="17" rx="2.2" />
              <path d="M3.2 9.5a8.6 8.6 0 0 1 3-4.6M4.9 4.3 6.2 4.9 5.8 6.3M20.8 14.5a8.6 8.6 0 0 1-3 4.6M19.1 19.7 17.8 19.1 18.2 17.7" />
            </svg>
          </button>
          <button
            v-if="canFull"
            class="vw__tool"
            type="button"
            :aria-pressed="full"
            :aria-label="full ? 'Leave full screen' : 'Full screen'"
            data-cursor="scale"
            @click="toggleFull"
          >
            <svg v-if="!full" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
            <svg v-else viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
          </button>
        </template>
      </div>

      <p v-if="canTurn && !turned" class="vw__hint">Tap the phone icon to read the deck in landscape.</p>
    </nav>
  </section>

  <!-- Upright on the screen while the viewer lies on its side: the one thing
       a reader needs told about it. -->
  <Transition name="vw-cue">
    <div v-if="turnHint" class="vw__cue" aria-hidden="true">
      <svg class="vw__cue-phone" viewBox="0 0 48 48" focusable="false">
        <rect x="16" y="6" width="16" height="36" rx="3.4" />
        <path d="M22 37.5h4" />
      </svg>
      <p class="vw__cue-text">Turn your phone</p>
    </div>
  </Transition>
  </div>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

/**
 * One screen, never more: the title along the top, the slide in all the room
 * between, the controls along the foot. The page does not scroll.
 */
.vw {
  --pad-x: max(clamp(0.9rem, 2.6vw, 2.5rem), var(--safe-l), var(--safe-r));

  display: grid;
  // The one column never grows past the screen for something wide inside it.
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: 100dvh;
  padding:
    calc(clamp(0.9rem, 2.2vh, 1.6rem) + var(--safe-t))
    var(--pad-x)
    calc(clamp(0.8rem, 2vh, 1.4rem) + var(--safe-b));
  color: var(--ga-ink);
}

/* -------------------------------------------------------------------- bar */

// One line on a wide screen - the deck's name, and whose copy this is - so
// the slide gets the height.
.vw__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 1.1rem;
  row-gap: 0.2rem;
  min-width: 0;
  transition: opacity 0.5s var(--e-out-quart);
}

.vw__title {
  font-family: var(--font-say);
  font-weight: 700;
  font-size: clamp(1.05rem, 1.5vw, 1.4rem);
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--c-wine);
}

.vw__dot { color: var(--ga-dot); }

.vw__who {
  display: flex;
  align-items: baseline;
  gap: 0.7rem;
  min-width: 0;
  font-family: var(--font-say);
  font-size: 0.82rem;
  color: rgb(60 1 14 / 0.58);
}

.vw__who-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vw__switch {
  flex: none;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 0.82rem;
  color: var(--ga-dot);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
  text-decoration-color: rgb(158 18 53 / 0.35);
  transition: text-decoration-color var(--t-hover) var(--e-out-quart);

  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; border-radius: 3px; }
}

/* ------------------------------------------------------------------ stage */

/**
 * The room the slide has, as a size container: the frame below is sized in
 * its units, so it is exactly as large as fits in both directions at any
 * window shape - no guessing at the height of the chrome around it.
 */
.vw__stage {
  position: relative;
  container-type: size;
  min-height: 0;
  margin-block: clamp(0.6rem, 1.8vh, 1.25rem);
  perspective: 2600px;
  perspective-origin: 50% 42%;
}

/**
 * The wrappers that carry the 3D are not what anyone points at - and they
 * must not be hit instead of the slide. They share one 3D context with it, each
 * with a plane of its own, and where the leaning slide dipped a pixel behind
 * one of those planes a press on its right half landed on an empty box. Only
 * the slide takes the pointer.
 */
.vw__frame,
.vw__rise,
.vw__rig { pointer-events: none; }

.vw__card { pointer-events: auto; }

.vw__frame {
  --tx: 0;
  --ty: 0;
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(100cqw, 100cqh * var(--ratio));
  aspect-ratio: var(--ratio);
  translate: -50% -50%;
  transform-style: preserve-3d;
}

// The build: up out of the page, from behind its plane and a little below,
// tipped back as if it had been lying on the desk.
.vw__rise {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  opacity: 0;
  transform: translate3d(0, 9%, -640px) rotateX(26deg) scale(0.9);
  transition:
    transform 1.7s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.9s var(--e-out-quart);

  .is-risen & {
    opacity: 1;
    transform: none;
  }
}

/**
 * The lean, and the deck behind the slide: two more sheets under it, a few
 * pixels deeper each, so on any tilt the slide reads as the top of a stack.
 */
.vw__rig {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateX(calc(var(--ty) * -2.2deg)) rotateY(calc(var(--tx) * 3deg));

  &::before,
  &::after {
    content: "";
    position: absolute;
    border-radius: clamp(0.55rem, 1.05vw, 1.1rem);
    background: linear-gradient(180deg, #FFFFFF, #FFF1F3);
    box-shadow: 0 0 0 1px rgb(60 1 14 / 0.05), 0 1.2rem 2.4rem -1.4rem rgb(117 2 39 / 0.3);
    pointer-events: none;
  }

  &::before {
    inset: 2.2% 1.6% -1.6%;
    transform: translateZ(-28px);
    opacity: 0.92;
  }

  &::after {
    inset: 4.4% 3.4% -3.1%;
    transform: translateZ(-56px);
    opacity: 0.7;
  }
}

.vw__card {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: clamp(0.55rem, 1.05vw, 1.1rem);
  background: #FFFFFF;
  // Near and far: a hairline, a close contact shadow, and the long soft fall
  // that makes it float above the page.
  box-shadow:
    0 0 0 1px rgb(60 1 14 / 0.06),
    0 0.3rem 0.8rem -0.2rem rgb(60 1 14 / 0.1),
    0 2.2rem 4.5rem -1.8rem rgb(117 2 39 / 0.38),
    0 5rem 9rem -4rem rgb(117 2 39 / 0.3);
  // Its own depth, for the turn between slides.
  perspective: 1400px;
  transform: translateZ(0);
}

.vw__slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  backface-visibility: hidden;
  -webkit-user-drag: none;
}

// While the first slide is on its way: a sheet, and light passing over it.
.vw__skeleton {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(100deg, rgb(255 255 255 / 0) 30%, rgb(255 255 255 / 0.7) 50%, rgb(255 255 255 / 0) 70%) 0 0 / 220% 100% no-repeat,
    linear-gradient(160deg, #FFF7F8 0%, #FDE7EA 100%);
  animation: vw-sheen 1.5s var(--e-in-out-quad) infinite;
}

@keyframes vw-sheen {
  from { background-position: 130% 0, 0 0; }
  to   { background-position: -30% 0, 0 0; }
}

// The next slide on its way, with the current one still showing.
.vw__busy {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 3;
  height: 2px;
  overflow: hidden;
  background: rgb(158 18 53 / 0.12);

  i {
    position: absolute;
    inset: 0;
    width: 40%;
    background: var(--ga-dot);
    animation: vw-busy 1.1s var(--e-in-out-quad) infinite;
  }
}

@keyframes vw-busy {
  from { transform: translateX(-100%); }
  to   { transform: translateX(260%); }
}

// Light across the slide, following the lean: faint enough never to be read
// as part of the page, present enough to say glass.
.vw__glare {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: radial-gradient(
    70% 60% at calc(50% + var(--tx) * 34%) calc(28% + var(--ty) * 30%),
    rgb(255 255 255 / 0.1),
    rgb(255 255 255 / 0) 72%
  );
  pointer-events: none;
}

.vw__error {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.9rem;
  padding: 2rem;
  text-align: center;
  background: #FFF5F6;
  font-family: var(--font-say);
  color: var(--ga-ink);
}

.vw__retry {
  padding: 0.65rem 1.5rem;
  border-radius: 999px;
  background: var(--c-wine);
  color: #FFF5F6;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: 0.9rem;

  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; }
}

.vw__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  width: 30%;
  -webkit-tap-highlight-color: transparent;

  &--prev { left: 0; }
  &--next { right: 0; }
  &:disabled { pointer-events: none; }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: -4px; border-radius: inherit; }
}

// Where the slide's shadow falls on the page, moving under the lean.
.vw__floor {
  position: absolute;
  left: 10%;
  right: 10%;
  top: 97%;
  height: 12%;
  background: radial-gradient(closest-side, rgb(117 2 39 / 0.24), rgb(117 2 39 / 0));
  filter: blur(16px);
  opacity: 0;
  // The lean moves it at once; only the arrival is eased - a transition on
  // the same property would restart on every frame of the lean.
  translate: calc(var(--tx) * -2%) 0;
  scale: 0.7;
  transition: opacity 1.2s var(--e-out-quart) 0.5s, scale 1.5s var(--e-out-expo) 0.5s;
  pointer-events: none;

  .is-risen & { opacity: 1; scale: 1; }
}

/* ------------------------------------------------------- turning a slide */

// Into the deck: the slide on screen swings away back and left, the next
// comes round from the right. Back through it, the other way.
.turn-next-enter-active,
.turn-next-leave-active,
.turn-prev-enter-active,
.turn-prev-leave-active {
  transition:
    transform 0.75s var(--e-out-expo),
    opacity 0.45s var(--e-out-quart),
    filter 0.45s var(--e-out-quart);
}

.turn-next-enter-from { opacity: 0; transform: translate3d(9%, 0, 0) rotateY(-14deg) scale(0.98); }
.turn-next-leave-to   { opacity: 0; transform: translate3d(-7%, 0, -120px) rotateY(10deg) scale(0.95); filter: blur(3px); }
.turn-prev-enter-from { opacity: 0; transform: translate3d(-9%, 0, 0) rotateY(14deg) scale(0.98); }
.turn-prev-leave-to   { opacity: 0; transform: translate3d(7%, 0, -120px) rotateY(-10deg) scale(0.95); filter: blur(3px); }

// The first slide develops in place, under the build.
.turn-first-enter-active { transition: opacity 0.9s var(--e-out-quart), transform 1.2s var(--e-out-expo); }
.turn-first-enter-from { opacity: 0; transform: scale(1.03); }

.turn-fade-enter-active,
.turn-fade-leave-active { transition: opacity 0.2s linear; }
.turn-fade-enter-from,
.turn-fade-leave-to { opacity: 0; }

/* -------------------------------------------------------------------- nav */

.vw__nav {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  transition: opacity 0.5s var(--e-out-quart), translate 0.6s var(--e-out-expo);
}

// Glass on the ground: the controls read as one object, not a row of loose words.
.vw__pill {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.62);
  -webkit-backdrop-filter: blur(14px) saturate(1.3);
  backdrop-filter: blur(14px) saturate(1.3);
  box-shadow:
    0 0 0 1px rgb(60 1 14 / 0.07),
    0 0.9rem 2rem -1rem rgb(117 2 39 / 0.3);
}

.vw__arrow,
.vw__tool {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  color: var(--ga-ink);
  transition:
    background-color var(--t-hover) var(--e-out-quart),
    color var(--t-hover) var(--e-out-quart),
    opacity var(--t-hover) var(--e-out-quart),
    transform 0.2s var(--e-out-quart);

  svg {
    width: 1.15rem;
    height: 1.15rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  &:disabled { opacity: 0.3; cursor: default; }
  &:active:not(:disabled) { transform: scale(0.92); }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 2px; }
  &[aria-pressed="true"] { background: var(--ga-ink); color: #FFF5F6; }
}

.vw__arrow:not(:disabled) {
  background: var(--c-wine);
  color: #FFF5F6;
}

.vw__count {
  min-width: 5.2rem;
  padding: 0 0.4rem;
  font-family: var(--font-say);
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

.vw__now { font-weight: 700; color: var(--c-wine); }
.vw__of { color: rgb(60 1 14 / 0.5); }

.vw__track {
  position: relative;
  width: clamp(3.5rem, 8vw, 7rem);
  height: 2px;
  margin-right: 0.6rem;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(60 1 14 / 0.12);

  i {
    position: absolute;
    inset: 0;
    background: var(--ga-dot);
    transform-origin: 0 50%;
    transition: transform 0.6s var(--e-out-expo);
  }
}

.vw__sep {
  width: 1px;
  height: 1.4rem;
  margin: 0 0.25rem;
  background: rgb(60 1 14 / 0.12);
}

.vw__hint {
  max-width: 22rem;
  font-family: var(--font-say);
  font-size: 0.78rem;
  line-height: 1.4;
  text-align: center;
  color: rgb(60 1 14 / 0.55);
}

@include hover {
  .vw__arrow:hover:not(:disabled) { background: var(--ga-dot); }
  .vw__tool:hover:not([aria-pressed="true"]) { background: rgb(158 18 53 / 0.08); }
  .vw__switch:hover { text-decoration-color: currentColor; }
}

/* ------------------------------------------------------ over the slide */

/**
 * Full screen, and a phone on its side: the slide takes the whole height, the
 * title stands down, and the controls float over the foot of the frame,
 * stepping aside after a few quiet seconds.
 */
@mixin overlaid {
  grid-template-rows: minmax(0, 1fr);

  .vw__bar { display: none; }

  .vw__stage { margin-block: 0; }

  .vw__nav {
    position: fixed;
    left: 50%;
    bottom: calc(clamp(0.6rem, 2vh, 1.2rem) + var(--safe-b));
    z-index: 10;
    translate: -50% 0;
  }

  .vw__hint { display: none; }

  &.is-idle .vw__nav {
    opacity: 0;
    translate: -50% 0.6rem;
    pointer-events: none;
  }
}

.vw.is-full {
  @include overlaid;
  padding: max(0.6rem, var(--safe-t)) var(--pad-x) max(0.6rem, var(--safe-b));
}

@include short {
  .vw {
    @include overlaid;
    padding: max(0.4rem, var(--safe-t)) var(--pad-x) max(0.4rem, var(--safe-b));
  }

  .vw__pill { transform: scale(0.9); }
}

/**
 * Landscape on a phone held upright: the whole viewer, laid on its side.
 *
 * It is as wide as the screen is tall and as tall as the screen is wide,
 * turned a quarter clockwise about its top left corner and moved back down by
 * its own height, so it covers the screen exactly - and the reader, turning
 * the phone a quarter the other way, holds it level. Inside it is the layout a
 * phone on its side gets: the slide the full height, the controls over its
 * foot. Its own left edge lies along the top of the screen, where the notch
 * is, and its right along the bottom, where the home bar is.
 *
 * Fixed descendants (the controls) are placed against this box, not the
 * screen: a transformed element is the containing block of its fixed children.
 */
.vw.is-turned {
  @include overlaid;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vh;
  width: 100dvh;
  height: 100vw;
  padding:
    0.45rem
    calc(0.6rem + var(--safe-b))
    0.45rem
    calc(0.6rem + var(--safe-t));
  transform-origin: 0 0;
  transform: rotate(90deg) translateY(-100%);

  .vw__nav { bottom: 0.55rem; }
  .vw__pill { transform: scale(0.92); }
}

/**
 * The cue: a phone, turning, on a glass pill in the middle of the screen,
 * upright however the viewer lies. It turns the way the reader has to - a
 * quarter anticlockwise - and asks for nothing: it never takes a touch.
 */
.vw__cue {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 20;
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  padding: 1.1rem 1.5rem 1rem;
  translate: -50% -50%;
  border-radius: 1.4rem;
  background: rgb(20 3 9 / 0.62);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow: 0 1.2rem 3rem -1rem rgb(20 3 9 / 0.5);
  color: #FFF5F6;
  pointer-events: none;
}

.vw__cue-phone {
  width: 3rem;
  height: 3rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: vw-cue-turn 2.2s var(--e-in-out-quart) 0.2s infinite;
}

@keyframes vw-cue-turn {
  0%, 12%   { transform: rotate(0deg); }
  46%, 70%  { transform: rotate(-90deg); }
  100%      { transform: rotate(0deg); }
}

.vw__cue-text {
  font-family: var(--font-say);
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: 0.01em;
}

.vw-cue-enter-active { transition: opacity 0.5s var(--e-out-quart), scale 0.6s var(--e-out-expo); }
.vw-cue-leave-active { transition: opacity 0.4s var(--e-out-quart), scale 0.4s var(--e-out-quart); }
.vw-cue-enter-from,
.vw-cue-leave-to { opacity: 0; scale: 0.92; }

/* -------------------------------------------------------------- handheld */

@include handheld {
  .vw__bar { flex-direction: column; align-items: flex-start; }
}

// A phone held upright has no width to spare in the pill: the count already
// says how far in the reader is, so the track stands down. Turned, the pill
// runs along the screen's length and keeps it.
@include phone {
  .vw:not(.is-turned) {
    .vw__track { display: none; }
    .vw__count { min-width: 4.4rem; }
  }
}

@include touch {
  .vw__switch {
    min-height: 44px;
    padding-block: 0.8rem;
    margin-block: -0.8rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .vw__rise,
  .vw__floor,
  .vw__frame { transition-duration: 0.01ms !important; transition-delay: 0s !important; }

  .vw__rig { transform: none; }
  .vw__skeleton,
  .vw__cue-phone { animation: none; }
}
</style>
