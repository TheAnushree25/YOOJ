import {
  Clock, Color, Mesh, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from "three";
import { fragment, vertex } from "./shaders/backdrop.glsl";

/**
 * How a page asks for its own ground.
 *
 * One shader, two palettes. The front page is a deep wine field and the Aleph
 * page is a pale one, and the difference between them is entirely these
 * numbers — so they are arguments rather than two copies of a shader that
 * would drift apart the first time either was adjusted. `prefix` names the
 * token group the colours are read from, which keeps the palette in the
 * stylesheet where the rest of the page's colour lives.
 */
export interface FieldOptions {
  prefix?: string;
  amplitude?: number;
  density?: number;
  frequency?: number;
  speed?: number;
  strength?: number;
  brightness?: number;
  reflection?: number;
  /** Ambient floor: how dark the unlit side of a fold is allowed to go. */
  shade?: number;
  /** rotationZ, in degrees. */
  rotation?: number;
  /** positionX / positionY. */
  offset?: [number, number];
  /** color1, color2, color3, bg — used when a token is absent. */
  fallback?: [string, string, string, string];
  /** The four places the light goes, in uv with y up. The supplied stills. */
  poses?: [[number, number], [number, number], [number, number], [number, number]];
  /** Seconds from one pose to the next. */
  cadence?: number;
}

/**
 * The full-bleed field behind every section.
 *
 * A single full-screen triangle-ish quad under an orthographic camera: there is
 * no geometry to speak of, so the whole cost is the fragment shader and the
 * resolution it is asked to cover. That is why the pixel ratio is capped — the
 * field is out of focus by design, and rendering it at 3x on a phone buys
 * nothing but heat.
 */
/**
 * How many device pixels the field is actually drawn at.
 *
 * A phone reports a ratio of 3, so an uncapped canvas draws nine times the
 * pixels of its CSS box - and the Aleph page runs three of them at once. The
 * old cap of 2 still means four times, which a laptop absorbs and a handset
 * pays for in heat and battery within a minute. A particle field has no hard
 * edges to soften, so the difference between 1.6 and 2 is invisible here in a
 * way it would not be on type or a hairline.
 */
const drawRatio = () => {
  const dpr = window.devicePixelRatio || 1;
  if (!window.matchMedia("(pointer: coarse)").matches) return Math.min(dpr, 2);

  /**
   * A ratio cap on its own is the wrong instrument here. A tablet reports the
   * same ratio as a phone over three times the area, so capping both at 1.6
   * left the tablet drawing 2 megapixels per canvas - six across the Aleph
   * page's three - and it was the only device that missed frame after frame.
   * What costs is pixels, so pixels are what is budgeted; the ratio falls out
   * of the frame's own size. A phone is well under the budget and keeps its
   * full 1.6.
   */
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  return Math.max(1, Math.min(dpr, 1.6, Math.sqrt(1_200_000 / area)));
};

export class Backdrop {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: ShaderMaterial;
  private clock = new Clock();
  private frame = 0;
  private pointer = new Vector2(0.5, 0.5);
  private pointerTarget = new Vector2(0.5, 0.5);
  private progress = 0;
  private progressTarget = 0;
  private running = false;

  /**
   * The palette, read from the stylesheet rather than restated here.
   *
   * It was restated here, and the two drifted the moment the tokens changed:
   * the page went navy while the field behind every section kept painting the
   * green it was written with, and nothing in either file looked wrong on its
   * own. One source, read at construction.
   */
  private static token(name: string, fallback: string): Color {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return new Color(raw || fallback);
  }

  constructor(canvas: HTMLCanvasElement, field: FieldOptions = {}) {
    const {
      prefix = "--g",
      amplitude = 1.25, density = 1.3, frequency = 5.5,
      speed = 0.4, strength = 4.0, brightness = 1.3, reflection = 0.1, shade = 0.72,
      rotation = 50, offset = [-1.4, 0],
      fallback = ["#3C010E", "#750227", "#FEB3B8", "#3C010E"],
      // The dark stills: light upper right, right, lower right, and a fourth
      // a little in from the edge so the cycle has somewhere to breathe.
      poses = [[0.88, 0.9], [0.97, 0.53], [0.95, 0.1], [0.78, 0.55]],
      cadence = 3,
    } = field;
    const stop = (n: number) => Backdrop.token(`${prefix}-color-${n}`, fallback[n - 1]);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    // The per-program error checks three.js runs on first use are each a
    // synchronous round trip to the GPU process, and there are four per program
    // — measurable on every scene's first frame. They exist to surface a broken
    // shader while one is being written, which is a development concern; a
    // shipped page has nothing to learn from them and pays for them anyway.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.setClearColor(Backdrop.token(`${prefix}-bg`, fallback[3]), 1);

    this.material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
        uPointer: { value: this.pointer },
        // Three stops and a ground, read from the stylesheet so the field and
        // the page can never be given different palettes.
        uColor1: { value: stop(1) },
        uColor2: { value: stop(2) },
        uColor3: { value: stop(3) },
        uBg: { value: Backdrop.token(`${prefix}-bg`, fallback[3]) },

        // The ShaderGradient controls, one uniform each.
        uAmplitude: { value: amplitude },
        uDensity: { value: density },
        uFrequency: { value: frequency },
        uSpeed: { value: speed },
        uStrength: { value: strength },
        uBrightness: { value: brightness },
        uReflection: { value: reflection },
        uShade: { value: shade },
        // rotationZ, in radians.
        uRotation: { value: (rotation * Math.PI) / 180 },
        // positionX / positionY.
        uOffset: { value: new Vector2(offset[0], offset[1]) },
        uPoses: { value: poses.map(([x, y]) => new Vector2(x, y)) },
        uCadence: { value: cadence },
      },
    });

    this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
    this.resize();
  }

  /** Where the reader is in the page, 0 at the top and 1 at the footer. */
  setProgress(value: number) {
    this.progressTarget = Math.min(1, Math.max(0, value));
  }

  setPointer(x: number, y: number) {
    this.pointerTarget.set(x, y);
  }

  resize = () => {
    const { innerWidth: w, innerHeight: h } = window;
    // Two is already past the point where a blurred field shows any gain.
    this.renderer.setPixelRatio(drawRatio());
    this.renderer.setSize(w, h, false);
    this.material.uniforms.uResolution.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
  };

  start() {
    if (this.running) return;
    this.running = true;
    /**
     * Shaders first, and off the main thread.
     *
     * The first render compiles every program on the scene, and each status
     * query three.js makes afterwards blocks until the driver has finished —
     * several hundred milliseconds of the page not answering, measured.
     * compileAsync links them under KHR_parallel_shader_compile and resolves
     * once they are ready, so the first frame is only a frame. Without the
     * extension it compiles in place, which is no worse than before; and if
     * the scene is stopped before it resolves, nothing starts.
     */
    this.renderer.compileAsync(this.scene, this.camera)
      .catch(() => {})
      .then(() => {
        if (!this.running) return;
        this.clock.start();
        this.tick();
      });
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  private tick = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);

    // Both inputs are eased here rather than at the call site, so however
    // jittery the source is the shader only ever sees a smooth value.
    this.pointer.lerp(this.pointerTarget, 0.045);
    this.progress += (this.progressTarget - this.progress) * 0.06;

    this.material.uniforms.uTime.value = this.clock.getElapsedTime();
    this.material.uniforms.uProgress.value = this.progress;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.stop();
    this.material.dispose();
    this.renderer.dispose();
  }
}
