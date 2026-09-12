/**
 * Splitting a string so its parts can be animated independently.
 *
 * Two rules this follows that a naive splitter breaks:
 *
 * 1. Words are never split across a line. Characters are wrapped inside a word
 *    wrapper, so the browser still wraps at word boundaries and a per-character
 *    stagger cannot leave one letter stranded on its own line.
 * 2. The fragments are hidden from assistive technology and the readable string
 *    is put back on the parent. A screen reader meeting one element per letter
 *    announces the word letter by letter, which is worse than no animation.
 */

export type SplitMode = "lines" | "words" | "chars";

export interface SplitResult {
  /** The elements to stagger, in reading order. */
  parts: HTMLElement[];
  /** Puts the original text back and drops the wrappers. */
  revert: () => void;
}

const mask = (child: HTMLElement): HTMLElement => {
  // A clipping wrapper per part, so a part can slide in from below its own
  // box rather than fading. The mask is what makes the reveal feel typeset
  // instead of animated.
  const box = document.createElement("span");
  box.setAttribute("aria-hidden", "true");
  box.style.display = "inline-block";
  box.style.overflow = "hidden";
  box.style.verticalAlign = "top";
  // A clip box is exactly the line box tall, and at the tight line-heights the
  // display sizes use that is shorter than the font's own descent — so the
  // tails of g, y and p were being cut off. Extending the clip downward and
  // pulling the same amount back out of the layout gives them room without
  // moving anything.
  box.style.paddingBottom = "0.18em";
  box.style.marginBottom = "-0.18em";
  box.appendChild(child);
  return box;
};

const part = (text: string): HTMLElement => {
  const el = document.createElement("span");
  el.style.display = "inline-block";
  el.style.willChange = "transform, opacity";
  el.textContent = text;
  return el;
};

export function splitText(el: HTMLElement, mode: SplitMode = "chars"): SplitResult {
  const original = el.innerHTML;
  const source = (el.textContent ?? "").replace(/\s+/g, " ").trim();

  // The accessible name moves to the parent before the visual text is shredded.
  if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", source);

  const parts: HTMLElement[] = [];
  const frag = document.createDocumentFragment();

  if (mode === "lines") {
    // Lines are author-declared: a `<br>`-free string has no lines the DOM can
    // see until it is laid out, and measuring that is fragile at fluid sizes.
    // Callers pass one element per line instead, so this branch just wraps.
    const inner = part(source);
    parts.push(inner);
    frag.appendChild(mask(inner));
  } else {
    const words = source.split(" ");
    words.forEach((word, w) => {
      const wordEl = document.createElement("span");
      wordEl.setAttribute("aria-hidden", "true");
      wordEl.style.display = "inline-block";
      wordEl.style.whiteSpace = "nowrap";

      if (mode === "words") {
        const inner = part(word);
        parts.push(inner);
        wordEl.appendChild(mask(inner));
      } else {
        for (const ch of [...word]) {
          const inner = part(ch);
          parts.push(inner);
          wordEl.appendChild(mask(inner));
        }
      }

      frag.appendChild(wordEl);
      // A real space between words, outside the animated parts, so the line
      // still breaks and copies correctly.
      if (w < words.length - 1) frag.appendChild(document.createTextNode(" "));
    });
  }

  el.textContent = "";
  el.appendChild(frag);

  return {
    parts,
    revert: () => { el.innerHTML = original; el.removeAttribute("aria-label"); },
  };
}
