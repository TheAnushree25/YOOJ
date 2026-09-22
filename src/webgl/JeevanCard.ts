import {
  ACESFilmicToneMapping, CanvasTexture, Color, DirectionalLight, ExtrudeGeometry, Group,
  Mesh, MeshBasicMaterial, MeshPhysicalMaterial, PMREMGenerator, PerspectiveCamera,
  PlaneGeometry, Scene, Shape, ShapeGeometry, SRGBColorSpace, TextureLoader, Timer,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * The JeevanBhar card, as an object rather than a picture of one.
 *
 * A slab of wine metal with the card's artwork on its face, lit by a studio
 * environment so the face carries real reflections: as the card turns, soft
 * light slides across the brushed finish and along the polished edge, which is
 * what makes a render read as a thing in the hand. It arrives the way the
 * triangle two sections up does - out of focus above the heading, turning
 * over itself on the way down - and lands beside the copy at a three-quarter
 * angle, where it floats, answers the pointer, and throws a soft shadow onto
 * the page.
 *
 * The page supplies two numbers (the fall, and the read after landing) and a
 * rectangle - the slot the card lands in, measured off the DOM - so the
 * layout decides where the card rests on every breakpoint and this file only
 * decides how it gets there.
 */

/** The artwork's own proportions, 1463 x 776, and its corner: 80 of 776. */
const ASPECT = 1463 / 776;
const CARD_H = 1;
const CARD_W = CARD_H * ASPECT;
const RADIUS = 80 / 776;
/** A metal card is thicker than plastic; a touch more again reads as weight. */
const DEPTH = 0.024;

const CAM_Z = 10;
const FOV = 26;

interface Pose {
  at: number;
  /** Offset from the slot's centre, in slot widths (x) and slot heights (y). */
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
  /** Defocus, in CSS pixels. Only the entrance uses it. */
  blur: number;
}

/**
 * The fall, as poses.
 *
 * Starts well above the slot - above the section's own top edge, so it comes
 * into the room rather than appearing in it - pitched back almost edge-on and
 * turned in its own plane. It straightens as it drops, its face coming round
 * to the reader and the light with it, overshoots its size by a hair, and
 * settles at a three-quarter angle. The last pose is repeated so the landing
 * holds before the section moves on, the same device the triangle uses.
 */
const FALL: Pose[] = [
  { at: 0.00, x: 0.62, y: 2.9, rx: 1.18, ry: -0.62, rz: 1.45, s: 0.8, blur: 16 },
  { at: 0.26, x: 0.46, y: 1.8, rx: 0.86, ry: -0.42, rz: 0.92, s: 0.86, blur: 7 },
  { at: 0.52, x: 0.2, y: 0.78, rx: 0.42, ry: 0.02, rz: 0.36, s: 0.95, blur: 0 },
  { at: 0.78, x: 0.02, y: 0.1, rx: 0.06, ry: 0.4, rz: -0.07, s: 1.025, blur: 0 },
  { at: 0.92, x: 0, y: 0, rx: -0.1, ry: 0.3, rz: -0.045, s: 1, blur: 0 },
  { at: 1.0, x: 0, y: 0, rx: -0.1, ry: 0.3, rz: -0.045, s: 1, blur: 0 },
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Catmull-Rom, so the path curves through the poses rather than kinking. */
const spline = (a: number, b: number, c: number, d: number, t: number) => {
  const t2 = t * t;
  return 0.5 * ((2 * b) + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t2 * t);
};

const pose = (p: number): Omit<Pose, "at"> => {
  let i = 0;
  while (i < FALL.length - 2 && p > FALL[i + 1].at) i++;
  const a = FALL[i];
  const b = FALL[i + 1];
  const t = clamp01((p - a.at) / Math.max(1e-6, b.at - a.at));
  const k = (key: keyof Omit<Pose, "at">, curved: boolean) => {
    if (!curved) return a[key] + (b[key] - a[key]) * smooth(t);
    const at = (j: number) => FALL[Math.min(FALL.length - 1, Math.max(0, j))][key];
    return spline(at(i - 1), at(i), at(i + 1), at(i + 2), t);
  };
  return {
    x: k("x", true), y: k("y", true), s: k("s", true),
    rx: k("rx", false), ry: k("ry", false), rz: k("rz", false), blur: k("blur", false),
  };
};

/** A rounded rectangle centred on the origin. */
const slab = (w: number, h: number, r: number) => {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

/** A face cut to the card's outline, with its UVs spread across the artwork. */
const face = (w: number, h: number, r: number) => {
  const g = new ShapeGeometry(slab(w, h, r), 24);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) - box.min.x) / (box.max.x - box.min.x), (pos.getY(i) - box.min.y) / (box.max.y - box.min.y));
  }
  uv.needsUpdate = true;
  return g;
};

/**
 * The shadow the card throws on the page: a soft blot, drawn once. Radial and
 * wide, so it reads as light blocked by something held above the surface
 * rather than as an outline.
 */
const shadowTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(60, 1, 14, 0.55)");
  grad.addColorStop(0.45, "rgba(60, 1, 14, 0.28)");
  grad.addColorStop(1, "rgba(60, 1, 14, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
};

/**
 * How many device pixels to draw. The canvas covers a large share of a tall
 * section, so the budget is pixels rather than a ratio - the same reasoning as
 * the Aleph page's scenes, where a tablet was the device that missed frames.
 */
const drawRatio = (w: number, h: number) => {
  const dpr = window.devicePixelRatio || 1;
  const budget = window.matchMedia("(pointer: coarse)").matches ? 1_300_000 : 2_600_000;
  return Math.max(1, Math.min(dpr, 2, Math.sqrt(budget / Math.max(1, w * h))));
};

export class JeevanCard {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 0.1, 60);
  private timer = new Timer();
  private card = new Group();
  private shadow: Mesh;
  private shadowMat: MeshBasicMaterial;
  private faceMat: MeshPhysicalMaterial;
  private canvas: HTMLCanvasElement;

  /** Where the scroll has the fall and the read, and where they are drawn from. */
  private fall = 0;
  private fallShown = 0;
  private read = 0;
  private readShown = 0;

  /** The pointer, -0.5 to 0.5 on each axis, and the tilt easing toward it. */
  private px = 0;
  private py = 0;
  private tx = 0;
  private ty = 0;

  /** The slot, in the canvas's CSS pixels. */
  private slot = { x: 0, y: 0, w: 1, h: 1 };
  private cssW = 1;
  private cssH = 1;

  private raf = 0;
  private running = false;
  private ready = false;
  private blurShown = -1;

  constructor(canvas: HTMLCanvasElement, cardUrl: string, onReady?: () => void) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    this.renderer.setClearAlpha(0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera.position.set(0, 0, CAM_Z);

    // A studio to reflect: soft boxes and a floor, prefiltered once. This is
    // what puts moving light on the face and the edge as the card turns.
    const pmrem = new PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.035).texture;
    room.dispose();
    pmrem.dispose();

    // A key from the upper left, the ground's rose from behind on the right.
    const key = new DirectionalLight(0xfff4f0, 1.4);
    key.position.set(-3, 5, 6);
    this.scene.add(key);
    const rim = new DirectionalLight(0xfeb3b8, 1.1);
    rim.position.set(5, -2, -3);
    this.scene.add(rim);

    // The body: polished wine metal. Its edge is the only part of it seen from
    // the front, and it is what catches the light as the card turns through
    // profile on the way down.
    const edgeMat = new MeshPhysicalMaterial({
      color: new Color("#7A1731"), metalness: 1, roughness: 0.22, envMapIntensity: 1.25,
    });
    const body = new ExtrudeGeometry(slab(CARD_W, CARD_H, RADIUS), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: DEPTH * 0.35,
      bevelSize: DEPTH * 0.35,
      bevelSegments: 4,
      curveSegments: 24,
    });
    body.center();
    this.card.add(new Mesh(body, edgeMat));

    /**
     * The face: the artwork, under a clear coat.
     *
     * Emissive carries the artwork's own colours, so the card reads as the
     * design at any angle instead of going black as it turns from the key;
     * the diffuse term darkens it a little away from the light, which is what
     * keeps it an object. The coat is where the studio shows - a glossy layer
     * over the brushed metal, as a real metal card is finished.
     */
    this.faceMat = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.1,
      emissive: new Color(0xffffff),
      emissiveIntensity: 0.62,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      envMapIntensity: 0.55,
    });
    const lift = DEPTH / 2 + DEPTH * 0.35 + 0.0015;
    const front = new Mesh(face(CARD_W * 0.994, CARD_H * 0.989, RADIUS * 0.99), this.faceMat);
    front.position.z = lift;
    this.card.add(front);

    // The reverse is plain metal. The fall never turns it far enough to show,
    // but a card has two sides.
    const backMat = new MeshPhysicalMaterial({
      color: new Color("#3E0716"), metalness: 0.85, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.25,
    });
    const back = new Mesh(face(CARD_W * 0.994, CARD_H * 0.989, RADIUS * 0.99), backMat);
    back.position.z = -lift;
    back.rotation.y = Math.PI;
    this.card.add(back);

    // The shadow lies on the page behind the card and moves with it: soft and
    // faint while the card is high, gathering under it as it lands.
    this.shadowMat = new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0 });
    this.shadow = new Mesh(new PlaneGeometry(1, 1), this.shadowMat);
    this.shadow.renderOrder = -1;
    this.scene.add(this.shadow);
    this.scene.add(this.card);

    new TextureLoader().loadAsync(cardUrl).then((tex) => {
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.faceMat.map = tex;
      this.faceMat.emissiveMap = tex;
      this.faceMat.needsUpdate = true;
      this.ready = true;
      onReady?.();
    }).catch(() => { /* no artwork: the page keeps its still */ });

    this.resize();
  }

  /** The fall, 0 to 1: above the section to landed. */
  setFall(v: number) { this.fall = clamp01(v); }

  /** The read, 0 to 1: landed to scrolled past. A slow turn under the light. */
  setRead(v: number) { this.read = clamp01(v); }

  /** The pointer over the page, 0 to 1 on each axis. */
  setPointer(x: number, y: number) {
    this.px = x - 0.5;
    this.py = y - 0.5;
  }

  /** Where the card lands, in CSS pixels relative to the canvas. */
  setSlot(x: number, y: number, w: number, h: number) {
    this.slot = { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  }

  /** Straight to a state, with no easing: the first frame, or less motion. */
  settle(fall: number, read = 0) {
    this.fall = this.fallShown = clamp01(fall);
    this.read = this.readShown = clamp01(read);
    this.render(0);
  }

  get loaded() { return this.ready; }

  resize = () => {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.cssW = w;
    this.cssH = h;
    this.renderer.setPixelRatio(drawRatio(w, h));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.render(0);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.timer.reset();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.timer.update(t);
      this.render(Math.min(0.1, this.timer.getDelta()));
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** World units per CSS pixel at the plane the card rests on. */
  private get unit() {
    const viewH = 2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z;
    return viewH / this.cssH;
  }

  private render(dt: number) {
    // Eased toward the scroll in seconds, so the fall keeps its weight at any
    // refresh rate and a flick of the wheel never makes it jump.
    const k = dt > 0 ? 1 - Math.exp(-7 * dt) : 1;
    this.fallShown += (this.fall - this.fallShown) * k;
    this.readShown += (this.read - this.readShown) * k;
    this.tx += (this.px - this.tx) * (dt > 0 ? 1 - Math.exp(-4 * dt) : 1);
    this.ty += (this.py - this.ty) * (dt > 0 ? 1 - Math.exp(-4 * dt) : 1);

    // Nothing until the artwork is on it: a blank face would be a white card.
    this.card.visible = this.ready;
    this.shadow.visible = this.ready;

    const u = this.unit;
    const p = pose(this.fallShown);
    // Everything that only belongs to a landed card - the float, the pointer,
    // the turn under the light while the copy is read.
    const landed = smooth(clamp01((this.fallShown - 0.86) / 0.14));
    const t = this.timer.getElapsed();

    const scale = (this.slot.h * u) / CARD_H * p.s;
    const cx = (this.slot.x + p.x * this.slot.w - this.cssW / 2) * u;
    const cy = (this.cssH / 2 - (this.slot.y - p.y * this.slot.h)) * u;
    const bob = Math.sin(t * 1.15) * 0.012 * landed * scale;

    this.card.scale.setScalar(scale);
    this.card.position.set(cx, cy + bob, 0);
    this.card.rotation.set(
      p.rx + (this.ty * 0.22 + Math.sin(t * 0.9) * 0.012 + this.readShown * 0.05) * landed,
      p.ry + (this.tx * 0.34 - this.readShown * 0.24) * landed,
      p.rz + Math.sin(t * 0.7) * 0.007 * landed,
    );

    // The shadow: behind the card, offset down and to the right as the key
    // light throws it, tightening and darkening as the card comes down to it.
    const height = 1 - smooth(clamp01((this.fallShown - 0.45) / 0.5));
    const spread = 1.15 + height * 0.5;
    this.shadow.position.set(cx + 0.06 * scale, cy - (0.16 + height * 0.3) * scale, -0.9 * scale);
    this.shadow.scale.set(CARD_W * scale * spread * 1.08, CARD_H * scale * spread * 1.2, 1);
    this.shadowMat.opacity = smooth(clamp01((this.fallShown - 0.3) / 0.6)) * (0.85 - height * 0.4);

    // Out of focus at the top of the fall, as the triangle is. On the canvas
    // itself - it holds nothing but the card - and only while it is needed.
    const blur = Math.round(p.blur * 2) / 2;
    if (blur !== this.blurShown) {
      this.blurShown = blur;
      this.canvas.style.filter = blur > 0.25 ? `blur(${blur}px)` : "";
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as MeshPhysicalMaterial | MeshBasicMaterial | undefined;
      if (mat) {
        (mat as MeshPhysicalMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
