/**
 * Sampling points along an SVG path, without asking the DOM for each one.
 *
 * `SVGPathElement.getPointAtLength` walks the path from its start on every
 * call, so sampling N points from a path of M segments costs N×M. The mark this
 * site flies the reader through is one path of 133 segments, and taking the
 * three thousand points the corridor is built from cost **4.9 seconds** of
 * blocked main thread — measured, not estimated. That was the whole of the
 * pause between pressing the link to the second page and the page arriving.
 *
 * So the curve maths happens here instead: flatten once into a polyline, keep
 * a cumulative length table beside it, and every sample after that is a binary
 * search and a lerp. Same points, microseconds rather than seconds.
 *
 * Only the commands the artwork actually uses are handled — M, L, H, V, C and
 * Z, in both cases. Anything else (arcs, or the smooth S/T forms, whose
 * control points depend on the preceding command) returns null rather than a
 * wrong answer, and the caller falls back to the DOM. A silently mis-flattened
 * path would be much worse than a slow one.
 */

export type Point = { x: number; y: number };

/** A measured path: its length, and the point at any distance along it. */
export type Sampler = {
  length: number;
  at(distance: number): Point;
};

/** Commands this flattener is prepared to be correct about. */
const SUPPORTED = /^[MmLlHhVvCcZz]$/;

/**
 * Numbers as SVG writes them: exponents, leading dots, and minus signs used as
 * separators (`10-5` is two numbers, not one).
 */
const NUMBER = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g;

/**
 * How finely a cubic is chopped.
 *
 * Proportional to the control polygon, so a long sweep gets more segments than
 * a short kink instead of every curve getting the same treatment. The bounds
 * keep a hairline curve from costing nothing and a huge one from costing too
 * much; at the mark's scale this lands around thirty steps per curve, which is
 * well under the spacing between the dots that will be placed on it.
 */
const stepsFor = (hull: number) => Math.min(48, Math.max(4, Math.ceil(hull / 6)));

/** Tokenise a path into [command, ...numbers] groups, honouring implicit repeats. */
const tokenize = (d: string): Array<{ cmd: string; args: number[] }> | null => {
  const out: Array<{ cmd: string; args: number[] }> = [];
  // Split before each command letter; each chunk is one letter and its numbers.
  const chunks = d.match(/[a-zA-Z][^a-zA-Z]*/g);
  if (!chunks) return null;

  for (const chunk of chunks) {
    const cmd = chunk[0];
    if (!SUPPORTED.test(cmd)) return null;
    const args = (chunk.slice(1).match(NUMBER) ?? []).map(Number);
    if (args.some((n) => !Number.isFinite(n))) return null;

    // A command may carry several sets of arguments, which repeat it — except
    // that a repeated `M` is an `L`, per the spec.
    const arity = cmd === "H" || cmd === "h" || cmd === "V" || cmd === "v" ? 1
      : cmd === "C" || cmd === "c" ? 6
      : cmd === "Z" || cmd === "z" ? 0
      : 2;

    if (arity === 0) { out.push({ cmd, args: [] }); continue; }
    if (args.length === 0 || args.length % arity !== 0) return null;

    for (let i = 0; i < args.length; i += arity) {
      const slice = args.slice(i, i + arity);
      const repeated = i > 0 && (cmd === "M" || cmd === "m");
      out.push({ cmd: repeated ? (cmd === "M" ? "L" : "l") : cmd, args: slice });
    }
  }
  return out;
};

/** Flatten a path into a polyline, or null if it uses something unsupported. */
const flatten = (d: string): Point[] | null => {
  const parsed = tokenize(d);
  if (!parsed || !parsed.length) return null;

  const pts: Point[] = [];
  let x = 0; let y = 0;        // current point
  let sx = 0; let sy = 0;      // start of the current subpath
  const push = (px: number, py: number) => {
    const last = pts[pts.length - 1];
    // Duplicate points contribute nothing and would put zero-length spans in
    // the length table, which the search below would have to special-case.
    if (!last || last.x !== px || last.y !== py) pts.push({ x: px, y: py });
  };

  for (const { cmd, args } of parsed) {
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        x = rel ? x + args[0] : args[0];
        y = rel ? y + args[1] : args[1];
        sx = x; sy = y;
        push(x, y);
        break;
      }
      case "L": {
        x = rel ? x + args[0] : args[0];
        y = rel ? y + args[1] : args[1];
        push(x, y);
        break;
      }
      case "H": { x = rel ? x + args[0] : args[0]; push(x, y); break; }
      case "V": { y = rel ? y + args[0] : args[0]; push(x, y); break; }
      case "C": {
        const x1 = rel ? x + args[0] : args[0];
        const y1 = rel ? y + args[1] : args[1];
        const x2 = rel ? x + args[2] : args[2];
        const y2 = rel ? y + args[3] : args[3];
        const ex = rel ? x + args[4] : args[4];
        const ey = rel ? y + args[5] : args[5];

        const hull = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(ex - x2, ey - y2);
        const steps = stepsFor(hull);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const u = 1 - t;
          // Bernstein form, which is the same arithmetic de Casteljau ends up
          // doing and rather less of it.
          const a = u * u * u;
          const b = 3 * u * u * t;
          const c = 3 * u * t * t;
          const e = t * t * t;
          push(a * x + b * x1 + c * x2 + e * ex, a * y + b * y1 + c * y2 + e * ey);
        }
        x = ex; y = ey;
        break;
      }
      case "Z": { x = sx; y = sy; push(x, y); break; }
      default: return null;
    }
  }
  return pts.length > 1 ? pts : null;
};

/** Measure a flattened polyline so it can be sampled by distance. */
const fromPolyline = (pts: Point[]): Sampler => {
  // cumulative[i] is the distance along the line at pts[i].
  const cumulative = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) {
    cumulative[i] = cumulative[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  const length = cumulative[cumulative.length - 1];

  return {
    length,
    at(distance: number): Point {
      if (!(length > 0)) return { x: pts[0].x, y: pts[0].y };
      const target = Math.min(Math.max(distance, 0), length);

      // Binary search for the span the distance falls in.
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] <= target) lo = mid; else hi = mid;
      }

      const span = cumulative[hi] - cumulative[lo];
      const t = span > 0 ? (target - cumulative[lo]) / span : 0;
      return {
        x: pts[lo].x + (pts[hi].x - pts[lo].x) * t,
        y: pts[lo].y + (pts[hi].y - pts[lo].y) * t,
      };
    },
  };
};

/**
 * Measure a path's `d`, or return null if it is not one this can be trusted
 * with — in which case ask the DOM, slowly and correctly.
 */
export const measurePath = (d: string | null | undefined): Sampler | null => {
  if (!d) return null;
  const pts = flatten(d);
  return pts ? fromPolyline(pts) : null;
};

/** The DOM's own answer, for paths the flattener declines. */
export const measureElement = (path: SVGPathElement): Sampler => ({
  length: path.getTotalLength(),
  at: (distance: number) => {
    const p = path.getPointAtLength(distance);
    return { x: p.x, y: p.y };
  },
});
