import Lenis from "lenis";
import { onBeforeUnmount, ref } from "vue";
import { ScrollTrigger } from "./useMotion";

/**
 * The page's running engine, module-scoped.
 *
 * A component deep inside a section sometimes has to move the page itself —
 * the question deck's arrow is the case. Calling the composable again to get a
 * handle would build a second Lenis on the same document and the two would
 * fight over it, so the one already running is kept here instead.
 *
 * Null until a view mounts, which is the honest state: outside a page there is
 * nothing to scroll.
 */
let engine: Lenis | null = null;

/** Eases the document to an absolute offset. A no-op before a view mounts. */
export const pageScrollTo = (top: number, duration = 1.1) =>
  engine?.scrollTo(top, { duration });

/**
 * Smooth scrolling on the document itself.
 *
 * Two earlier cuts got this wrong in the same way. The first moved a fixed
 * stage by transform; the second scrolled a fixed container. Both looked
 * identical and both broke every scroll-driven animation, because Vue mounts
 * children before their parent — so each section registered its trigger
 * against a scroller the page had not created yet, quietly measured the
 * window instead, and never fired.
 *
 * Scrolling what the browser already scrolls removes the ordering problem
 * rather than working around it: a trigger needs no configuration, and the
 * WebGL field sits fixed behind regardless.
 */
export function useSmoothScroll() {
  const progress = ref(0);
  const scrolled = ref(0);
  const limit = ref(1);

  let lenis: Lenis | null = null;
  let frame = 0;

  const mount = () => {
    lenis = new Lenis({
      duration: 1.15,
      // A long, shallow curve: the page keeps gliding after the wheel stops,
      // which is what makes a scroll-driven narrative feel weighted.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
      wheelMultiplier: 0.9,
    });

    engine = lenis;

    lenis.on("scroll", ({ scroll, limit: max }: { scroll: number; limit: number }) => {
      scrolled.value = scroll;
      limit.value = Math.max(1, max);
      progress.value = Math.min(1, Math.max(0, scroll / Math.max(1, max)));
      // Told on every eased frame rather than on the raw scroll event, so
      // pinned sections track the smoothed position they are drawn against.
      ScrollTrigger.update();
    });

    const raf = (time: number) => {
      lenis?.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    // Dev-only handle on the scroll clock, for the same reason the animation
    // clock has one: headless checks run with requestAnimationFrame throttled,
    // where Lenis never advances and every scroll assertion reads zero.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__lenis = lenis;
      // And a re-measure after every hot update. A section that changes height
      // under a hot swap leaves every trigger below it measured against the
      // old document, and a scrubbed section then plays at the wrong offset —
      // which looks exactly like an effect having been removed.
      import.meta.hot?.on("vite:afterUpdate", () => {
        requestAnimationFrame(() => ScrollTrigger.refresh(true));
      });
    }

    lastWidth = window.innerWidth;
    writeViewport();
    window.addEventListener("resize", onResize);
    // Rotation reports the new width a frame late on some devices, so the
    // orientation signal is taken on its own rather than trusted to `resize`.
    window.addEventListener("orientationchange", () => {
      requestAnimationFrame(() => {
        lastWidth = window.innerWidth;
        writeViewport();
        ScrollTrigger.refresh(true);
      });
    });

    // Web fonts change every line height on the page, which moves every start
    // and end a trigger was measured against. Re-measure once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh(true)).catch(() => {});
    ScrollTrigger.refresh();
  };

  /**
   * The viewport unit, and when it is allowed to change.
   *
   * Every long stage is a multiple of `--vh`, so rewriting it re-lays out the
   * whole document. On a phone that is a trap: the browser fires `resize`
   * every time its own address bar slides away, which happens *while you are
   * scrolling*. The old handler took that as a new viewport, changed the
   * height of a 2300vh section mid-gesture, and re-measured every trigger
   * under it - so the page lurched and the animations snapped, at the exact
   * moment the reader was looking at them.
   *
   * Width is the honest signal. A rotation or a resized window changes it; the
   * address bar never does. So the unit is written once and then only when the
   * width actually moves, and height-only events are ignored entirely.
   */
  let lastWidth = 0;

  const writeViewport = () => {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
  };

  const onResize = () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    writeViewport();
    ScrollTrigger.refresh();
  };

  const scrollTo = (target: number | string | HTMLElement) =>
    lenis?.scrollTo(target as never, { offset: 0 });

  /**
   * Holds the page still, and lets it go again.
   *
   * The gate is a fixed overlay, not a scroll container — the document behind
   * it stays perfectly scrollable, so a wheel over the splash moved the page
   * without showing that it had. Stopping the engine is what makes the gate
   * actually gate.
   */
  const lock = () => lenis?.stop();
  const unlock = () => lenis?.start();

  /** Straight to the top, no easing, and regardless of any lock in force. */
  const toTop = () => lenis?.scrollTo(0, { immediate: true, force: true });

  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", onResize);
    ScrollTrigger.getAll().forEach((t) => t.kill());
    lenis?.destroy();
    if (engine === lenis) engine = null;
  });

  return { progress, scrolled, limit, mount, scrollTo, lock, unlock, toTop };
}
