import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { splitText, type SplitMode } from "./useSplitText";

gsap.registerPlugin(ScrollTrigger);

/**
 * The motion vocabulary, in one place.
 *
 * Every entrance on this site is the same gesture at different scales: rise and
 * fade, staggered in reading order, on a long decelerating curve. Naming the
 * numbers here rather than passing them at each call site is what keeps forty
 * animations feeling like one hand made them.
 */
export const MOTION = {
  /** How far a part travels on entry. Matched to the type size it sits under. */
  rise: 50,
  /** Long enough to read as deliberate, short enough not to gate the content. */
  duration: 1.15,
  /** Between siblings. Below ~40ms a stagger stops reading as one. */
  stagger: 0.055,
  /** Between a heading and the copy beneath it. */
  handoff: 0.12,
  ease: "expo.out",
  easeSoft: "power3.out",
} as const;

export const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface RevealOptions {
  mode?: SplitMode | "block";
  delay?: number;
  stagger?: number;
  rise?: number;
  /** Play on scroll rather than immediately. */
  scrub?: boolean;
  start?: string;
}

/**
 * Prepares an element's parts and returns the timeline that plays them.
 *
 * Split and set happen immediately; the play is deferred to the trigger. Doing
 * the split at trigger time is what causes the one-frame flash of unstyled
 * text that plagues scroll reveals.
 */
export function reveal(el: HTMLElement, options: RevealOptions = {}) {
  const {
    mode = "block",
    delay = 0,
    stagger = MOTION.stagger,
    rise = MOTION.rise,
    scrub = true,
    start = "top 85%",
  } = options;

  let parts: HTMLElement[] = [el];
  let revert: (() => void) | null = null;

  if (mode !== "block") {
    const split = splitText(el, mode);
    parts = split.parts;
    revert = split.revert;
  }

  if (prefersReduced()) {
    gsap.set(parts, { y: 0, opacity: 1 });
    return { play: () => {}, revert };
  }

  gsap.set(parts, { y: rise, opacity: 0 });

  const play = () =>
    gsap.to(parts, {
      y: 0,
      opacity: 1,
      duration: MOTION.duration,
      ease: MOTION.ease,
      stagger,
      delay,
      overwrite: "auto",
    });

  if (scrub) {
    ScrollTrigger.create({ trigger: el, start, once: true, onEnter: play });
  }

  return { play, revert };
}

/**
 * Ties a value to scroll position rather than to a clock.
 *
 * Deliberately does not pin. Pinning fixes the element, and a fixed element
 * reports an offset of zero — so on any refresh that happens while the pin is
 * already applied, the trigger re-measures its own start as the top of the
 * document and latches on arrival, sitting over the section above it. The
 * drawing reads the same scrubbed across the section's own travel, without a
 * mechanism that can strand the layout when a measurement lands early.
 */
export function scrubThrough(
  el: HTMLElement,
  onProgress: (p: number, active: boolean) => void,
  options: { start?: string; end?: string } = {},
) {
  if (prefersReduced()) {
    onProgress(1, true);
    return null;
  }
  return ScrollTrigger.create({
    trigger: el,
    start: options.start ?? "top 80%",
    end: options.end ?? "bottom 30%",
    scrub: 1,
    /**
     * `isActive` is passed through because progress alone cannot be trusted to
     * mean "the reader is here".
     *
     * Every trigger fires onUpdate on a refresh — on mount, when the fonts
     * land, on any resize — whichever part of the page is actually on screen.
     * A section off the bottom reports a clamped progress of zero and a section
     * already passed reports one, and both look exactly like being at the edge
     * of the section for real. For anything that only reads its own progress
     * that is harmless. For anything writing shared state it is not: four
     * sections set the page's dark flag, so on every refresh all four fired in
     * document order and the last one down the page won, which put the chrome
     * in night dress at the top of a page that is pale there.
     */
    onUpdate: (self) => onProgress(self.progress, self.isActive),
  });
}

/** Moves an element against the scroll to fake depth. */
export function parallax(el: HTMLElement, depth = 0.2) {
  if (prefersReduced()) return null;
  return gsap.fromTo(
    el,
    { yPercent: -depth * 50 },
    {
      yPercent: depth * 50,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    },
  );
}

export { ScrollTrigger, gsap };
