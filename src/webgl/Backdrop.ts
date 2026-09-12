import {
  Clock, Color, Mesh, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, Vector2, WebGLRenderer,
} from "three";
import { fragment, vertex } from "./shaders/backdrop.glsl";

/**
 * The full-bleed field behind every section.
 *
 * A single full-screen triangle-ish quad under an orthographic camera: there is
 * no geometry to speak of, so the whole cost is the fragment shader and the
 * resolution it is asked to cover. That is why the pixel ratio is capped — the
 * field is out of focus by design, and rendering it at 3x on a phone buys
 * nothing but heat.
 */
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

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(Backdrop.token("--g-bg", "#000000"), 1);

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
        uColor1: { value: Backdrop.token("--g-color-1", "#3C010E") },
        uColor2: { value: Backdrop.token("--g-color-2", "#750227") },
        uColor3: { value: Backdrop.token("--g-color-3", "#750227") },
        uBg: { value: Backdrop.token("--g-bg", "#000000") },

        // The ShaderGradient controls, one uniform each.
        uAmplitude: { value: 1.0 },
        uDensity: { value: 1.3 },
        uFrequency: { value: 5.5 },
        uSpeed: { value: 0.4 },
        uStrength: { value: 4.0 },
        uBrightness: { value: 1.3 },
        uReflection: { value: 0.1 },
        // rotationZ, in radians.
        uRotation: { value: (50 * Math.PI) / 180 },
        // positionX / positionY.
        uOffset: { value: new Vector2(-1.4, 0) },
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.material.uniforms.uResolution.value.set(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
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
