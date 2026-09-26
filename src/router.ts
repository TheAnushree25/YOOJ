import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./pages/HomeView.vue";

/**
 * Two pages, and the second is loaded on demand.
 *
 * `/solutions` carries its own ground and its own choreography, none of which
 * the front page needs — splitting it out keeps the first paint carrying only
 * what the first page actually shows.
 */
/**
 * The second page, as one loader rather than two.
 *
 * Named here so the route and the warm-up below are literally the same import
 * — two separate `import()` expressions for the same file are two entries in
 * the bundler's graph, and warming one would leave the other cold.
 */
const AlephView = () => import("./pages/AlephView.vue");

/**
 * The investor deck, at /deck.
 *
 * Its own chunk: it carries a fifth font weight, an email gate, a slide
 * viewer and the code that guards the page, none of which the two public
 * pages ever load. A visitor who never opens the deck never downloads it.
 */
const DeckView = () => import("./pages/DeckView.vue");

/**
 * The fine print: privacy, terms and cookies, one page between them.
 *
 * Reached from the footer's "Legal". Its own small chunk, like the deck: a
 * reader who never opens it never downloads it.
 */
const LegalView = () => import("./pages/LegalView.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/solutions", name: "solutions", component: AlephView },
    { path: "/deck", name: "deck", component: DeckView },
    { path: "/legal/:doc(privacy|terms|cookies)", name: "legal", component: LegalView },
    // The page answered to /aleph until now, so that address keeps working
    // rather than falling through to the catch-all and landing on the front
    // page with no explanation.
    { path: "/aleph", redirect: "/solutions" },
    // Anything else is the front page rather than a dead end.
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
  // Every view drives its own scroll engine and starts at the top; letting the
  // router restore a position as well fights it.
  scrollBehavior: (to, from) => {
    // A section asked for by name. The page carries itself there once it is
    // ready, on its own engine (composables/usePlaces); moving the window
    // underneath it here would land the page without the engine knowing.
    if (to.hash) return false;
    // The name coming off the address after that landing: the same page,
    // and nothing to move.
    if (from.matched.length && to.path === from.path) return false;
    return { top: 0 };
  },
});

/**
 * A new page is built at the top, not moved there afterwards.
 *
 * The scroll above runs a tick after the new page has mounted, and every
 * section on it measures itself as it mounts - against wherever the old page
 * was left, which after a long page is somewhere deep in the new one. Reset
 * here, before the swap, the window is at the top before the first of them
 * looks; a page asked to open on a section then goes there itself.
 */
router.afterEach((to, from, failure) => {
  if (failure || !from.matched.length || to.path === from.path) return;
  window.scrollTo(0, 0);
});

/**
 * Fetch the second page while the first one is being read.
 *
 * Measured at about 1.6s between pressing the link and the page appearing:
 * until the click, none of that route's module graph — a WebGL scene and the
 * geometry that feeds it among it — had begun downloading, so the site simply
 * did nothing for a second and a half. Warmed ahead of time the click is a
 * swap rather than a fetch.
 *
 * On idle, and not before the first page has finished loading, so this can
 * never compete with the paint the reader is actually waiting for. The result
 * is deliberately dropped: a failed warm-up is not an error, it just means the
 * click pays what it used to.
 */
export const warmSecondPage = () => {
  const go = () => { void AlephView().catch(() => {}); };

  const whenIdle = (run: () => void) => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 1200);
  };

  if (document.readyState === "complete") whenIdle(go);
  else window.addEventListener("load", () => whenIdle(go), { once: true });
};
