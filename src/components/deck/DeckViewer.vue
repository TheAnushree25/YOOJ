<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import BrandMark from "../ui/BrandMark.vue";
import {
  DeckError, fetchSlide, type DeckMeta,
} from "../../lib/deck-api";

/**
 * The deck itself, one slide at a time.
 *
 * The frame is fixed at the deck's own aspect (from the manifest) and every
 * page lands inside it, so the chrome never jumps between a wide slide and a
 * tall one. Slides are fetched as blobs and cached in a small ring; the two
 * either side of the reader are warmed ahead so a press is a swap, not a wait.
 *
 * Each blob is stamped with the reader's address on the server. Object URLs
 * are revoked when they age out of the ring and when the deck unmounts, so no
 * decoded slide is left behind.
 */

const props = defineProps<{ pass: string; meta: DeckMeta }>();
const emit = defineEmits<{ expired: []; leave: [] }>();

const page = ref(1);
const url = ref<string | null>(null);
const loading = ref(true);
const error = ref("");
const stage = ref<HTMLElement | null>(null);

/** page -> object URL. A handful deep: the slide, its neighbours, and headroom. */
const cache = new Map<number, string>();
const inflight = new Map<number, Promise<string>>();
const RING = 7;

/** The width to ask the server for, from the frame's rendered size and the display density. */
const askWidth = () => {
  const box = stage.value?.clientWidth ?? window.innerWidth;
  return Math.min(2400, Math.round(box * Math.min(window.devicePixelRatio || 1, 2)));
};

const trim = () => {
  if (cache.size <= RING) return;
  const keep = new Set<number>();
  for (let d = -2; d <= 2; d++) keep.add(page.value + d);
  for (const [key, value] of [...cache.entries()]) {
    if (cache.size <= RING) break;
    if (keep.has(key)) continue;
    URL.revokeObjectURL(value);
    cache.delete(key);
  }
};

const load = (n: number, ahead = false): Promise<string> => {
  const have = cache.get(n);
  if (have) return Promise.resolve(have);
  const already = inflight.get(n);
  if (already) return already;

  const job = fetchSlide(props.pass, n, askWidth(), { ahead })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      cache.set(n, objectUrl);
      trim();
      return objectUrl;
    })
    .finally(() => inflight.delete(n));
  inflight.set(n, job);
  return job;
};

const show = async (n: number) => {
  const target = Math.min(Math.max(1, n), props.meta.pages);
  page.value = target;
  loading.value = !cache.has(target);
  error.value = "";
  try {
    const objectUrl = await load(target);
    // The reader may have moved on while this one was arriving.
    if (page.value === target) {
      url.value = objectUrl;
      loading.value = false;
    }
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
const counter = computed(() => `${page.value} / ${props.meta.pages}`);
const frameRatio = computed(() => String(props.meta.ratio || 16 / 9));

/* --------------------------------------------------------------- controls */

const onKey = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
  switch (e.key) {
    case "ArrowRight":
    case "PageDown":
    case " ": e.preventDefault(); next(); break;
    case "ArrowLeft":
    case "PageUp": e.preventDefault(); prev(); break;
    case "Home": e.preventDefault(); void show(1); break;
    case "End": e.preventDefault(); void show(props.meta.pages); break;
  }
};

// A swipe on the stage, horizontal and past a threshold.
let touchX = 0;
let touchY = 0;
const onTouchStart = (e: TouchEvent) => {
  touchX = e.changedTouches[0].clientX;
  touchY = e.changedTouches[0].clientY;
};
const onTouchEnd = (e: TouchEvent) => {
  const dx = e.changedTouches[0].clientX - touchX;
  const dy = e.changedTouches[0].clientY - touchY;
  if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? next : prev)();
};

onMounted(() => {
  window.addEventListener("keydown", onKey);
  void show(1);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  for (const value of cache.values()) URL.revokeObjectURL(value);
  cache.clear();
  inflight.clear();
});

// A resize can cross the width the server serves; the next fetch asks for the
// new size, but what is already cached is fine to keep at its old resolution.
let resizeTimer: ReturnType<typeof setTimeout> | null = null;
const onResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { resizeTimer = null; }, 200);
};
onMounted(() => window.addEventListener("resize", onResize));
onBeforeUnmount(() => window.removeEventListener("resize", onResize));

// The pass can lapse after the deck is already open; a parent swap of it means start over.
watch(() => props.pass, () => void show(page.value));
</script>

<template>
  <section class="vw">
    <header class="vw__bar">
      <div class="vw__id">
        <h1 class="vw__title">
          {{ meta.title }}<span class="vw__dot">.</span>
        </h1>
        <p class="vw__who">Private link for {{ meta.email }}</p>
      </div>
      <RouterLink class="vw__home" to="/" data-cursor="scale" aria-label="YOOJ, back to the site">
        <BrandMark class="vw__glyph" />
      </RouterLink>
    </header>

    <div
      ref="stage"
      class="vw__stage"
      :style="{ '--ratio': frameRatio }"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <div class="vw__frame">
        <img
          v-if="url"
          :src="url"
          class="vw__slide"
          :class="{ 'is-dim': loading }"
          :alt="`${meta.title}, slide ${page} of ${meta.pages}`"
          draggable="false"
        />
        <div v-if="loading" class="vw__spin" aria-hidden="true"><i /></div>
        <div v-if="error" class="vw__error" role="alert">
          <p>{{ error }}</p>
          <button type="button" class="vw__retry" data-cursor="scale" @click="retry">Try again</button>
        </div>

        <!-- Edge presses over the slide, so most of the frame moves the deck on. -->
        <button
          class="vw__edge vw__edge--prev"
          type="button"
          aria-label="Previous slide"
          :disabled="atStart"
          @click="prev"
        />
        <button
          class="vw__edge vw__edge--next"
          type="button"
          aria-label="Next slide"
          :disabled="atEnd"
          @click="next"
        />
      </div>
    </div>

    <footer class="vw__nav">
      <button class="vw__btn" type="button" data-cursor="scale" :disabled="atStart" @click="prev">← Prev</button>
      <span class="vw__count" aria-live="polite">{{ counter }}</span>
      <button class="vw__btn" type="button" data-cursor="scale" :disabled="atEnd" @click="next">Next →</button>
    </footer>
  </section>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

.vw {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding:
    calc(clamp(1rem, 2vw, 1.6rem) + var(--safe-t))
    max(clamp(1rem, 2.4vw, 2rem), var(--safe-r))
    calc(clamp(1rem, 2vw, 1.6rem) + var(--safe-b))
    max(clamp(1rem, 2.4vw, 2rem), var(--safe-l));
  background: #FFF5F6;
  color: var(--ga-ink);
}

/* -------------------------------------------------------------------- bar */

.vw__bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  width: 100%;
  max-width: 78rem;
  margin: 0 auto;
}

.vw__id { min-width: 0; }

.vw__title {
  font-family: var(--font-say);
  font-weight: 700;
  font-size: clamp(1.1rem, 1.8vw, 1.55rem);
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.vw__dot { color: var(--ga-dot); }

.vw__who {
  margin-top: 0.25rem;
  overflow: hidden;
  font-family: var(--font-say);
  font-size: 0.8125rem;
  color: rgb(var(--rgb-ink) / 0.55);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vw__home {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--c-wine);
  transition: transform var(--t-hover) var(--e-out-quart);

  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; border-radius: 8px; }
}

.vw__glyph { width: 1.5rem; height: 1.5rem; }

/* ------------------------------------------------------------------ stage */

.vw__stage {
  display: grid;
  place-items: center;
  flex: 1;
  width: 100%;
  max-width: 78rem;
  margin: 0 auto;
  padding: clamp(0.75rem, 2vh, 1.5rem) 0;
  min-height: 0;
}

/**
 * The deck's frame, at the deck's own ratio, as large as fits the stage in
 * both directions. Both caps matter: width alone overflows a short window,
 * height alone overflows a narrow one.
 */
.vw__frame {
  position: relative;
  aspect-ratio: var(--ratio);
  width: min(100%, calc((100dvh - 13rem) * var(--ratio)));
  border-radius: clamp(0.6rem, 1.2vw, 1.1rem);
  overflow: hidden;
  background: #EAD9DC;
  box-shadow: 0 18px 60px rgb(60 1 14 / 0.16), 0 2px 8px rgb(60 1 14 / 0.08);
}

.vw__slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-user-drag: none;
  transition: opacity 0.28s var(--e-out-quart);

  &.is-dim { opacity: 0.4; }
}

.vw__spin {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;

  i {
    width: 2.2rem;
    height: 2.2rem;
    border: 2px solid rgb(60 1 14 / 0.18);
    border-top-color: var(--ga-dot);
    border-radius: 50%;
    animation: vw-spin 0.8s linear infinite;
  }
}

@keyframes vw-spin { to { transform: rotate(360deg); } }

.vw__error {
  position: absolute;
  inset: 0;
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
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  background: var(--c-wine);
  color: #FFF5F6;
  font-family: var(--font-say);
  font-weight: 600;
  font-size: 0.9rem;
}

.vw__edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 32%;
  cursor: inherit;

  &--prev { left: 0; }
  &--next { right: 0; }
  &:disabled { pointer-events: none; }
}

/* -------------------------------------------------------------------- nav */

.vw__nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(1rem, 3vw, 2rem);
  width: 100%;
  max-width: 78rem;
  margin: 0 auto;
}

.vw__btn {
  padding: 0.7rem 1.5rem;
  border: 1px solid rgb(60 1 14 / 0.2);
  border-radius: 999px;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--ga-ink);
  transition:
    border-color var(--t-hover) var(--e-out-quart),
    background-color var(--t-hover) var(--e-out-quart),
    opacity var(--t-hover) var(--e-out-quart);

  &:disabled { opacity: 0.4; cursor: default; }
  &:focus-visible { outline: 2px solid var(--ga-dot); outline-offset: 3px; }
}

@include hover {
  .vw__btn:hover:not(:disabled) { border-color: var(--ga-dot); background: rgb(158 18 53 / 0.06); }
  .vw__home:hover { transform: scale(1.08); }
}

.vw__count {
  min-width: 4.5rem;
  font-family: var(--font-say);
  font-weight: 500;
  font-size: 0.9rem;
  color: rgb(var(--rgb-ink) / 0.6);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

@include touch {
  .vw__btn { min-height: 44px; }
}

@include compact {
  .vw__frame { width: min(100%, calc((100dvh - 11rem) * var(--ratio))); }
  .vw__who { max-width: 52vw; }
}
</style>
