import {
  BufferAttribute, BufferGeometry, Clock, Color, Mesh,
  OrthographicCamera, PlaneGeometry, Points, Scene, ShaderMaterial, Texture,
  TextureLoader, Vector3, WebGLRenderer,
} from "three";
import { motesFragment, motesVertex, plateFragment, plateVertex } from "./shaders/mind.glsl";

/**
 * The head: four states, cross-faded, and then taken apart.
 *
 * The four plates are renders of one subject. Only the light added inside the
 * silhouette is mixed between them — the head itself is drawn once and never
 * fades, or the states read as photographs being swapped rather than as
 * something happening in one person's mind.
 *
 * What the scene adds is the one thing that cannot be a still: the dispersal.
 * The points seeded on the head are also the field they drift into; a separate
 * bokeh layer was two systems pretending to be one, and they never matched
 * because they were never the same particles.
 *
 * Seeding happens once on the CPU. Edge points are found by comparing each
 * sample's alpha against its neighbours — a cheap Sobel, run at low resolution
 * — because those are the points that read as the head's outline and have to
 * hold their shape longest when the rest lets go.
 */

export interface MindOptions {
  /** Plain silhouette, chaotic tangle, ordered wave, resolved grid. */
  plates: [string, string, string, string];
  motes?: number;
  /** The three inks the field is drawn in: pale, warm, and near-black. */
  pale?: string;
  warm?: string;
  dark?: string;
}

/**
 * Where each effect is at full strength, in section progress.
 *
 * Three, not four: the head is not one of them. It is drawn at full weight for
 * the section's whole length and these only say how much light is added inside
 * it, which is what keeps the subject from moving between states.
 */
const STOPS = [0.34, 0.58, 0.8] as const;

export class MindScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  private clock = new Clock();
  private frame = 0;
  private running = false;

  /**
   * The head's width as a fraction of the viewport's.
   *
   * The canvas covers the whole frame now, and the head is placed inside it by
   * the scene rather than by sizing a box in the page. That is what lets the
   * dispersal leave the head: boxed to its own element, the points could only
   * ever mill about inside the rectangle the portrait used to occupy, however
   * far the shader threw them.
   */
  private headWidth = 0.4;

  private plate: ShaderMaterial;
  private motes: ShaderMaterial;
  private cloud: Points | null = null;

  private progress = 0;
  private shown = 0;
  private aspect = 1;

  private canvas: HTMLCanvasElement;
  private options: MindOptions;

  constructor(canvas: HTMLCanvasElement, options: MindOptions) {
    this.canvas = canvas;
    this.options = options;
    const { pale = "#D8E4F2", warm = "#C9BC9E", dark = "#0B1330" } = options;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearAlpha(0);

    this.plate = new ShaderMaterial({
      vertexShader: plateVertex,
      fragmentShader: plateFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uBase: { value: null as Texture | null },
        uChaos: { value: null as Texture | null },
        uOrder: { value: null as Texture | null },
        uTwin: { value: null as Texture | null },
        uMix: { value: new Vector3(0, 0, 0) },
        uScatter: { value: 0 },
        uTime: { value: 0 },
      },
    });

    this.motes = new ShaderMaterial({
      vertexShader: motesVertex,
      fragmentShader: motesFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Normal blending, deliberately. These are matte discs that occlude one
      // another; added together they stop being particles and become fog.
      uniforms: {
        uTime: { value: 0 },
        uScatter: { value: 0 },
        uSize: { value: 2.0 },
        uPixel: { value: 1 },
        uPale: { value: new Color(pale) },
        uWarm: { value: new Color(warm) },
        uDark: { value: new Color(dark) },
      },
    });


    this.scene.add(new Mesh(new PlaneGeometry(1, 1), this.plate));
    void this.load();
    this.resize();
  }

  setProgress(value: number) {
    this.progress = Math.min(1, Math.max(0, value));
  }

  /**
   * How far the head has come apart.
   *
   * This begins before the room darkens, and the order matters: the burst has
   * to start against the pale ground it has been standing on all section, so
   * the reader sees the head let go and *then* the frame turn around it.
   * Darkening first made the change of ground the event and the dispersal an
   * afterthought inside it.
   */
  get scatter() {
    const v = Math.min(1, Math.max(0, (this.shown - 0.7) / 0.3));
    return v * v * (3 - 2 * v);
  }

  private async load() {
    const loader = new TextureLoader();
    const [base, chaos, order, twin] = await Promise.all(
      this.options.plates.map((src) => loader.loadAsync(src)),
    );
    this.plate.uniforms.uBase.value = base;
    this.plate.uniforms.uChaos.value = chaos;
    this.plate.uniforms.uOrder.value = order;
    this.plate.uniforms.uTwin.value = twin;

    const image = base.image as HTMLImageElement;
    if (image?.width) {
      this.aspect = image.height / image.width;
      this.resize();
      this.sowMotes(image);
    }
  }

  /**
   * Seeds the dispersal from the silhouette, marking its edge.
   *
   * The subject is keyed on alpha where the file has it and on luminance where
   * it does not, so a cut-out and a subject-on-white both work. The edge test
   * compares a sample's own mask against its four neighbours: a point with a
   * neighbour outside the shape is on the outline.
   */
  private sowMotes(image: HTMLImageElement) {
    const want = this.options.motes ?? 14000;
    const w = 240;
    const h = Math.max(1, Math.round(this.aspect * w));

    const pad = document.createElement("canvas");
    pad.width = w;
    pad.height = h;
    const ctx = pad.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    /**
     * Does this file actually carry transparency?
     *
     * It decides which key is right, and getting it wrong is silent. A cut-out
     * has transparent pixels whose RGB is 0,0,0 — black — so a luminance key
     * reads the entire background as subject and the mask passes every pixel
     * in the rectangle. Measured on this very image: the luminance key
     * accepted 100% of it where alpha correctly accepts 63%.
     */
    let clear = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 3) clear++;
    const cutOut = clear > (data.length / 4) * 0.02;

    const maskAt = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return 0;
      const i = (y * w + x) * 4;
      if (cutOut) return data[i + 3] / 255;
      // Subject on white: everything darker than the ground is the subject.
      const lum = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
      return 1 - Math.min(1, Math.max(0, (lum - 0.8) / 0.18));
    };

    const xs: number[] = [];
    const seeds: number[] = [];
    const edges: number[] = [];

    for (let n = 0, throws = 0; n < want && throws < want * 26; throws++) {
      const px = (Math.random() * w) | 0;
      const py = (Math.random() * h) | 0;
      const m = maskAt(px, py);
      if (m < 0.45) continue;

      const onEdge =
        maskAt(px - 1, py) < 0.45 || maskAt(px + 1, py) < 0.45 ||
        maskAt(px, py - 1) < 0.45 || maskAt(px, py + 1) < 0.45;

      // The interior is thinned hard. Left at full density it swamps the
      // outline, and the outline is the only part that still reads as a head
      // once the cloud has opened.
      if (!onEdge && Math.random() > 0.28) continue;

      xs.push(px / w - 0.5, (0.5 - py / h) * this.aspect, 0);
      // Local to the plate: -0.5..0.5 across, scaled into the frame by the
      // cloud's own transform so seeding never has to know the viewport.
      seeds.push(Math.random());
      edges.push(onEdge ? 1 : 0);
      n++;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(xs), 3));
    geometry.setAttribute("aSeed", new BufferAttribute(new Float32Array(seeds), 1));
    geometry.setAttribute("aEdge", new BufferAttribute(new Float32Array(edges), 1));

    this.cloud = new Points(geometry, this.motes);
    this.scene.add(this.cloud);
    this.resize();
  }


  resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h, false);

    // One world unit is the viewport's width. The camera never changes to suit
    // the subject — the subject is placed within a frame that is always the
    // whole screen, which is what gives the dispersal somewhere to go.
    const view = h / w;
    this.camera.left = -0.5;
    this.camera.right = 0.5;
    this.camera.top = 0.5 * view;
    this.camera.bottom = -0.5 * view;
    this.camera.updateProjectionMatrix();

    // Sized off the height, so a tall portrait stays whole in a wide frame and
    // does not overflow a short one.
    this.headWidth = Math.min(0.42, (view * 0.94) / this.aspect);

    const plane = this.scene.children[0] as Mesh;
    plane.scale.set(this.headWidth, this.headWidth * this.aspect, 1);
    plane.position.set(0, -view * 0.04, 0);

    if (this.cloud) {
      this.cloud.scale.set(this.headWidth, this.headWidth, 1);
      this.cloud.position.copy(plane.position);
    }

    this.motes.uniforms.uPixel.value = ratio;
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

  /**
   * How much of each effect is lit.
   *
   * A triangular window per stop, and deliberately not normalised: at the top
   * of the section every weight is zero, which is the plain head, and that is
   * the correct reading rather than a state to be divided away.
   */
  private weigh(p: number) {
    return STOPS.map((stop, i) => {
      const before = i === 0 ? stop - 0.26 : STOPS[i - 1];
      const after = i === STOPS.length - 1 ? stop + 0.24 : STOPS[i + 1];
      if (p <= before || p >= after) return 0;
      const v = p < stop ? (p - before) / (stop - before) : (after - p) / (after - stop);
      return v * v * (3 - 2 * v);
    });
  }

  private tick = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);

    this.shown += (this.progress - this.shown) * 0.08;
    const p = this.shown;
    const t = this.clock.getElapsedTime();
    const scatter = this.scatter;

    const [a, b, c] = this.weigh(p);
    (this.plate.uniforms.uMix.value as Vector3).set(a, b, c);
    this.plate.uniforms.uScatter.value = scatter;
    this.plate.uniforms.uTime.value = t;

    this.motes.uniforms.uTime.value = t;
    this.motes.uniforms.uScatter.value = scatter;

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.stop();
    for (const key of ["uBase", "uChaos", "uOrder", "uTwin"] as const) {
      (this.plate.uniforms[key].value as Texture | null)?.dispose?.();
    }
    this.cloud?.geometry.dispose();
    this.plate.dispose();
    this.motes.dispose();
    this.renderer.dispose();
  }
}
