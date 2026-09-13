/**
 * Resolving a word out of noise, one character at a time.
 *
 * The reference settles certain words of its opening paragraph by cycling them
 * through junk glyphs before they land. It reads as a value being decoded
 * rather than as text being typed, and the difference is that every character
 * is occupied from the first frame — the line never reflows, because the
 * string is always its final length.
 *
 * That last point is the whole reason this exists rather than a typewriter:
 * a paragraph whose width changes while it resolves drags every line after it
 * around, and at five centred lines the movement is the only thing you see.
 */

/** Glyphs the noise is drawn from. Deliberately narrow — wide ones jitter. */
const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$?*";

export interface ScrambleOptions {
  /** How long one character spends unresolved, in milliseconds. */
  dwell?: number;
  /** Between one character settling and the next beginning. */
  stagger?: number;
  /** How fast the junk is re-rolled while a character is unresolved. */
  churn?: number;
}

/**
 * Runs the effect over one element and returns a handle that can stop it.
 *
 * The element's text is captured on the first call and restored exactly, so
 * calling this twice on the same node cannot leave noise behind.
 */
export function scramble(el: HTMLElement, options: ScrambleOptions = {}) {
  const { dwell = 420, stagger = 26, churn = 45 } = options;

  const target = el.dataset.scrambleSource ?? el.textContent ?? "";
  // Remembered on the node, so a second run resolves toward the real string
  // rather than toward whatever noise the first run happened to leave.
  el.dataset.scrambleSource = target;

  const chars = [...target];
  // Whitespace is never scrambled: a space that flickers into a glyph changes
  // where the browser is allowed to break the line.
  const settleAt = chars.map((c, i) => (/\s/.test(c) ? 0 : dwell + i * stagger));

  let raf = 0;
  let start = 0;
  let last = 0;
  let noise = chars.map(() => "");

  const roll = () =>
    chars.map((c) => (/\s/.test(c) ? c : NOISE[(Math.random() * NOISE.length) | 0]));

  const tick = (now: number) => {
    if (!start) start = now;
    const t = now - start;

    if (now - last >= churn) {
      noise = roll();
      last = now;
    }

    let done = true;
    el.textContent = chars
      .map((c, i) => {
        if (t >= settleAt[i]) return c;
        done = false;
        return noise[i];
      })
      .join("");

    if (done) {
      el.textContent = target;
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(raf);
      el.textContent = target;
    },
  };
}
