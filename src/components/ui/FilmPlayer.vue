<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import gsap from "gsap";
import { prefersReduced } from "../../composables/useMotion";
import { pageHold, pageRelease } from "../../composables/useSmoothScroll";
import { cinema, filmOpen } from "../../lib/session";
import { duckAmbient } from "../../lib/sound";

/**
 * A film that rises out of its poster.
 *
 * The poster stays where the page put it. Pressed, it lifts off the page and
 * grows into the screen while everything behind it goes dark, and the still
 * dissolves into the moving picture as it arrives. Closed - or finished - it
 * shrinks back into exactly the place it came from, and the page comes back
 * up around it.
 *
 * It lives on the body, not in its section: the poster stands inside a sticky,
 * transformed, clipped stage, and anything fixed inside that is fixed to the
 * stage rather than to the screen.
 *
 * The frame is never cropped. The film carries captions in its corners and a
 * badge in the other, so it is fitted whole into the screen - as large as the
 * screen allows - rather than filled across it.
 */

const props = withDefaults(defineProps<{
  /** The poster on the page: where the film rises from, and returns to. */
  origin: HTMLElement | null;
  /** The cuts of the film by pixel width. The smallest that fills the frame is played. */
  sources: ReadonlyArray<{ width: number; src: string }>;
  poster: string;
  eyebrow: string;
  /** A light line and a strong word, as the section's own heading is set. */
  title: readonly [string, string];
  /** How dark the page keeps its poster, so the two match at the hand-off. */
  shade?: number;
}>(), { shade: 0.5 });

const emit = defineEmits<{ lifted: [lifted: boolean] }>();

const root = ref<HTMLElement | null>(null);
const veil = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const still = ref<HTMLElement | null>(null);
const dim = ref<HTMLElement | null>(null);
const mark = ref<HTMLElement | null>(null);
const ring = ref<HTMLElement | null>(null);
const tri = ref<HTMLElement | null>(null);
const video = ref<HTMLVideoElement | null>(null);
const track = ref<HTMLElement | null>(null);
const top = ref<HTMLElement | null>(null);

/** The layer is up. */
const shown = ref(false);
/** The frame has arrived: the controls may show. */
const landed = ref(false);
/** The film has frames on screen, and the still has given way to it. */
const picture = ref(false);
const playing = ref(false);
const waiting = ref(false);
const muted = ref(false);
const idle = ref(false);
const fullscreen = ref(false);
/** A phone held upright: the frame spans the screen and the controls sit under it. */
const upright = ref(false);
const seeking = ref(false);
const time = ref(0);
const length = ref(0);

const ASPECT = 16 / 9;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 83 -> "1:23". */
const clock = (s: number) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/* ------------------------------------------------------------- geometry */

interface Box { x: number; y: number; w: number; h: number }

/** Where the frame stands when open: as large as the screen allows, whole. */
const place = (): Box => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  upright.value = vh > vw && vw < 900;
  if (upright.value) {
    const h = Math.round(vw / ASPECT);
    return { x: 0, y: Math.round((vh - h) / 2 - vh * 0.03), w: vw, h };
  }
  // A phone on its side has no height to spare for bars above and below; the
  // title and the controls stand over the picture there instead.
  const shallow = vh < 520;
  const side = shallow ? 12 : clamp(vw * 0.045, 20, 88);
  const above = shallow ? 12 : clamp(vh * 0.12, 72, 120);
  const below = shallow ? 12 : clamp(vh * 0.07, 28, 80);
  const w = Math.min(vw - side * 2, (vh - above - below) * ASPECT);
  const h = w / ASPECT;
  return {
    x: Math.round((vw - w) / 2),
    y: Math.round(above + (vh - above - below - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
  };
};

/**
 * How the open frame has to be drawn to lie exactly over the poster.
 *
 * Scaled down until it covers the poster, and clipped back to the poster's own
 * shape on whichever axis it overhangs: the poster is a little wider than the
 * film on a desktop and a good deal taller on a phone, and a frame squashed to
 * fit would show the picture distorting on its way up.
 */
const onPoster = (from: DOMRect, to: Box) => {
  const scale = Math.max(from.width / to.w, from.height / to.h);
  const ox = (to.w * scale - from.width) / 2;
  const oy = (to.h * scale - from.height) / 2;
  return { x: from.left - ox - to.x, y: from.top - oy - to.y, scale, cx: ox / scale, cy: oy / scale };
};

const inset = (y: number, x: number, r: number) =>
  `inset(${y.toFixed(2)}px ${x.toFixed(2)}px ${y.toFixed(2)}px ${x.toFixed(2)}px round ${r.toFixed(2)}px)`;

let box: Box = { x: 0, y: 0, w: 1, h: 1 };

/** The frame's corner once open: square where it spans the screen. */
const corner = () => (upright.value || window.innerHeight < 520 ? 0 : 14);

const setBox = (b: Box) => {
  box = b;
  const el = stage.value;
  if (!el) return;
  el.style.left = `${b.x}px`;
  el.style.top = `${b.y}px`;
  el.style.width = `${b.w}px`;
  el.style.height = `${b.h}px`;
  el.style.setProperty("--corner", `${corner()}px`);
};

/**
 * The play mark, drawn at the poster's size on screen however far the frame
 * has been scaled down to sit there - and its hairline with it.
 */
const fitMark = (scale: number) => {
  const own = props.origin?.querySelector<HTMLElement>("[data-film-mark]");
  const px = own?.getBoundingClientRect().width || 78;
  mark.value?.style.setProperty("--mark", `${px / scale}px`);
  mark.value?.style.setProperty("--hair", `${1 / scale}px`);
};

/* -------------------------------------------------------------- the film */

/** The smallest cut that fills the frame at the screen's density. */
const pick = () => {
  const cuts = [...props.sources].sort((a, b) => a.width - b.width);
  const net = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (net?.saveData || /2g|3g/.test(net?.effectiveType ?? "")) return cuts[0].src;
  const need = Math.min(window.innerWidth, window.innerHeight * ASPECT) * Math.min(window.devicePixelRatio || 1, 2);
  return (cuts.find((c) => c.width >= need * 0.85) ?? cuts[cuts.length - 1]).src;
};

/** Start the film on its way before it is asked for: a pointer over the poster. */
const warm = () => {
  const v = video.value;
  if (!v || v.getAttribute("src")) return;
  v.preload = "metadata";
  v.src = pick();
};

/**
 * The still gives way to the film once the film has frames - and not before
 * the frame is well on its way up, or the dissolve would play in a thumbnail.
 */
let openedAt = 0;
let dissolve = 0;
const showPicture = () => {
  clearTimeout(dissolve);
  const wait = Math.max(0, 560 - (performance.now() - openedAt));
  dissolve = window.setTimeout(() => { if (shown.value && !closing) picture.value = true; }, wait);
};

/* ------------------------------------------------------------ the rise */

let tl: gsap.core.Timeline | null = null;
let closing = false;
let returnFocus: HTMLElement | null = null;

const chrome = () => (top.value ? Array.from(top.value.children) : []);

const open = async () => {
  const v = video.value;
  const origin = props.origin;
  if (shown.value || closing || !v || !origin) return;

  returnFocus = document.activeElement as HTMLElement | null;
  if (!v.getAttribute("src")) v.src = pick();
  v.preload = "auto";
  if (v.ended) v.currentTime = 0;

  /**
   * Played now, inside the press, while the browser still counts it as the
   * reader's own doing - the only moment it will let a film start with its
   * sound on. It begins on half a second of dark and a title fading up, so it
   * loses nothing by starting under the rising still.
   */
  v.muted = muted.value;
  openedAt = performance.now();
  v.play().catch(() => {
    // Refused its sound after all: play silent, and the control says so.
    v.muted = true;
    muted.value = true;
    void v.play().catch(() => {});
  });

  shown.value = true;
  filmOpen.value = true;
  cinema.value = true;
  pageHold();
  await nextTick();

  const from = origin.getBoundingClientRect();
  const to = place();
  setBox(to);
  const f = onPoster(from, to);
  const radius = parseFloat(getComputedStyle(origin).borderTopLeftRadius) || 0;
  fitMark(f.scale);

  // The page's poster steps out in the same frame this one covers it.
  emit("lifted", true);

  tl?.kill();
  tl = gsap.timeline({ onComplete: land });

  if (prefersReduced()) {
    gsap.set(stage.value, { clearProps: "transform" });
    gsap.set(frame.value, { clipPath: inset(0, 0, corner()) });
    gsap.set(still.value, { top: 0, right: 0, bottom: 0, left: 0 });
    gsap.set([dim.value, mark.value], { opacity: 0 });
    tl.fromTo([veil.value, stage.value, ...chrome()], { opacity: 0 }, { opacity: 1, duration: 0.3 });
    return;
  }

  gsap.set(stage.value, { x: f.x, y: f.y, scale: f.scale, transformOrigin: "0 0", opacity: 1 });
  gsap.set(frame.value, { clipPath: inset(f.cy, f.cx, radius / f.scale) });
  gsap.set(still.value, { top: f.cy, right: f.cx, bottom: f.cy, left: f.cx });
  gsap.set(dim.value, { opacity: props.shade });
  gsap.set(mark.value, { opacity: 1 });
  gsap.set([ring.value, tri.value], { opacity: 1, scale: 1 });
  gsap.set(veil.value, { opacity: 0 });
  gsap.set(chrome(), { opacity: 0, y: 14 });

  const rise = { duration: 1.05, ease: "power4.inOut" };
  tl.to(veil.value, { opacity: 1, duration: 0.85, ease: "power2.out" }, 0)
    .to(stage.value, { x: 0, y: 0, scale: 1, ...rise }, 0)
    .to(frame.value, { clipPath: inset(0, 0, corner()), ...rise }, 0)
    .to(still.value, { top: 0, right: 0, bottom: 0, left: 0, ...rise }, 0)
    // The poster wakes as it grows: the page dims it, the screen does not.
    .to(dim.value, { opacity: 0, duration: 1, ease: "power2.inOut" }, 0)
    // The mark rings out from where it was pressed, and is gone.
    .to(ring.value, { scale: 2.3, opacity: 0, duration: 0.9, ease: "power2.out" }, 0.02)
    .to(tri.value, { scale: 0.5, opacity: 0, duration: 0.32, ease: "power2.in" }, 0)
    .to(chrome(), { opacity: 1, y: 0, duration: 0.8, stagger: 0.07, ease: "power3.out" }, 0.55);
};

/** Arrived. The controls come up; the film is already playing. */
const land = () => {
  landed.value = true;
  gsap.set(stage.value, { clearProps: "transform" });
  root.value?.focus({ preventScroll: true });
  wake();
};

const close = () => {
  if (!shown.value || closing) return;
  closing = true;
  landed.value = false;
  idle.value = false;
  clearTimeout(hideAfter);
  clearTimeout(dissolve);
  clearTimeout(ending);
  video.value?.pause();
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});

  tl?.kill();
  tl = gsap.timeline({ onComplete: settle });
  const origin = props.origin;

  if (!origin || prefersReduced()) {
    tl.to([veil.value, stage.value, ...chrome()], { opacity: 0, duration: 0.3 });
    return;
  }

  // The window may have changed shape while the film had it.
  setBox(place());
  const f = onPoster(origin.getBoundingClientRect(), box);
  const radius = parseFloat(getComputedStyle(origin).borderTopLeftRadius) || 0;
  fitMark(f.scale);

  // Back to the still, which is what the page is showing.
  picture.value = false;

  const fall = { duration: 0.95, ease: "power4.inOut" };
  tl.to(chrome(), { opacity: 0, y: -8, duration: 0.3, stagger: 0.03, ease: "power2.in" }, 0)
    .to(stage.value, { x: f.x, y: f.y, scale: f.scale, transformOrigin: "0 0", ...fall }, 0.05)
    .to(frame.value, { clipPath: inset(f.cy, f.cx, radius / f.scale), ...fall }, 0.05)
    .to(still.value, { top: f.cy, right: f.cx, bottom: f.cy, left: f.cx, ...fall }, 0.05)
    .to(dim.value, { opacity: props.shade, duration: 0.9, ease: "power2.inOut" }, 0.1)
    .to(veil.value, { opacity: 0, duration: 0.65, ease: "power2.inOut" }, 0.4)
    .fromTo(ring.value, { scale: 1.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "power3.out" }, 0.5)
    .fromTo(tri.value, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "power3.out" }, 0.58);
};

/** Home: the page's own poster takes back over, in the frame this one leaves. */
const settle = () => {
  emit("lifted", false);
  shown.value = false;
  closing = false;
  picture.value = false;
  waiting.value = false;
  filmOpen.value = false;
  cinema.value = false;
  pageRelease();
  duckAmbient(false);
  const v = video.value;
  if (v && (v.ended || (length.value && v.currentTime >= length.value - 0.3))) v.currentTime = 0;
  // Once the poster is back on the page: it cannot take focus while hidden.
  const to = returnFocus;
  void nextTick(() => to?.focus({ preventScroll: true }));
};

/* ---------------------------------------------------------- the controls */

const toggle = () => {
  const v = video.value;
  if (!v || !landed.value) return;
  if (v.paused || v.ended) void v.play().catch(() => {});
  else v.pause();
};

const toggleMute = () => {
  const v = video.value;
  if (!v) return;
  v.muted = !v.muted;
};

const skip = (by: number) => {
  const v = video.value;
  if (!v || !length.value) return;
  v.currentTime = clamp(v.currentTime + by, 0, length.value - 0.05);
  paint();
};

type Fullscreenable = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type AppleVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const toggleFullscreen = async () => {
  const el = stage.value as Fullscreenable | null;
  const v = video.value as AppleVideo | null;
  if (!el || !v) return;
  if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {}); return; }
  const ask = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
  if (ask) {
    try {
      await ask();
      // A phone turns to the film's own shape where the browser lets a page ask.
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
        .lock?.("landscape").catch(() => {});
    } catch { /* stays in the page */ }
    return;
  }
  // An iPhone has no full screen for a page's elements, only its own player.
  v.webkitEnterFullscreen?.();
};

const onFullscreen = () => { fullscreen.value = document.fullscreenElement === stage.value; };

/**
 * The bar and the title step aside while the film plays and nobody is
 * touching anything, and come back at the first movement.
 */
let hideAfter = 0;
const wake = () => {
  idle.value = false;
  clearTimeout(hideAfter);
  hideAfter = window.setTimeout(() => {
    if (playing.value && !seeking.value) idle.value = true;
  }, 2600);
};

/* ------------------------------------------------------------- the track */

/**
 * The played line is drawn every frame while the film runs, straight onto the
 * track, rather than through a reactive value: `timeupdate` arrives four times
 * a second, and a line moved at that rate visibly steps.
 */
let loop = 0;
const paint = () => {
  const v = video.value;
  const t = track.value;
  if (!v || !t || !length.value) return;
  t.style.setProperty("--played", String(clamp(v.currentTime / length.value, 0, 1)));
};
const run = () => {
  paint();
  loop = requestAnimationFrame(run);
};

const onLoaded = () => {
  const v = video.value;
  const t = track.value;
  if (!v || !t || !length.value) return;
  const b = v.buffered;
  for (let i = 0; i < b.length; i++) {
    if (b.start(i) <= v.currentTime + 0.5 && b.end(i) >= v.currentTime) {
      t.style.setProperty("--loaded", String(clamp(b.end(i) / length.value, 0, 1)));
      return;
    }
  }
};

const seekAt = (e: PointerEvent) => {
  const v = video.value;
  const t = track.value;
  if (!v || !t || !length.value) return;
  const r = t.getBoundingClientRect();
  v.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * (length.value - 0.05);
  time.value = v.currentTime;
  paint();
};

const seekStart = (e: PointerEvent) => {
  if (e.button !== 0) return;
  seeking.value = true;
  track.value?.setPointerCapture(e.pointerId);
  seekAt(e);
};
const seekMove = (e: PointerEvent) => { if (seeking.value) seekAt(e); };
const seekEnd = (e: PointerEvent) => {
  if (!seeking.value) return;
  seeking.value = false;
  if (track.value?.hasPointerCapture(e.pointerId)) track.value.releasePointerCapture(e.pointerId);
  wake();
};

/* ------------------------------------------------------------ the events */

const onPlaying = () => {
  playing.value = true;
  waiting.value = false;
  cancelAnimationFrame(loop);
  loop = requestAnimationFrame(run);
  if (!video.value?.muted) duckAmbient(true);
  showPicture();
  wake();
};

const onPause = () => {
  playing.value = false;
  cancelAnimationFrame(loop);
  paint();
  duckAmbient(false);
  idle.value = false;
  clearTimeout(hideAfter);
};

/** It ends on black: held a beat, and then it goes home. */
let ending = 0;
const onEnded = () => {
  onPause();
  clearTimeout(ending);
  ending = window.setTimeout(close, 700);
};

const onVolume = () => {
  const v = video.value;
  if (!v) return;
  muted.value = v.muted;
  duckAmbient(!v.muted && !v.paused);
};

const onMeta = () => {
  const v = video.value;
  if (v && Number.isFinite(v.duration)) length.value = v.duration;
};

const onTime = () => {
  if (!seeking.value) time.value = video.value?.currentTime ?? 0;
};

/* ----------------------------------------------------------- the keyboard */

const onKey = (e: KeyboardEvent) => {
  if (!shown.value) return;
  wake();
  const onControl = !!(e.target as HTMLElement | null)?.closest?.("button");

  if (e.key === "Escape") {
    // Full screen answers Escape itself; the film closes on the next one.
    if (document.fullscreenElement) return;
    e.preventDefault();
    close();
    return;
  }

  if (e.key === "Tab") {
    const items = Array.from(root.value?.querySelectorAll<HTMLElement>("button, [role='slider']") ?? []);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const at = document.activeElement;
    if (e.shiftKey && (at === first || !root.value?.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !root.value?.contains(at))) { e.preventDefault(); first.focus(); }
    return;
  }

  if (!landed.value) return;
  switch (e.key) {
    case " ":
    case "k":
    case "K":
      // A focused button answers Space itself.
      if (onControl && e.key === " ") return;
      e.preventDefault();
      toggle();
      break;
    case "ArrowLeft": e.preventDefault(); skip(-5); break;
    case "ArrowRight": e.preventDefault(); skip(5); break;
    case "m":
    case "M": toggleMute(); break;
    case "f":
    case "F": void toggleFullscreen(); break;
  }
};

/** Kept whole and in place when the window changes shape under it. */
const onResize = () => {
  if (!shown.value || !landed.value || closing) return;
  setBox(place());
  gsap.set(frame.value, { clipPath: inset(0, 0, corner()) });
};

onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);
  document.addEventListener("fullscreenchange", onFullscreen);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("resize", onResize);
  document.removeEventListener("fullscreenchange", onFullscreen);
  cancelAnimationFrame(loop);
  clearTimeout(hideAfter);
  clearTimeout(dissolve);
  clearTimeout(ending);
  tl?.kill();
  video.value?.pause();
  // A page change with the film up must not leave the next page held.
  if (shown.value) {
    filmOpen.value = false;
    cinema.value = false;
    pageRelease();
    duckAmbient(false);
  }
});

defineExpose({ open, close, warm });
</script>

<template>
  <Teleport to="body">
    <div
      v-show="shown"
      ref="root"
      class="fp"
      :class="{
        'is-landed': landed,
        'is-playing': playing,
        'is-idle': idle,
        'is-upright': upright,
        'is-fullscreen': fullscreen,
        'has-picture': picture,
        'is-waiting': waiting && landed,
      }"
      role="dialog"
      aria-modal="true"
      :aria-label="`${title[0]} ${title[1]}: the film`"
      tabindex="-1"
      @pointermove="wake"
      @touchstart.passive="wake"
    >
      <!-- The page, gone to night behind the film. A press on it closes. -->
      <div ref="veil" class="fp__veil" data-cursor="Close" @click="close" />

      <header ref="top" class="fp__top">
        <p class="fp__eyebrow">{{ eyebrow }}</p>
        <p class="fp__title">{{ title[0] }} <strong>{{ title[1] }}</strong></p>
        <button class="fp__close" type="button" aria-label="Close the film" data-cursor="scale" @click="close">
          <i aria-hidden="true" />
        </button>
      </header>

      <div ref="stage" class="fp__stage">
        <div ref="frame" class="fp__frame">
          <div ref="still" class="fp__still">
            <img :src="poster" alt="" decoding="async" fetchpriority="low" draggable="false">
          </div>
          <video
            ref="video"
            class="fp__video"
            preload="none"
            playsinline
            webkit-playsinline
            disablepictureinpicture
            @loadedmetadata="onMeta"
            @durationchange="onMeta"
            @timeupdate="onTime"
            @progress="onLoaded"
            @playing="onPlaying"
            @pause="onPause"
            @ended="onEnded"
            @waiting="waiting = true"
            @canplay="waiting = false"
            @volumechange="onVolume"
            @click="toggle"
            @dblclick="toggleFullscreen"
          />
          <div ref="dim" class="fp__dim" aria-hidden="true" />
          <span ref="mark" class="fp__mark" aria-hidden="true">
            <i ref="ring" class="fp__ring" />
            <i ref="tri" class="fp__tri" />
          </span>
          <span class="fp__spin" aria-hidden="true" />
        </div>

        <div class="fp__bar">
          <button
            class="fp__btn fp__pp"
            type="button"
            :aria-label="playing ? 'Pause' : 'Play'"
            data-cursor="scale"
            @click="toggle"
          >
            <svg v-if="playing" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9" /></svg>
            <svg v-else class="is-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 3.1 12.6 8l-7.4 4.9Z" /></svg>
          </button>

          <span class="fp__time" aria-hidden="true">{{ clock(time) }}<i> / </i>{{ clock(length) }}</span>

          <div
            ref="track"
            class="fp__track"
            :class="{ 'is-seeking': seeking }"
            role="slider"
            tabindex="0"
            aria-label="Seek"
            aria-valuemin="0"
            :aria-valuemax="Math.round(length)"
            :aria-valuenow="Math.round(time)"
            :aria-valuetext="`${clock(time)} of ${clock(length)}`"
            data-cursor="scale"
            @pointerdown="seekStart"
            @pointermove="seekMove"
            @pointerup="seekEnd"
            @pointercancel="seekEnd"
          >
            <i class="fp__rail" />
            <i class="fp__loaded" />
            <i class="fp__played" />
            <i class="fp__knob" />
          </div>

          <button
            class="fp__btn"
            type="button"
            :aria-label="muted ? 'Unmute' : 'Mute'"
            data-cursor="scale"
            @click="toggleMute"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5Z" />
              <path v-if="muted" d="m10.6 6.2 3.4 3.6M14 6.2l-3.4 3.6" />
              <path v-else d="M10.6 5.6a3.3 3.3 0 0 1 0 4.8M12.4 3.9a5.7 5.7 0 0 1 0 8.2" />
            </svg>
          </button>

          <button
            class="fp__btn"
            type="button"
            :aria-label="fullscreen ? 'Leave full screen' : 'Full screen'"
            data-cursor="scale"
            @click="toggleFullscreen"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path v-if="fullscreen" d="M6 2.5V6H2.5M10 2.5V6h3.5M6 13.5V10H2.5M10 13.5V10h3.5" />
              <path v-else d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
@use "../../styles/media" as *;

/**
 * Over the whole site, the gate and the menu included, and under the cursor -
 * which is the only pointer there is on a desktop and has to stay on top.
 */
.fp {
  position: fixed;
  inset: 0;
  z-index: 150;
  color: var(--c-bone);
  outline: none;
  // Nothing under the film takes a finger's drag while it is up.
  touch-action: none;
  overscroll-behavior: contain;
}

/**
 * Night, with the film's own light on it: nearly black, and warm where the
 * picture is, as a room goes when a screen is the only thing lit in it.
 */
.fp__veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(58% 52% at 50% 50%, rgb(117 2 39 / 0.26), rgb(117 2 39 / 0) 72%),
    rgb(9 2 5);
  opacity: 0;
}

/* ---------------------------------------------------------------- the top */

.fp__top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 1.5rem;
  padding: max(clamp(1rem, 3.4vh, 2.1rem), var(--safe-t)) var(--gutter) 0;
  pointer-events: none;
  transition: opacity 0.6s var(--e-out-quart);

  > * { pointer-events: auto; }

  .is-idle & { opacity: 0; }
}

.fp__eyebrow {
  grid-column: 1;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: var(--ls-label);
  text-transform: uppercase;
  color: rgb(var(--rgb-bone) / 0.56);
}

.fp__title {
  grid-column: 1;
  margin-top: 0.4rem;
  font-family: var(--font-say);
  font-weight: 300;
  font-size: clamp(1.05rem, 1.55vw, 1.5rem);
  line-height: 1.2;
  color: var(--c-bone);

  strong { font-weight: 800; }
}

.fp__close {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 1px solid rgb(var(--rgb-bone) / 0.32);
  transition:
    border-color var(--t-hover) var(--e-out-quart),
    background-color var(--t-hover) var(--e-out-quart);

  i {
    position: relative;
    width: 1.1rem;
    height: 1.1rem;
    transition: transform 0.6s var(--e-out-expo);

    &::before,
    &::after {
      content: "";
      position: absolute;
      left: 0;
      top: 50%;
      width: 100%;
      height: 1px;
      background: currentColor;
      transform: rotate(45deg);
    }

    &::after { transform: rotate(-45deg); }
  }

  @include hover {
    &:hover {
      border-color: var(--c-bone);
      background: rgb(var(--rgb-bone) / 0.08);

      i { transform: rotate(90deg); }
    }
  }

  &:focus-visible {
    outline: none;
    border-color: var(--c-bone);
    box-shadow: 0 0 0 3px rgb(var(--rgb-accent) / 0.5);
  }
}

/* -------------------------------------------------------------- the frame */

// Its place is written by the script: the frame's rectangle when open.
.fp__stage {
  position: absolute;
}

.fp__frame {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #000000;
  isolation: isolate;
}

.fp__still,
.fp__video {
  position: absolute;
  max-width: none;
}

// Its box is animated with the frame's clip, so at the hand-off it is exactly
// the page's poster: the same crop of the same picture. A box around the
// picture rather than the picture itself: an image does not stretch between
// its insets the way a box does, it keeps its own size.
.fp__still {
  inset: 0;
  transition: opacity 0.9s var(--e-out-quart);

  img {
    width: 100%;
    height: 100%;
    max-width: none;
    object-fit: cover;
    object-position: center;
  }

  .has-picture & { opacity: 0; }
}

.fp__video {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transition: opacity 0.9s var(--e-out-quart);

  .has-picture & { opacity: 1; }
  .is-landed & { cursor: pointer; }
}

.fp__dim {
  position: absolute;
  inset: 0;
  background: #000000;
  pointer-events: none;
}

.fp__mark {
  --mark: 78px;
  --hair: 1px;
  position: absolute;
  left: 50%;
  top: 50%;
  display: grid;
  place-items: center;
  width: var(--mark);
  height: var(--mark);
  margin: calc(var(--mark) / -2) 0 0 calc(var(--mark) / -2);
  pointer-events: none;

  > i { grid-area: 1 / 1; }
}

.fp__ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: var(--hair) solid rgb(255 255 255 / 0.85);
}

// The page's triangle, in the page's proportions: 28 x 35 on a 78 ring.
.fp__tri {
  width: calc(var(--mark) * 0.359);
  height: calc(var(--mark) * 0.449);
  margin-left: calc(var(--mark) * 0.12);
  background: #FEB3B8;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

.fp__spin {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 2.8rem;
  height: 2.8rem;
  margin: -1.4rem 0 0 -1.4rem;
  border-radius: 50%;
  border: 1px solid rgb(255 255 255 / 0.16);
  border-top-color: rgb(255 255 255 / 0.85);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.35s var(--e-out-quart);
  animation: fp-spin 0.9s linear infinite paused;

  .is-waiting & {
    opacity: 1;
    animation-play-state: running;
  }
}

@keyframes fp-spin {
  to { transform: rotate(1turn); }
}

/* ------------------------------------------------------------ the controls */

.fp__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: clamp(0.4rem, 1vw, 0.9rem);
  padding: 3rem clamp(0.75rem, 1.5vw, 1.25rem) clamp(0.6rem, 1.2vw, 1rem);
  border-radius: 0 0 var(--corner, 14px) var(--corner, 14px);
  background: linear-gradient(to top, rgb(0 0 0 / 0.66), rgb(0 0 0 / 0));
  opacity: 0;
  transform: translate3d(0, 0.5rem, 0);
  pointer-events: none;
  transition:
    opacity 0.45s var(--e-out-quart),
    transform 0.6s var(--e-out-expo);

  .is-landed & {
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }

  .is-landed.is-idle & {
    opacity: 0;
    transform: translate3d(0, 0.5rem, 0);
  }
}

.fp__btn {
  flex: none;
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  color: var(--c-bone);
  transition:
    background-color var(--t-hover) var(--e-out-quart),
    border-color var(--t-hover) var(--e-out-quart);

  svg {
    width: 1.05rem;
    height: 1.05rem;
    overflow: visible;
  }

  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  @include hover {
    &:hover { background: rgb(var(--rgb-bone) / 0.12); }
  }

  &:focus-visible {
    outline: 1px solid rgb(var(--rgb-bone) / 0.7);
    outline-offset: 2px;
  }
}

// The site's own play mark, small: a hairline ring with the rose triangle.
.fp__pp {
  width: 2.9rem;
  height: 2.9rem;
  border: 1px solid rgb(var(--rgb-bone) / 0.5);

  .is-play path {
    fill: #FEB3B8;
    stroke: #FEB3B8;
  }
}

.fp__time {
  flex: none;
  font-family: "Space Grotesk", ui-monospace, monospace;
  font-size: var(--t-label);
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: rgb(var(--rgb-bone) / 0.85);

  i {
    font-style: normal;
    opacity: 0.45;
  }
}

.fp__track {
  --played: 0;
  --loaded: 0;
  position: relative;
  flex: 1;
  min-width: 3rem;
  height: 2rem;
  cursor: pointer;
  touch-action: none;
  outline: none;

  > i {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    margin-top: -1px;
    border-radius: 2px;
    transform-origin: left center;
    transition: height 0.25s var(--e-out-quart), margin-top 0.25s var(--e-out-quart);
  }
}

.fp__rail { background: rgb(var(--rgb-bone) / 0.2); }
.fp__loaded { background: rgb(var(--rgb-bone) / 0.28); transform: scaleX(var(--loaded)); }
.fp__played { background: #FEB3B8; transform: scaleX(var(--played)); }

.fp__track > .fp__knob {
  left: calc(var(--played) * 100%);
  right: auto;
  width: 0.8rem;
  height: 0.8rem;
  margin: -0.4rem 0 0 -0.4rem;
  border-radius: 50%;
  background: #FEB3B8;
  transform: scale(0);
  transition: transform 0.25s var(--e-out-quart);
}

.fp__track:hover,
.fp__track:focus-visible,
.fp__track.is-seeking {
  > i:not(.fp__knob) {
    height: 4px;
    margin-top: -2px;
  }

  > .fp__knob { transform: scale(1); }
}

.fp__track:focus-visible > .fp__rail {
  box-shadow: 0 0 0 3px rgb(var(--rgb-accent) / 0.35);
}

/* ------------------------------------------------------------ full screen */

// The script's rectangle and the rise's transform both stand down.
.fp__stage:fullscreen {
  position: fixed !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  transform: none !important;
  background: #000000;

  .fp__frame { clip-path: none !important; }
  .fp__bar { border-radius: 0; }
}

/* --------------------------------------------------------------- handheld */

/**
 * A phone held upright: the frame spans the screen, and the controls sit
 * under the picture rather than over it - there is room below, and a thumb
 * should not have to reach into the film to find them.
 */
.is-upright {
  .fp__bar {
    top: 100%;
    bottom: auto;
    padding: 0.85rem var(--gutter) 0;
    border-radius: 0;
    background: none;
  }

  .fp__title { font-size: 1.1rem; }
}

.is-upright.is-fullscreen .fp__bar {
  top: auto;
  bottom: 0;
  padding-bottom: max(0.75rem, var(--safe-b));
  background: linear-gradient(to top, rgb(0 0 0 / 0.66), rgb(0 0 0 / 0));
}

@include touch {
  .fp__btn {
    width: 2.75rem;
    height: 2.75rem;
  }

  .fp__track { height: 2.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .fp__still,
  .fp__video,
  .fp__bar { transition-duration: 0.01ms; }
}
</style>
