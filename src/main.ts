import { createApp } from "vue";
import gsap from "gsap";
import App from "./App.vue";
import { router, warmSecondPage } from "./router";
import { vReveal } from "./composables/useReveal";

import "@fontsource-variable/inter";
import "@fontsource/montserrat/300.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "./styles/main.scss";

/**
 * The page always starts at the top.
 *
 * Browsers restore the previous scroll offset on a reload, and this site opens
 * behind a full-screen gate — so a reader who refreshed anywhere below the fold
 * pressed Enter and arrived in the middle of the second section, having never
 * seen the hero. Taken manually, and reset before the first paint, because by
 * the time a component mounts the restore has already happened.
 */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

createApp(App).use(router).directive("reveal", vReveal).mount("#app");

// The page the reader has not asked for yet, fetched while they read the one
// they did. See warmSecondPage.
warmSecondPage();

// Dev-only handle on the animation clock. Headless checks and the preview pane
// run with requestAnimationFrame throttled, where every tween sits at frame
// zero and looks broken; pumping the ticker by hand drives them truthfully.
// Stripped from production builds by the bundler.
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__gsap = gsap;
  // Drives both clocks together — the scroll easing and the tween ticker —
  // because a scroll-triggered animation needs the first to reach the trigger
  // and the second to play what it fires.
  w.__pump = async (ms = 1800, step = 32) => {
    const start = performance.now();
    for (let t = 0; t < ms; t += step) {
      (w.__lenis as { raf?: (time: number) => void } | undefined)?.raf?.(start + t);
      gsap.ticker.tick();
      await new Promise((r) => setTimeout(r, step));
    }
  };
}
