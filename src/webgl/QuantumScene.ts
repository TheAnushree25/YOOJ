import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, PerspectiveCamera,
  Points, Scene, ShaderMaterial, WebGLRenderer,
} from "three";
import {
  fieldFragment, fieldVertex, markFragment, markVertex,
  strandFragment, strandVertex,
} from "./shaders/quantum.glsl";

/**
 * The mark, in depth.
 *
 * The outline is sampled from the artwork itself rather than retyped as curves
 * in here, so replacing the SVG on disk replaces what the reader flies through
 * and nothing in this file has to change. Sampling is by arc length, using the
 * browser's own parameterisation: spacing by curve parameter instead bunches
 * the dots on tight corners and strings them out on slack ones, and the eye
 * reads that immediately.
 *
 * The same sample is then instanced down the corridor. What the reference shows
 * as contours nested inside a head is one outline repeated in z — which is the
 * only reading that explains why its inner lines never cross the outer one.
 */

export interface QuantumOptions {
  /** The artwork to fly through. Outlines are stroked, fills are seeded. */
  src: string;
  /** Dots laid along the outline, per copy. */
  traced?: number;
  /** Loose motes filling the corridor. */
  motes?: number;
  /** How many copies of the mark are in the corridor at once. */
  shells?: number;
  ink?: string;
  accent?: string;
  pale?: string;
  warm?: string;
  dark?: string;
  /** The lit floor the low discs borrow their colour from. */
  glow?: string;
}

/** How deep the corridor is, in world units. Everything wraps inside it. */
const TUNNEL = 27;
/** Where the mark is meant to be read. Sized so one copy fills the frame here. */
const FOCUS = 9;
/** How far the reader travels over the section. About three copies' worth. */
const REACH = 13.5;

export class QuantumScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(50, 1, 0.1, TUNNEL + 6);
  private clock = new Clock();
  private frame = 0;
  private running = false;

  private field: ShaderMaterial;
  private mark: ShaderMaterial;
  private dust: Points | null = null;
  private glyph: Points | null = null;
  private strands: Points | null = null;
  private canopy: ShaderMaterial;

  private progress = 0;
  private shown = 0;
  private gather = 0;
  private burst = 1;

  private canvas: HTMLCanvasElement;
  private options: QuantumOptions;

  constructor(canvas: HTMLCanvasElement, options: QuantumOptions) {
    this.canvas = canvas;
    this.options = options;
    const {
      ink = "#FFF5F6", accent = "#FEB3B8",
      pale = "#D8E4F2", warm = "#C9BC9E", dark = "#3C010E", glow = "#FED9DC",
    } = options;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearAlpha(0);

    const corridor = () => ({
      uTravel: { value: 0 },
      uTunnel: { value: TUNNEL },
      uFocus: { value: FOCUS },
      uPixel: { value: 1 },
      uTime: { value: 0 },
    });

    this.field = new ShaderMaterial({
      vertexShader: fieldVertex,
      fragmentShader: fieldFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Normal blending, deliberately. These are matte discs that occlude one
      // another; added together they stop being particles and become fog.
      uniforms: {
        ...corridor(),
        // Pixels at the focal plane. A speck is a pixel or two there and the
        // rare near disc swells to forty on its way past the lens.
        uSize: { value: 3.2 },
        uPale: { value: new Color(pale) },
        uWarm: { value: new Color(warm) },
        uDark: { value: new Color(dark) },
        uGlow: { value: new Color(glow) },
        uBurst: { value: 1 },
        uFlow: { value: 0 },
        uStreak: { value: 0 },
      },
    });

    this.mark = new ShaderMaterial({
      vertexShader: markVertex,
      fragmentShader: markFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // The mark is light rather than matter, and it is the one thing here that
      // should gain where its own copies overlap — that accumulation down the
      // corridor is what gives the nest its glow.
      blending: AdditiveBlending,
      uniforms: {
        ...corridor(),
        uGather: { value: 0 },
        uSpacing: { value: TUNNEL / (options.shells ?? 6) },
        // Pixels at the focal plane, where the mark is meant to be read as a
        // drawn line — so a dot on it is about three.
        uSize: { value: 2.4 },
        uInk: { value: new Color(ink) },
        uAccent: { value: new Color(accent) },
      },
    });

    this.canopy = new ShaderMaterial({
      vertexShader: strandVertex,
      fragmentShader: strandFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Light on a ground that is going white, so it adds rather than covers.
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDrop: { value: 0 },
        uPixel: { value: 1 },
        uFocus: { value: FOCUS },
        // Pixels at the focal plane. A bead is a small bright dot with a halo
        // around it, so it needs real size — at two pixels the whole canopy
        // renders correctly and cannot be seen.
        uBead: { value: 9.0 },
        uInk: { value: new Color("#EAF8FF") },
      },
    });

    this.sowStrands();
    this.sowField();
    void this.sowMark();
    this.resize();
  }

  setProgress(value: number) {
    this.progress = Math.min(1, Math.max(0, value));
  }

  /* ------------------------------------------------------------- the dust */

  private sowField() {
    const want = this.options.motes ?? 9000;
    const position = new Float32Array(want * 3);
    const seed = new Float32Array(want);

    /**
     * Wide enough that the corners stay filled at the far end of the corridor,
     * and weighted toward the floor.
     *
     * Even in y, and the height here is the span the shader wraps the rise
     * through — the two numbers have to agree or points jump.
     *
     * The floor gradient the reference has is not seeded. It used to be, and a
     * weighted scatter is the obvious way to get it, but the rise wraps: within
     * a minute any bias in where the points started has been shuffled away.
     * Size and strength carry it instead, keyed off where a point is in the
     * frame right now, which is the only version of it that survives.
     */
    for (let i = 0; i < want; i++) {
      position[i * 3] = (Math.random() - 0.5) * 26;
      position[i * 3 + 1] = (Math.random() - 0.5) * 21;
      position[i * 3 + 2] = -Math.random() * TUNNEL;
      seed[i] = Math.random();
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
    this.dust = new Points(geometry, this.field);
    this.scene.add(this.dust);
  }

  /**
   * The canopy: strands of beads hung from above the frame.
   *
   * Every bead carries only which strand it is on and how far along — the curve
   * itself is closed form in the shader, so nothing is integrated and the whole
   * fall scrubs backwards as readily as forwards. A simulation would not.
   */
  private sowStrands(count = 36, beads = 120) {
    const strand = new Float32Array(count * beads);
    const along = new Float32Array(count * beads);
    const seed = new Float32Array(count * beads);
    const position = new Float32Array(count * beads * 3);

    for (let sIdx = 0; sIdx < count; sIdx++) {
      for (let b = 0; b < beads; b++) {
        const i = sIdx * beads + b;
        strand[i] = sIdx / count;
        // Squared, so beads bunch near the crown and string out toward the tip.
        along[i] = Math.pow(b / (beads - 1), 0.82);
        seed[i] = Math.random();
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("aStrand", new BufferAttribute(strand, 1));
    geometry.setAttribute("aAlong", new BufferAttribute(along, 1));
    geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));

    this.strands = new Points(geometry, this.canopy);
    // Nothing to cull against: the shader parks unpaid beads off screen.
    this.strands.frustumCulled = false;
    this.scene.add(this.strands);
  }

  /* ------------------------------------------------------------- the mark */

  /**
   * Reads the artwork and walks it.
   *
   * Strokes are sampled along their length and fills are sampled across their
   * area, because that is what each one is: an outline is a line of dots and a
   * disc is a disc of them. Treating a filled circle as its own circumference
   * would have left two rings where the artwork has two solid marks.
   */
  private async sowMark() {
    const text = await fetch(this.options.src).then((r) => r.text());
    const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
    const source = parsed.documentElement;

    const view = (source.getAttribute("viewBox") ?? "0 0 2800 2800")
      .split(/[\s,]+/).map(Number);
    const [, , vw] = view;

    // Measuring needs the nodes in a rendered document; a detached tree returns
    // zero for every length.
    const stage = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    stage.setAttribute("width", "0");
    stage.setAttribute("height", "0");
    stage.style.position = "absolute";
    stage.style.visibility = "hidden";
    document.body.appendChild(stage);
    for (const node of Array.from(source.children)) {
      stage.appendChild(document.importNode(node, true));
    }

    const want = this.options.traced ?? 2600;
    const shells = this.options.shells ?? 6;

    /**
     * How much of the frame one copy fills where it is meant to be read.
     *
     * Well under the frame's own height on purpose. At the focal distance the
     * reader has to be able to see the whole mark at once — that is the moment
     * the shape is legible, and every other moment in the section is a pass
     * through a copy too close to read. Sized to fill the frame, there is no
     * such moment and the corridor is just handsome pipework.
     */
    const FRAME = 8.6;

    // Sampled in viewbox units first, then centred on what was actually drawn.
    const raw: { x: number; y: number; arc: number; accent: boolean }[] = [];

    const paths = Array.from(stage.querySelectorAll("path"));
    const lengths = paths.map((p) => p.getTotalLength());
    const total = lengths.reduce((a, b) => a + b, 0) || 1;
    let walked = 0;

    paths.forEach((path, i) => {
      // Dots in proportion to each run's length, so the measure stays constant
      // across the whole drawing rather than per path.
      const count = Math.max(2, Math.round((lengths[i] / total) * want));
      for (let n = 0; n < count; n++) {
        const at = path.getPointAtLength((n / count) * lengths[i]);
        raw.push({
          x: at.x, y: at.y, accent: false,
          arc: (walked + (n / count) * lengths[i]) / total,
        });
      }
      walked += lengths[i];
    });

    /**
     * Filled shapes are sampled across their area, and densely.
     *
     * A disc thinly sampled is not a dot, it is a spray — and against an
     * outline it reads as debris rather than as part of the drawing. These are
     * two solid marks in the artwork, so they have to arrive as two solid
     * marks: enough points to close the surface, each one smaller than an
     * outline dot rather than larger.
     */
    for (const circle of Array.from(stage.querySelectorAll("circle"))) {
      const cx = Number(circle.getAttribute("cx") ?? 0);
      const cy = Number(circle.getAttribute("cy") ?? 0);
      const r = Number(circle.getAttribute("r") ?? 0);
      const n = Math.round(want * 0.17);
      for (let k = 0; k < n; k++) {
        // Square-rooted radius, or every point crowds the centre.
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        raw.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, arc: 0, accent: true });
      }
    }

    stage.remove();

    // What was actually drawn, which is what gets centred and scaled.
    let minX = Infinity; let maxX = -Infinity;
    let minY = Infinity; let maxY = -Infinity;
    for (const r of raw) {
      if (r.x < minX) minX = r.x;
      if (r.x > maxX) maxX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.y > maxY) maxY = r.y;
    }
    const span = Math.max(maxX - minX, maxY - minY) || vw;
    const unit = FRAME / span;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const per = raw.length;
    const count = per * shells;
    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const arc = new Float32Array(count);
    const accent = new Float32Array(count);
    const shell = new Float32Array(count);

    for (let s = 0; s < shells; s++) {
      for (let n = 0; n < per; n++) {
        const i = s * per + n;
        const spot = raw[n];
        position[i * 3] = (spot.x - midX) * unit;
        // Y up.
        position[i * 3 + 1] = (midY - spot.y) * unit;
        // Depth is carried by the shell index in the shader, so one geometry
        // serves every copy and the spacing stays a uniform we can tune.
        position[i * 3 + 2] = 0;
        seed[i] = Math.random();
        arc[i] = spot.arc;
        accent[i] = spot.accent ? 1 : 0;
        shell[i] = s;
      }
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("aSeed", new BufferAttribute(seed, 1));
    geometry.setAttribute("aArc", new BufferAttribute(arc, 1));
    geometry.setAttribute("aAccent", new BufferAttribute(accent, 1));
    geometry.setAttribute("aShell", new BufferAttribute(shell, 1));

    this.glyph = new Points(geometry, this.mark);
    this.scene.add(this.glyph);
  }

  /* -------------------------------------------------------------- running */

  resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    for (const material of [this.field, this.mark, this.canopy]) {
      material.uniforms.uPixel.value = ratio;
    }
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.tick();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private tick = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);

    /**
     * Catch up to the scroll, at a rate measured in seconds rather than frames.
     *
     * The obvious form of this is `shown += (progress - shown) * 0.08`, and it
     * is wrong in both directions: on a 144Hz display it converges two and a
     * half times too fast, and on anything struggling it crawls — the travel
     * lags the scrollbar by whole seconds exactly when the machine can least
     * afford to look broken. Exponential smoothing against elapsed time gives
     * the same feel at 60Hz and the same feel everywhere else.
     */
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.shown += (this.progress - this.shown) * (1 - Math.exp(-5 * dt));
    const p = this.shown;
    const t = this.clock.elapsedTime;

    const ease = (v: number) => {
      const c = Math.min(1, Math.max(0, v));
      return c * c * (3 - 2 * c);
    };

    /**
     * The tail of the dispersal, then the mark.
     *
     * The section opens on the explosion still finishing — the field wide and
     * settling — and only once it has come to rest do the points gather onto
     * the outline. Gathering from the first frame overwrote the burst with the
     * mark and the two sections stopped being one continuous thing.
     */
    this.burst = 1 - ease(p / 0.13);
    // Assembled early, held for most of the section, and let go before the
    // light comes up — what the reader rises out of at the end should be open
    // sky, not a diagram still hanging in it.
    this.gather = ease((p - 0.08) / 0.14) * (1 - ease((p - 0.79) / 0.1));

    /**
     * How far in we have come.
     *
     * Scroll is most of it, and a slow constant drift underneath keeps the
     * corridor alive while the reader is still — a frame that freezes the
     * moment scrolling stops reads as a still image with text over it, which is
     * the opposite of being inside something.
     */
    const travel = p * REACH + t * 0.055;

    for (const material of [this.field, this.mark]) {
      material.uniforms.uTime.value = t;
      material.uniforms.uTravel.value = travel;
    }

    /**
     * The field's own travel, which never stops.
     *
     * Scroll moves the mark; this moves the dust past it. Held on the reader's
     * clock alone, the field freezes the moment they stop to read one of six
     * statements — and they are meant to stop at all six, for a while each.
     */
    this.field.uniforms.uFlow.value = t * 0.85;
    this.mark.uniforms.uGather.value = this.gather;
    this.field.uniforms.uBurst.value = this.burst;

    /**
     * The field draws out into falling light for the last stretch.
     *
     * It is the same particles the whole way — the discs stretch rather than
     * being replaced — so the change of character happens to the field the
     * reader has been watching instead of arriving as a new one.
     */
    this.field.uniforms.uStreak.value = ease((p - 0.74) / 0.14);

    // The canopy comes down to meet the light coming up.
    this.canopy.uniforms.uTime.value = t;
    this.canopy.uniforms.uDrop.value = ease((p - 0.895) / 0.1);

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.stop();
    this.dust?.geometry.dispose();
    this.glyph?.geometry.dispose();
    this.strands?.geometry.dispose();
    this.field.dispose();
    this.mark.dispose();
    this.canopy.dispose();
    this.renderer.dispose();
  }
}
