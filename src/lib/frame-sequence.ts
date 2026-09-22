/**
 * A film scrubbed by the scroll, played as a sequence of stills on a canvas.
 *
 * Not a <video> with its playhead moved. Seeking a video is asynchronous and
 * lands late: every scroll event queues a seek, the element shows whichever
 * one finished last, and a scrub backwards stalls while it decodes from the
 * previous keyframe. Safari is worse again. A sequence of stills is exact - the
 * frame for a scroll position is that frame, in either direction, at any rate.
 *
 * What makes it smooth is never waiting on a decode in the paint:
 *
 * - The compressed files are fetched once, coarse to fine (the first and last
 *   frames, then the middle, then the quarters...) so a scrub works across the
 *   whole film long before every frame has arrived, and simply gains detail.
 * - They are decoded with `createImageBitmap`, which happens off the main
 *   thread, into a small window around the playhead, leaning the way the
 *   reader is travelling. The window is a bounded cache; bitmaps leaving it are
 *   closed, because a decoded 1280px frame is three and a half megabytes and a
 *   whole film of them is most of a phone's memory.
 * - A paint uses the frame it wants if it is ready and the nearest one that is
 *   if it is not - never a blank, never a stall - and repaints when the right
 *   one lands.
 *
 * The playhead eases toward the scroll on a clock measured in seconds, so the
 * film keeps its weight at any frame rate and never jumps a gap when the
 * reader flicks.
 */

export interface SequenceOptions {
  /** The file for frame `i`. */
  url: (i: number) => string;
  count: number;
  /**
   * The point of the frame to keep in view when the canvas is a different
   * shape from the film and it has to be cropped, 0 to 1 on each axis.
   */
  focusX?: number;
  focusY?: number;
  /** How many decoded frames to hold at once. */
  cache?: number;
}

const FETCH_LANES = 6;

export class FrameSequence {
  private canvas: HTMLCanvasElement;
  private options: SequenceOptions;
  private ctx: CanvasRenderingContext2D;
  private readonly count: number;
  private readonly cacheSize: number;

  private blobs: Array<Blob | undefined>;
  private fetching = new Set<number>();
  private fetchOrder: number[];
  private lanes = 0;

  private bitmaps = new Map<number, ImageBitmap>();
  private decoding = new Set<number>();

  /** Where the scroll says the film is, in frames. */
  private target = 0;
  /** Where the film is being drawn from, easing toward the target. */
  private current = 0;
  /** The frame on the canvas now, so an unchanged paint can be skipped. */
  private painted = -1;
  private direction = 1;

  private raf = 0;
  private last = 0;
  private dead = false;
  private cssW = 0;
  private cssH = 0;

  constructor(canvas: HTMLCanvasElement, options: SequenceOptions) {
    this.canvas = canvas;
    this.options = options;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;
    this.count = options.count;
    this.cacheSize = options.cache ?? 36;
    this.blobs = new Array(this.count);
    this.fetchOrder = FrameSequence.coarseToFine(this.count);
    // An opaque canvas starts black. Paper, until it is measured.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.resize();
  }

  /**
   * Every index once, in an order that halves the gaps each pass: both ends,
   * the middle, the quarters, the eighths. Whatever has arrived at any moment
   * is spread evenly across the whole film.
   */
  private static coarseToFine(count: number) {
    const out: number[] = [];
    const seen = new Set<number>();
    const push = (i: number) => {
      if (i < 0 || i >= count || seen.has(i)) return;
      seen.add(i);
      out.push(i);
    };
    push(0);
    push(count - 1);
    for (let step = 2 ** Math.ceil(Math.log2(count)); step >= 1; step /= 2) {
      for (let i = 0; i < count; i += step) push(Math.round(i));
    }
    return out;
  }

  /* -------------------------------------------------------------- loading */

  private async fetchFrame(i: number) {
    if (this.blobs[i] || this.fetching.has(i) || this.dead) return;
    this.fetching.add(i);
    try {
      const res = await fetch(this.options.url(i));
      if (!res.ok) throw new Error(String(res.status));
      this.blobs[i] = await res.blob();
    } catch {
      /* a missing frame is skipped; its neighbours stand in for it */
    } finally {
      this.fetching.delete(i);
    }
    if (this.dead) return;
    // Arrived near where the reader is: worth decoding straight away.
    if (Math.abs(i - this.target) <= 8) this.warm();
  }

  /**
   * One frame, fetched, decoded and on the canvas - the one the page opens on.
   * Resolves when it is painted, or when it has failed, which is also an
   * answer: the gate waits on this.
   */
  async prime(index = 0) {
    this.target = this.current = index;
    await this.fetchFrame(index);
    await this.decode(index);
    this.paint(true);
  }

  /** Everything else, in the background, a few at a time. */
  loadAll() {
    const next = () => {
      if (this.dead) return;
      // Frames near the playhead jump the queue: a reader who scrolls before
      // the film has arrived is shown the part they are looking at first.
      const near = this.nearestMissing();
      const i = near ?? this.fetchOrder.find((n) => !this.blobs[n] && !this.fetching.has(n));
      if (i === undefined) return;
      this.lanes++;
      void this.fetchFrame(i).finally(() => {
        this.lanes--;
        next();
      });
    };
    while (this.lanes < FETCH_LANES) {
      const before = this.lanes;
      next();
      if (this.lanes === before) break;
    }
  }

  private nearestMissing() {
    const t = Math.round(this.target);
    for (let d = 0; d <= 6; d++) {
      for (const i of [t + d * this.direction, t - d * this.direction]) {
        if (i >= 0 && i < this.count && !this.blobs[i] && !this.fetching.has(i)) return i;
      }
    }
    return undefined;
  }

  /* ------------------------------------------------------------- decoding */

  private async decode(i: number) {
    if (this.bitmaps.has(i) || this.decoding.has(i) || this.dead) return;
    const blob = this.blobs[i];
    if (!blob) return;
    this.decoding.add(i);
    try {
      const bmp = await createImageBitmap(blob);
      if (this.dead) { bmp.close(); return; }
      this.bitmaps.set(i, bmp);
      this.evict();
      this.schedule();
    } catch {
      /* undecodable: the neighbours cover it */
    } finally {
      this.decoding.delete(i);
    }
  }

  /**
   * Decode the stretch the reader is heading into: a few frames behind, more
   * ahead, and nearest first so the one they will want next is ready first.
   */
  private warm() {
    const t = Math.round(this.current);
    const ahead = 14;
    const behind = 5;
    for (let d = 0; d <= ahead; d++) {
      const fwd = t + d * this.direction;
      if (fwd >= 0 && fwd < this.count) void this.decode(fwd);
      if (d <= behind) {
        const back = t - d * this.direction;
        if (back >= 0 && back < this.count) void this.decode(back);
      }
    }
  }

  /** Close the decoded frames furthest from the playhead, past the budget. */
  private evict() {
    if (this.bitmaps.size <= this.cacheSize) return;
    const t = this.current;
    const keys = [...this.bitmaps.keys()].sort((a, b) => Math.abs(b - t) - Math.abs(a - t));
    while (this.bitmaps.size > this.cacheSize && keys.length) {
      const k = keys.shift()!;
      // The frame on the canvas stays: it may be what the next paint falls
      // back to while its neighbours decode.
      if (k === this.painted) continue;
      this.bitmaps.get(k)?.close();
      this.bitmaps.delete(k);
    }
  }

  /* -------------------------------------------------------------- playing */

  /** Where the scroll has the film, 0 to 1. */
  setProgress(p: number) {
    const t = Math.min(1, Math.max(0, p)) * (this.count - 1);
    if (Math.abs(t - this.target) > 0.001) this.direction = t >= this.target ? 1 : -1;
    this.target = t;
    this.schedule();
  }

  /** Straight to a frame, with no easing - for a reader who asked for less motion. */
  jump(p: number) {
    this.setProgress(p);
    this.current = this.target;
    this.warm();
    this.paint(true);
  }

  private schedule() {
    if (this.raf || this.dead) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    // Seconds, not frames: the film settles in the same time at any refresh.
    this.current += (this.target - this.current) * (1 - Math.exp(-14 * dt));
    if (Math.abs(this.target - this.current) < 0.02) this.current = this.target;
    this.warm();
    this.paint();
    // Settled once the playhead has arrived. A frame still decoding does not
    // keep the loop spinning: its decode schedules the repaint when it lands.
    if (this.current !== this.target) this.raf = requestAnimationFrame(this.tick);
  };

  /** The nearest frame that is ready, to the one that is wanted. */
  private nearestReady(want: number) {
    if (this.bitmaps.has(want)) return want;
    for (let d = 1; d < this.count; d++) {
      if (this.bitmaps.has(want - d)) return want - d;
      if (this.bitmaps.has(want + d)) return want + d;
    }
    return -1;
  }

  private paint(force = false) {
    const want = Math.round(this.current);
    const i = this.nearestReady(want);
    if (i < 0 || (!force && i === this.painted)) return;
    const bmp = this.bitmaps.get(i)!;
    this.draw(bmp);
    this.painted = i;
  }

  /** Cover the canvas, cropping about the focus point. */
  private draw(bmp: ImageBitmap) {
    const { width: cw, height: ch } = this.canvas;
    if (!cw || !ch) return;
    const iw = bmp.width;
    const ih = bmp.height;
    const scale = Math.max(cw / iw, ch / ih);
    const sw = cw / scale;
    const sh = ch / scale;
    const fx = this.options.focusX ?? 0.5;
    const fy = this.options.focusY ?? 0.5;
    const sx = Math.min(iw - sw, Math.max(0, fx * iw - sw / 2));
    const sy = Math.min(ih - sh, Math.max(0, fy * ih - sh / 2));
    this.ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  /* ------------------------------------------------------------- lifecycle */

  resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    if (w === this.cssW && h === this.cssH) return;
    this.cssW = w;
    this.cssH = h;
    // The frames are 1280 across: past a ratio of one and a half the canvas
    // only holds more copies of the same pixels, at four times the fill.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(w * ratio);
    this.canvas.height = Math.round(h * ratio);
    // A resize clears the canvas - to black, on an opaque one - so it is laid
    // with paper before the frame goes back on, in case no frame has arrived.
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.fillStyle = "#FFFFFF";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.painted = -1;
    this.paint(true);
  };

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    for (const b of this.bitmaps.values()) b.close();
    this.bitmaps.clear();
    this.blobs = [];
  }
}
