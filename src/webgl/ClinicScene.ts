import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, Mesh,
  OrthographicCamera, PlaneGeometry, Points, Scene, ShaderMaterial, Texture,
  TextureLoader, Vector2, WebGLRenderer,
} from "three";
import { motesFragment, motesVertex, plateFragment, plateVertex } from "./shaders/clinic.glsl";

/**
 * The clinic scene: one building becoming another, and then coming apart.
 *
 * Two draws over one orthographic camera. The plate is the building, read out
 * of a photograph as a mask and filled with ink; the motes are a point cloud
 * seeded on that same mask, so the bloom can only happen where the building
 * actually is.
 *
 * Seeding is done once, on the CPU, by reading the source image into a canvas
 * and rejecting samples that land on the background. Doing it in a shader
 * would mean a texture fetch per point per frame to answer a question whose
 * answer never changes.
 */

export interface ClinicOptions {
  before: string;
  after: string;
  /** Where the bloom starts, in uv — 0,0 is bottom-left of the plate. */
  origin?: [number, number];
  /** How many motes to seed. Clamped against what the mask can carry. */
  motes?: number;
  ink?: string;
  glow?: string;
}

export class ClinicScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  private clock = new Clock();
  private frame = 0;
  private running = false;

  private plate: ShaderMaterial;
  private motes: ShaderMaterial;
  private cloud: Points | null = null;

  private progress = 0;
  private shown = 0;

  /** Plate aspect, so the light's falloff and the bloom's reach stay round. */
  private aspect = new Vector2(1, 1);

  // Declared rather than taken as constructor parameter properties: this
  // project builds with `erasableSyntaxOnly`, which rules out the shorthand
  // because it emits code rather than only erasing types.
  private canvas: HTMLCanvasElement;
  private options: ClinicOptions;

  constructor(canvas: HTMLCanvasElement, options: ClinicOptions) {
    this.canvas = canvas;
    this.options = options;
    const { ink = "#0C1330", glow = "#8FE3F5", origin = [0.42, 0.62] } = options;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearAlpha(0);

    this.plate = new ShaderMaterial({
      vertexShader: plateVertex,
      fragmentShader: plateFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uBefore: { value: null as Texture | null },
        uAfter: { value: null as Texture | null },
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uLight: { value: 0 },
        uSwap: { value: 0 },
        uLightAt: { value: new Vector2(origin[0], origin[1]) },
        uInk: { value: new Color(ink) },
        uGlow: { value: new Color(glow) },
        uAspect: { value: this.aspect },
      },
    });

    this.motes = new ShaderMaterial({
      vertexShader: motesVertex,
      fragmentShader: motesFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // The motes are light, so they add rather than cover. Over the near-black
      // plate that is the difference between a glowing tangle and grey dust.
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uGrow: { value: 0 },
        uOrigin: { value: new Vector2(origin[0] - 0.5, origin[1] - 0.5) },
        uSize: { value: 2.4 },
        uSpread: { value: 0.52 },
        uAspect: { value: this.aspect },
        uGlow: { value: new Color(glow) },
      },
    });

    this.scene.add(new Mesh(new PlaneGeometry(1, 1), this.plate));
    void this.load();
    this.resize();
  }

  /** Where the reader is in the section, 0 at its top and 1 at its end. */
  setProgress(value: number) {
    this.progress = Math.min(1, Math.max(0, value));
  }

  private async load() {
    const loader = new TextureLoader();
    const [before, after] = await Promise.all([
      loader.loadAsync(this.options.before),
      loader.loadAsync(this.options.after),
    ]);
    this.plate.uniforms.uBefore.value = before;
    this.plate.uniforms.uAfter.value = after;

    const image = before.image as HTMLImageElement;
    if (image?.width) {
      this.aspect.set(1, image.height / image.width);
      this.seed(image);
    }
  }

  /**
   * Scatters the motes across the building, rejecting the background.
   *
   * Rejection sampling rather than a grid: a grid inside an irregular mask
   * either leaves the shape's edges bare or needs a resolution high enough to
   * cost more than the throws do.
   */
  private seed(image: HTMLImageElement) {
    const want = this.options.motes ?? 9000;
    const w = 220;
    const h = Math.max(1, Math.round((image.height / image.width) * w));

    const pad = document.createElement("canvas");
    pad.width = w;
    pad.height = h;
    const ctx = pad.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const xs: number[] = [];
    const seeds: number[] = [];
    // A bounded number of throws, so an image that is mostly background can
    // never spin here: it simply yields fewer motes.
    for (let n = 0, throws = 0; n < want && throws < want * 24; throws++) {
      const px = (Math.random() * w) | 0;
      const py = (Math.random() * h) | 0;
      const i = (py * w + px) * 4;
      const lum = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
      const alpha = data[i + 3] / 255;
      if (alpha < 0.5 || lum > 0.86) continue;

      // Plate space: the quad is one unit wide, centred on the origin, and the
      // texture's v runs the other way from clip space.
      xs.push(px / w - 0.5, 0.5 - py / h, 0);
      seeds.push(Math.random());
      n++;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(xs), 3));
    geometry.setAttribute("aSeed", new BufferAttribute(new Float32Array(seeds), 1));

    this.cloud = new Points(geometry, this.motes);
    this.cloud.scale.set(1, this.aspect.y, 1);
    this.scene.add(this.cloud);
  }

  resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);

    // The plate keeps the image's own proportion and is fitted inside the
    // canvas, so the building is never stretched by the frame it sits in.
    const fit = Math.min(w / (h * (this.aspect.y || 1)), 1);
    const view = h / w;
    this.camera.left = -0.5 / fit;
    this.camera.right = 0.5 / fit;
    this.camera.top = (0.5 * view) / fit;
    this.camera.bottom = (-0.5 * view) / fit;
    this.camera.updateProjectionMatrix();

    this.motes.uniforms.uSize.value = 2.2 * this.renderer.getPixelRatio();
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

    // Eased here rather than at the call site, so however jittery the scroll
    // is the shaders only ever see a smooth value.
    this.shown += (this.progress - this.shown) * 0.08;
    const p = this.shown;
    const t = this.clock.getElapsedTime();

    const band = (from: number, to: number) => {
      const v = Math.min(1, Math.max(0, (p - from) / (to - from)));
      return v * v * (3 - 2 * v);
    };

    this.plate.uniforms.uTime.value = t;
    this.plate.uniforms.uProgress.value = p;
    // The light walks in, the building is replaced, and then it blooms —
    // three windows that overlap only at their shoulders.
    this.plate.uniforms.uLight.value = band(0.16, 0.44);
    this.plate.uniforms.uSwap.value = 1 - band(0.44, 0.66);

    this.motes.uniforms.uTime.value = t;
    this.motes.uniforms.uGrow.value = band(0.62, 1) * 1.45;

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.stop();
    this.plate.uniforms.uBefore.value?.dispose?.();
    this.plate.uniforms.uAfter.value?.dispose?.();
    this.cloud?.geometry.dispose();
    this.plate.dispose();
    this.motes.dispose();
    this.renderer.dispose();
  }
}
