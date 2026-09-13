import {
  AmbientLight, BufferAttribute, BufferGeometry, Clock, Color, DirectionalLight,
  ExtrudeGeometry, Group, Mesh, MeshStandardMaterial,
  PerspectiveCamera, Points, Scene, Shape, ShapeGeometry, ShaderMaterial,
  SRGBColorSpace, Texture, TextureLoader, Vector2, WebGLRenderer,
} from "three";
import { motesFragment, motesVertex } from "./shaders/card.glsl";

/**
 * The card: turned, brought forward, and taken apart.
 *
 * Built as real geometry rather than played back as a frame sequence. The
 * renders supplied cover a quarter turn in nine steps, which is forty degrees
 * between frames over a full revolution — a flipbook of them would stutter at
 * any scroll speed, and mirroring the set to fill the other half would show the
 * front artwork on the back of the card. Modelled, the turn is continuous at
 * any rate, the approach is a camera move rather than a scale, the edge catches
 * light as it passes through profile, and the whole thing costs one texture
 * instead of seventeen megabytes of stills.
 *
 * The dispersal is the one from the section this replaces, unchanged.
 */

export interface CardOptions {
  front: string;
  back: string;
  motes?: number;
  /** The three inks the field settles into, matching what it hands over to. */
  pale?: string;
  warm?: string;
  dark?: string;
}

/** Height in world units. Everything else is derived from the artwork. */
const CARD_H = 2.45;
/** Measured off the supplied render: 997 x 1881. */
const CARD_ASPECT = 0.53;
const CARD_D = 0.055;
/** Where the card sits, and the depth sizes are quoted at. */
const REST_Z = 0;
const CAM_Z = 6;

export class CardScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(42, 1, 0.1, 40);
  private clock = new Clock();
  private frame = 0;
  private running = false;

  private card = new Group();
  private body: MeshStandardMaterial;
  private faceFront: MeshStandardMaterial;
  private faceBack: MeshStandardMaterial;
  private motes: ShaderMaterial;
  private cloud: Points | null = null;

  private progress = 0;
  private shown = 0;

  private canvas: HTMLCanvasElement;
  private options: CardOptions;

  constructor(canvas: HTMLCanvasElement, options: CardOptions) {
    this.canvas = canvas;
    this.options = options;
    const { pale = "#D8E4F2", warm = "#C9BC9E", dark = "#3C010E" } = options;

    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearAlpha(0);
    this.camera.position.z = CAM_Z;

    /**
     * Lights, for the body only.
     *
     * The faces carry their own lighting, baked into the render — but the slab
     * between them does not, and that edge is the whole reason a turn reads as
     * a turn. A key from above left and a cool rim from behind give it
     * something to catch as it passes through profile; without them the card
     * simply thins to nothing and reappears.
     */
    this.scene.add(new AmbientLight(0xffffff, 0.6));
    const key = new DirectionalLight(0xfff0f2, 2.1);
    key.position.set(-3, 4, 5);
    this.scene.add(key);
    const rim = new DirectionalLight(0xfeb3b8, 1.5);
    rim.position.set(4, -1, -3);
    this.scene.add(rim);

    this.body = new MeshStandardMaterial({
      color: new Color("#5E1026"),
      metalness: 0.92,
      roughness: 0.24,
    });

    // Standard rather than basic, so a face darkens as it turns away. With the
    // baked render as its map it keeps the art exactly, and still answers the
    // light — a face held at full brightness until the moment it vanishes is
    // the thing that makes a spin look like a sprite.
    const face = () => new MeshStandardMaterial({
      metalness: 0.42, roughness: 0.42, transparent: true,
    });
    this.faceFront = face();
    this.faceBack = face();

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
        uFocus: { value: CAM_Z },
        uSpread: { value: new Vector2(3, 3) },
        uPale: { value: new Color(pale) },
        uWarm: { value: new Color(warm) },
        uDark: { value: new Color(dark) },
      },
    });

    this.build();
    void this.dress();
    this.resize();
  }

  setProgress(value: number) {
    this.progress = Math.min(1, Math.max(0, value));
  }

  /* --------------------------------------------------------------- phases */

  private static ease(v: number) {
    const c = Math.min(1, Math.max(0, v));
    return c * c * (3 - 2 * c);
  }

  /**
   * The turn.
   *
   * Held face on for a moment first. Starting the revolution at the section's
   * own first frame means the card is already forty degrees round by the time
   * the reader has finished arriving, so the thing they are being shown is
   * never once square to them before it starts moving.
   *
   * Linear through the turn itself, deliberately — easing a constant rotation
   * makes it appear to stall at both ends of every revolution.
   */
  private get spin() {
    return Math.min(1, Math.max(0, (this.shown - 0.07) / 0.55));
  }

  /** The approach, once the turning is done. */
  private get near() {
    return CardScene.ease((this.shown - 0.56) / 0.16);
  }

  /**
   * How far the card has come apart.
   *
   * The same window the dispersal it replaces used, and for the same reason:
   * it begins before the room darkens, so the reader sees the subject let go
   * and then the frame turn around it.
   */
  get scatter() {
    return CardScene.ease((this.shown - 0.7) / 0.3);
  }

  /* --------------------------------------------------------------- the card */

  /** A rounded rectangle, in the artwork's own proportion. */
  private static slab(w: number, h: number, r: number) {
    const shape = new Shape();
    const x = -w / 2;
    const y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.quadraticCurveTo(x + w, y, x + w, y + r);
    shape.lineTo(x + w, y + h - r);
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shape.lineTo(x + r, y + h);
    shape.quadraticCurveTo(x, y + h, x, y + h - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    return shape;
  }

  /**
   * A face, cut to the card's own outline.
   *
   * Not a plane. A rectangle carrying this texture overhangs the slab at every
   * corner, and what shows in that overhang is the flat colour the render was
   * matted onto — four dark tabs on an otherwise clean card, which is exactly
   * the kind of detail that makes a rendered object read as a picture of one.
   *
   * ShapeGeometry lays its UVs out in the shape's own coordinates rather than
   * across the unit square, so they are remapped here against the bounding box.
   * Left alone the artwork arrives at some arbitrary scale and offset.
   */
  private static face(w: number, h: number, r: number) {
    const geometry = new ShapeGeometry(CardScene.slab(w, h, r), 14);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const spanX = box.max.x - box.min.x;
    const spanY = box.max.y - box.min.y;

    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(
        i,
        (pos.getX(i) - box.min.x) / spanX,
        (pos.getY(i) - box.min.y) / spanY,
      );
    }
    uv.needsUpdate = true;
    return geometry;
  }

  private build() {
    const w = CARD_H * CARD_ASPECT;
    const h = CARD_H;
    // Measured off the render rather than guessed: about seven per cent of the
    // card's width, which is a good deal tighter than a generic rounded box.
    const r = w * 0.075;

    const geometry = new ExtrudeGeometry(CardScene.slab(w, h, r), {
      depth: CARD_D,
      bevelEnabled: true,
      bevelThickness: CARD_D * 0.3,
      bevelSize: CARD_D * 0.3,
      bevelSegments: 3,
      curveSegments: 14,
    });
    geometry.center();
    this.card.add(new Mesh(geometry, this.body));

    // The artwork sits just proud of the slab, so the body reads as the card's
    // polished edge rather than as a frame around a picture. Inset a hair, so
    // the edge is the body's metal at every angle and never the texture's own
    // matted border.
    const lift = CARD_D / 2 + CARD_D * 0.3 + 0.001;
    const shape = CardScene.face(w * 0.988, h * 0.993, r * 0.988);

    const front = new Mesh(shape, this.faceFront);
    front.position.z = lift;
    this.card.add(front);

    const back = new Mesh(shape, this.faceBack);
    back.position.z = -lift;
    back.rotation.y = Math.PI;
    this.card.add(back);

    this.card.position.z = REST_Z;
    this.scene.add(this.card);
  }

  private async dress() {
    const loader = new TextureLoader();
    const [front, back] = await Promise.all([
      loader.loadAsync(this.options.front),
      loader.loadAsync(this.options.back),
    ]);
    for (const t of [front, back]) t.colorSpace = SRGBColorSpace;

    // The back plane is turned to face the other way, which mirrors whatever is
    // mapped to it. Flipping the texture back means the mark on the reverse
    // reads the right way round.
    back.wrapS = 1000;
    back.repeat.x = -1;
    back.offset.x = 1;

    this.faceFront.map = front;
    this.faceFront.needsUpdate = true;
    this.faceBack.map = back;
    this.faceBack.needsUpdate = true;

    this.sow(front);
  }

  /**
   * Seeds the dispersal from the card, carrying its colours.
   *
   * The subject is a filled rectangle, so there is no mask to key — every
   * sample lands on it. What the sampling is for is the colour: each point
   * keeps the pixel it came from, so the burst is the card in pieces rather
   * than a generic cloud where a card used to be.
   */
  private sow(texture: Texture) {
    const image = texture.image as HTMLImageElement;
    if (!image?.width) return;

    const want = this.options.motes ?? 17000;
    const w = 150;
    const h = Math.max(1, Math.round((w / CARD_ASPECT)));

    const pad = document.createElement("canvas");
    pad.width = w;
    pad.height = h;
    const ctx = pad.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const cardW = CARD_H * CARD_ASPECT;
    const xs: number[] = [];
    const seeds: number[] = [];
    const edges: number[] = [];
    const inks: number[] = [];

    // How near the border counts as the outline, in samples.
    const rim = 3;

    for (let n = 0; n < want; n++) {
      const px = (Math.random() * w) | 0;
      const py = (Math.random() * h) | 0;
      const i = (py * w + px) * 4;

      const onEdge = px < rim || py < rim || px >= w - rim || py >= h - rim;

      xs.push((px / w - 0.5) * cardW, (0.5 - py / h) * CARD_H, 0);
      seeds.push(Math.random());
      edges.push(onEdge ? 1 : 0);
      // Into linear-ish light, since the shader writes straight to the frame.
      inks.push(
        Math.pow(data[i] / 255, 2.2),
        Math.pow(data[i + 1] / 255, 2.2),
        Math.pow(data[i + 2] / 255, 2.2),
      );
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(xs), 3));
    geometry.setAttribute("aSeed", new BufferAttribute(new Float32Array(seeds), 1));
    geometry.setAttribute("aEdge", new BufferAttribute(new Float32Array(edges), 1));
    geometry.setAttribute("aInk", new BufferAttribute(new Float32Array(inks), 3));

    this.cloud = new Points(geometry, this.motes);
    this.scene.add(this.cloud);
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

    /**
     * Sized to the frame, not to a constant.
     *
     * The card is the subject of the section, so it should be as large as the
     * frame will take — which is a different number on every viewport, and
     * cannot be a fixed scale nudged by aspect ratio. Measure the frame at the
     * depth the card rests at and fill it: most of the height, unless the frame
     * is narrow enough that the card's width is what runs out first, which is
     * every phone held upright.
     *
     * The margin is real headroom, not timidity. The card tilts off-axis as it
     * turns, and a subject sized to exactly fill its frame clips its own
     * corners the moment it is anything but square on.
     */
    const view = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * (CAM_Z - REST_Z);
    const scale = Math.min(
      (view * 0.84) / CARD_H,
      (view * (w / h) * 0.86) / (CARD_H * CARD_ASPECT),
    );
    this.card.scale.setScalar(scale);

    // Half the frame, expressed in the card's own units — the burst is a child
    // of the card and inherits its scale, so the target has to be divided back
    // out or the throw grows every time the subject does.
    (this.motes.uniforms.uSpread.value as Vector2).set(
      (view * (w / h)) / 2 / scale,
      view / 2 / scale,
    );

    // The pieces are the card's pieces, so they carry its size with them. Left
    // fixed, a bigger card would throw the same specks over a wider area and
    // the burst would thin out as the subject grew.
    this.motes.uniforms.uSize.value = 2.0 * scale;
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

  private tick = () => {
    if (!this.running) return;
    this.frame = requestAnimationFrame(this.tick);

    // Catch up at a rate measured in seconds rather than frames, so the travel
    // feels the same at 60Hz, at 144Hz, and on a machine that is struggling.
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.shown += (this.progress - this.shown) * (1 - Math.exp(-5 * dt));
    const t = this.clock.elapsedTime;
    const scatter = this.scatter;

    /**
     * Two full turns, ending face on.
     *
     * Whole revolutions, so the card is square to the reader at the moment it
     * stops — the approach and the burst both read from the face, and arriving
     * at them mid-turn would mean the card lunges at the reader edge-first.
     */
    this.card.rotation.y = this.spin * Math.PI * 4;
    // A little off-axis, so it reads as an object being turned in the hand
    // rather than as a panel on a spindle.
    this.card.rotation.x = Math.sin(this.spin * Math.PI * 2) * 0.13;
    this.card.rotation.z = Math.sin(this.spin * Math.PI * 3) * 0.05;

    // Forward, into the reader. A camera move, so the perspective opens up as
    // it comes — which a scale cannot do.
    // Shortened as the card grew. The approach is measured from a subject that
    // now nearly fills the frame at rest, so the old distance carried it well
    // past the point where any of it is still on screen.
    this.card.position.z = REST_Z + this.near * 2.5;

    // And then it is gone, handed over to its own pieces.
    const solid = 1 - CardScene.ease((this.shown - 0.68) / 0.08);
    this.faceFront.opacity = solid;
    this.faceBack.opacity = solid;
    this.body.opacity = solid;
    this.body.transparent = solid < 1;
    this.card.visible = solid > 0.002;

    if (this.cloud) {
      // The pieces start where the card had got to, so the burst comes off the
      // object rather than out of the middle of the frame.
      this.cloud.position.z = this.card.position.z;
      this.cloud.scale.copy(this.card.scale);
    }

    this.motes.uniforms.uTime.value = t;
    this.motes.uniforms.uScatter.value = scatter;

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.stop();
    this.faceFront.map?.dispose();
    this.faceBack.map?.dispose();
    this.cloud?.geometry.dispose();
    for (const m of [this.body, this.faceFront, this.faceBack, this.motes]) m.dispose();
    this.renderer.dispose();
  }
}
