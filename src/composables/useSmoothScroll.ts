import Lenis from "lenis";
import { onBeforeUnmount, ref } from "vue";
import { ScrollTrigger } from "./useMotion";

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
    }

    window.addEventListener("resize", onResize);

    // Web fonts change every line height on the page, which moves every start
    // and end a trigger was measured against. Re-measure once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh(true)).catch(() => {});
    ScrollTrigger.refresh();
  };

  const onResize = () => {
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
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
  });

  return { progress, scrolled, limit, mount, scrollTo, lock, unlock, toTop };
}
