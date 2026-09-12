import type { Directive } from "vue";

/**
 * Reveal-on-enter as a directive rather than a component, so any element can
 * opt in without changing the markup around it.
 *
 * One shared observer for the whole page: a per-element observer is the usual
 * way this is written and it costs an observer per heading on a page with
 * hundreds of them. Elements unobserve themselves once seen — a reveal that
 * replays on the way back up reads as a glitch, not an effect.
 */
const seen = new WeakSet<Element>();

let observer: IntersectionObserver | null = null;

function ensure(root: Element | null) {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target);
        entry.target.classList.add("is-in");
        observer?.unobserve(entry.target);
      }
    },
    // The stage is transformed inside a fixed wrapper, so the viewport is the
    // right root; the bottom margin starts the reveal just before the element
    // is actually on screen, which hides the transition's first frames.
    { root: root ?? null, rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
  );
  return observer;
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (binding.value) el.style.setProperty("--d", `${binding.value}ms`);
    ensure(null).observe(el);
  },
  unmounted(el) {
    observer?.unobserve(el);
  },
};

/** Splits a string into words that can each carry their own delay. */
export function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
