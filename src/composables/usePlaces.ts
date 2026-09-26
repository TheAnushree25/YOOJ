import { useRoute, useRouter } from "vue-router";
import { ScrollTrigger } from "./useMotion";
import { pageJumpTo, pageScrollTo } from "./useSmoothScroll";

/**
 * Links to places, across pages.
 *
 * A place is a page and, optionally, a section on it: `/#about`, or
 * `/solutions#affiliate`. The footer and the menu stand on both pages and
 * point at both, so every one of their links has two jobs - carry the reader
 * down the page they are already on, or take them to the other page and land
 * them on the section there.
 *
 * Neither is left to the browser. A native anchor jump moves the window under
 * the scroll engine rather than through it, so the page lands without the
 * engine knowing and without the jump being marked as one - and the clinic
 * film, which holds the page for a reader who scrolls into it, lets a jump
 * through only when it can tell. The router, for its part, would put a new
 * page at its top.
 */
export interface Place {
  path: string;
  /** A section's id on that page. Without one, the place is the top of it. */
  id?: string;
}

/** A click the browser should keep: a new tab, a new window, a download. */
const keptByBrowser = (e: MouseEvent) =>
  e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

export function usePlaces() {
  const route = useRoute();
  const router = useRouter();

  const hash = (place: Place) => (place.id ? `#${place.id}` : "");

  /**
   * The address, so every one of these is still a link: it says where it
   * goes, and a middle click opens it in a tab of its own.
   */
  const href = (place: Place) => router.resolve({ path: place.path, hash: hash(place) }).href;

  /** Whether the place is on the page being read. */
  const isHere = (place: Place) => route.path === place.path;

  /**
   * Go there. On this page the page glides itself there; on the other one the
   * router swaps pages, and the page arriving lands itself (see `land`).
   */
  const go = (place: Place, e?: MouseEvent) => {
    if (e) {
      if (keptByBrowser(e)) return;
      e.preventDefault();
    }
    if (isHere(place)) {
      const el = place.id ? document.getElementById(place.id) : null;
      if (el) pageJumpTo(el);
      else pageScrollTo(0);
      return;
    }
    void router.push({ path: place.path, hash: hash(place) });
  };

  /**
   * On the page arrived at: land on the section the address names.
   *
   * Called by a view once it is laid out and the reader is through the gate.
   * The name then comes off the address, so the address describes the page
   * rather than the moment of arriving on it.
   */
  const land = () => {
    const id = decodeURIComponent(route.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (el) {
      ScrollTrigger.refresh();
      pageJumpTo(el, true);
    }
    void router.replace({ path: route.path, query: route.query, hash: "" });
  };

  return { href, isHere, go, land };
}
