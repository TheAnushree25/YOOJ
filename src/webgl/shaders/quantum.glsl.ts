/**
 * The corridor.
 *
 * The reference reads as a head drawn once with smaller copies nested inside
 * it. It is not: it is one outline repeated down the z axis and seen in
 * perspective, and the reader is travelling into it. That is why the inner
 * contours never cross and never quite match the outer one — they are the same
 * curve, further away.
 *
 * So everything here is perspective, and everything wraps. Points live in a
 * corridor of fixed length and are carried toward the lens by `uTravel`; when
 * one passes the camera it reappears at the far end. The reader can scroll as
 * far as they like and is always inside the mark, with no state to run out and
 * no seam where a finite run of shells would have ended.
 */

/**
 * Shared by both point systems, so the field and the mark are carried by the
 * same motion — if these drifted apart the mark would swim against its own
 * dust, which is the one thing that would give the trick away.
 */
const TUNNEL = /* glsl */ `
  uniform float uTravel;
  uniform float uTunnel;
  /**
   * Where the mark is meant to be read, in world units.
   *
   * Sizes below are quoted in pixels at this distance, so uFocus over dist is
   * the entire perspective term. Quoting them in world units instead means
   * every size is a number nobody can picture and the only way to tune one is
   * to render it — which is how a two-pixel dot ends up a hundred and sixty.
   */
  uniform float uFocus;
  uniform float uPixel;

  /** Brings a point down the corridor and round again. */
  float corridor(float base) {
    return -uTunnel + mod(base + uTravel, uTunnel);
  }
`;

/* -------------------------------------------------------------- the field */

export const fieldVertex = /* glsl */ `
  precision highp float;

  attribute float aSeed;

  ${TUNNEL}

  uniform float uTime;
  uniform float uSize;
  /** The star itself. */
  uniform vec3  uInk;
  /** The ground's own pink, which a few of them carry faintly. */
  uniform vec3  uTint;
  /** The tail of the dispersal above, 1 on arrival and gone shortly after. */
  uniform float uBurst;
  /** The field's own travel down the corridor, independent of the reader. */
  uniform float uFlow;

  varying float vFade;
  varying float vBig;
  varying vec3  vColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float r1 = hash(vec2(aSeed, 1.0));
    float r2 = hash(vec2(aSeed, 2.0));
    float r3 = hash(vec2(aSeed, 3.0));
    float r4 = hash(vec2(aSeed, 4.0));

    /**
     * A sky, not a snowfall.
     *
     * The previous field was made of out-of-focus discs drifting up through
     * the frame, and at any density that filled the room it sat on the type
     * like a thumbprint. This one is the reference's: points, mostly, sharp to
     * the edge and very small, with a handful of large soft lights among them
     * — and it barely moves. A star that visibly travels is a snowflake. The
     * drift here is slow enough to be felt on a long hold and never seen
     * happening, and the wrap keeps the frame as full at the last statement as
     * at the first.
     */
    float span = 21.0;
    float rise = uTime * (0.02 + r1 * 0.03);
    float y = mod(position.y + rise + span * 0.5, span) - span * 0.5;

    vec3 p = vec3(
      position.x + sin(uTime * 0.05 + aSeed * 21.0) * 0.18,
      y + cos(uTime * 0.04 + aSeed * 17.0) * 0.14,
      corridor(position.z + uFlow)
    );

    // The dispersal above hands over while its particles are still travelling;
    // the sky arrives still expanding and comes to rest over the first eighth.
    p.xy *= 1.0 + uBurst * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    /**
     * The clearing.
     *
     * Every statement in this section is set in the middle of the frame, and
     * the field opens where the words are. Measured in screen space, not world
     * space: the type occupies a fixed part of the frame whatever the depth.
     */
    vec2 onScreen = mv.xy / max(dist * 0.4663, 0.001);
    float clear = smoothstep(0.5, 1.45, length(onScreen * vec2(0.58, 1.0)));

    /**
     * Two populations.
     *
     * One star in twenty-five is a light: a bright centre in a wide soft halo,
     * a dozen or so on screen at a time. Everything else is a point, one to
     * three pixels. The perspective term is held back — a point that swelled
     * as it neared the lens would be a mote again, and the whole reason this
     * is a sky is that its stars stay stars.
     */
    float big = step(0.962, r4);
    vBig = big;
    float size = mix(1.6 + r2 * 2.2, 7.0 + r2 * 6.0, big);
    gl_PointSize = max(
      size * uSize * uPixel * (1.0 + uBurst * 0.6) * mix(0.6, 1.0, clear) * uFocus / max(dist, 4.0),
      // However far away, a star is a point, and a point is a pixel and a
      // half — below that it is not a faint star, it is nothing.
      1.5 * uPixel * mix(0.7, 1.0, clear)
    );

    // Shallow and slow, per star, and never in step.
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.6 + r3 * 1.4) + aSeed * 60.0);

    // White, with one in six carrying the ground's pink, faintly.
    vColor = mix(uInk, uTint, step(0.83, r1) * 0.7);

    vFade = (0.55 + r3 * 0.45) * twinkle
      * mix(0.12, 1.0, clear)
      * smoothstep(0.0, uFocus * 0.2, dist)
      * (1.0 - smoothstep(uTunnel * 0.7, uTunnel * 0.99, dist));

    gl_Position = projectionMatrix * mv;
  }
`;

export const fieldFragment = /* glsl */ `
  precision highp float;

  varying float vFade;
  varying float vBig;
  varying vec3  vColor;

  void main() {
    vec2 q = (gl_PointCoord - 0.5) * 2.0;
    float d = length(q);
    if (d > 1.0) discard;

    // A point: crisp to the edge, with a pixel of anti-aliasing so a two-pixel
    // star is a dot and not a square.
    float crisp = 1.0 - smoothstep(0.62, 1.0, d);

    // A light: a bright centre in a wide, weak halo. The halo is what reads
    // as glow rather than as a bigger dot.
    float core = 1.0 - smoothstep(0.0, 0.34, d);
    float halo = pow(1.0 - d, 2.4) * 0.5;

    float a = mix(crisp, min(1.0, core + halo), vBig) * vFade;
    if (a < 0.004) discard;

    gl_FragColor = vec4(vColor, a);
  }
`;

/* --------------------------------------------------------------- the mark */

export const markVertex = /* glsl */ `
  precision highp float;

  attribute float aSeed;
  /** Position along the outline, 0 to 1. The spark runs on this. */
  attribute float aArc;
  /** 1 for a point taken from an accent shape rather than the outline. */
  attribute float aAccent;
  /** Which copy down the corridor this point belongs to. */
  attribute float aShell;

  ${TUNNEL}

  uniform float uTime;
  uniform float uGather;
  uniform float uSpacing;
  uniform float uSize;
  uniform vec3  uInk;
  uniform vec3  uAccent;

  varying float vFade;
  varying float vBlur;
  varying float vSpark;
  varying vec3  vColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float r1 = hash(vec2(aSeed, 1.0));
    float r3 = hash(vec2(aSeed, 3.0));

    /**
     * The copies are not turned against one another.
     *
     * A degree or so per copy was meant to keep the nest from reading as one
     * thick line seen through itself. It does the opposite: perspective already
     * separates the copies by size, and the rotation on top of that shears the
     * whole corridor into a spiral, so the contours stop being concentric and
     * the mark reads as leaning even though its centre is exactly on the axis.
     * Straight, they converge cleanly on the middle of the frame — which is the
     * only thing that makes the corridor read as a corridor.
     */
    vec2 spun = position.xy;

    /**
     * The gather.
     *
     * Every point begins scattered and is called onto the outline, staggered by
     * its own seed so the mark draws itself in rather than snapping whole. The
     * scatter is where the previous section left its dispersal, which is what
     * lets the shape appear out of the dust the reader is already looking at.
     */
    vec2 adrift = spun + vec2(
      (r1 - 0.5) * 13.0 + sin(uTime * 0.2 + aSeed * 7.0) * 0.12,
      (r3 - 0.5) * 10.5 + cos(uTime * 0.16 + aSeed * 4.0) * 0.1
    );
    float cue = smoothstep(r3 * 0.5, r3 * 0.5 + 0.5, uGather);
    vec2 xy = mix(adrift, spun, cue);

    vec3 p = vec3(xy, corridor(position.z + aShell * uSpacing));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    /**
     * The spark: a bright run travelling the outline.
     *
     * Done here rather than as its own object because the points are already
     * indexed along the path — distance from a moving head, wrapped, is the
     * whole of it. Two heads at different rates, so the mark never reads as one
     * thing on a loop.
     */
    float head1 = fract(uTime * 0.07 + aShell * 0.13);
    float head2 = fract(uTime * 0.031 + 0.5 + aShell * 0.07);
    float d1 = abs(fract(aArc - head1 + 0.5) - 0.5);
    float d2 = abs(fract(aArc - head2 + 0.5) - 0.5);
    vSpark = cue * (1.0 - aAccent)
      * smoothstep(0.0, uFocus * 0.9, dist)
      * (smoothstep(0.055, 0.0, d1) + smoothstep(0.032, 0.0, d2) * 0.8);

    /**
     * The ear tips beat.
     *
     * The mark is a stethoscope, and the two filled circles are the ends you
     * listen through — so the one flourish worth adding is the thing they are
     * for. A double thump on a long rest, not a sine: a heartbeat is two beats
     * and a wait, and anything evenly periodic reads as a blinking indicator.
     * Each copy is offset down the corridor so the nest is not one pulse seen
     * several times over.
     */
    float beat = fract(uTime * 0.62 + aShell * 0.21);
    float thump = exp(-beat * 14.0) + exp(-max(beat - 0.22, 0.0) * 16.0) * 0.55;
    float pulse = aAccent * thump;

    gl_PointSize = uSize * uPixel * (0.72 + r1 * 0.16 + aAccent * 4.2)
      * (1.0 + vSpark * 2.3 + pulse * 0.26) * uFocus / max(dist, 0.6);

    vBlur = 1.0 - smoothstep(0.0, uFocus, dist);
    vColor = mix(uInk, uAccent, aAccent);

    /**
     * The clearing, as the field has one.
     *
     * Widening the mark opens its middle, but it cannot on its own stop the
     * contour crossing the type: the corridor holds several copies at once and
     * they project at different sizes, so whatever the near one clears the far
     * one walks straight back through. The only test that holds at every depth
     * is a screen-space one — where a point lands in the frame, not where it
     * sits in the room.
     *
     * Dimmed rather than cut. A hole punched in the middle of the logo reads
     * as broken geometry; a contour that falls back as it passes behind the
     * words reads as the type being lit from in front, which is what it is.
     */
    vec2 onScreen = mv.xy / max(dist * 0.4663, 0.001);
    float clear = smoothstep(0.34, 1.02, length(onScreen * vec2(0.54, 1.0)));

    /**
     * Which copy the reader is actually looking at.
     *
     * The near one is always larger — perspective sees to that — so if it is
     * also as bright, it wins, and the mark is never whole on screen at any
     * point in the section. Raising the near falloff to a power puts the copy
     * at the focal distance clearly in front and lets the one passing the lens
     * go by as a suggestion, which is what reading a shape while travelling
     * through it actually looks like. It also hides the wrap for free: nothing
     * is at full strength when it vanishes.
     */
    /**
     * Accent points are stacked, so each one has to be faint.
     *
     * A filled disc is many overlapping points and this material is additive:
     * at the alpha that makes a single outline dot read, the middle of a disc
     * sums to several times white and the artwork's two pink marks arrive as
     * two blown-out holes. The disc wants the same total, spread thin.
     */
    vFade = cue * (0.3 + r1 * 0.32) * (1.0 - aAccent * 0.9) * (1.0 + pulse * 0.5)
      * mix(0.13, 1.0, clear)
      * pow(smoothstep(0.0, uFocus * 1.05, dist), 1.6)
      * (1.0 - smoothstep(uTunnel * 0.62, uTunnel * 0.96, dist));

    gl_Position = projectionMatrix * mv;
  }
`;

export const markFragment = /* glsl */ `
  precision highp float;

  varying float vFade;
  varying float vBlur;
  varying float vSpark;
  varying vec3  vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    float soft = mix(0.1, 0.85, vBlur);
    float a = smoothstep(1.0, 1.0 - soft, d) * vFade;

    // The spark carries a halo well outside its own disc, which is what reads
    // as light rather than as a bigger dot.
    vec3 col = vColor;
    if (vSpark > 0.001) {
      float halo = pow(1.0 - d, 2.0) * vSpark;
      a = min(1.0, a + halo * 0.9);
      col = mix(col, vec3(1.0), min(1.0, vSpark * 0.85));
    }

    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

/* -------------------------------------------------------------- the comets */

/**
 * Shooting stars, made of beads.
 *
 * The reference's trails are not drawn lines — they are runs of small dots
 * with a bright head, which is what a meteor looks like at the edge of vision
 * and what a stroked line at this weight does not. Each comet is a chain of
 * beads that all know which comet they belong to and how far back along it
 * they sit; the path is closed-form, so nothing is integrated and a comet can
 * be scrubbed backwards as readily as it plays forwards.
 *
 * Placed at the focal plane rather than in the corridor. They are a thing that
 * happens in the sky, not a thing the reader flies past, so the reader's own
 * travel leaves them alone.
 */
export const cometVertex = /* glsl */ `
  precision highp float;

  /** Which comet this bead belongs to, 0 to 1. */
  attribute float aTrail;
  /** How far back along the trail, 0 at the head and 1 at the end of the tail. */
  attribute float aAlong;

  uniform float uTime;
  uniform float uPixel;
  uniform float uFocus;
  uniform float uAspect;
  /** Pixels, for the head bead. */
  uniform float uBead;

  varying float vFade;
  varying float vHead;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float r1 = hash(vec2(aTrail, 1.0));
    float r2 = hash(vec2(aTrail, 2.0));
    float r3 = hash(vec2(aTrail, 3.0));
    float r4 = hash(vec2(aTrail, 4.0));
    float r5 = hash(vec2(aTrail, 5.0));
    float r6 = hash(vec2(aTrail, 6.0));

    // The frame at the focal plane, in world units: half its height, and its
    // half-width from that. Not named for what it is: half is a reserved
    // word in GLSL.
    float tall = uFocus * 0.4663;
    float wide = tall * uAspect;

    /**
     * One comet's life: a run across the sky for the first half of its cycle,
     * then a rest as long again. Every comet has its own period and its own
     * phase, so the sky is never a shooting gallery and never empty — with a
     * dozen of them, three or four are usually in flight.
     */
    float period = mix(9.0, 17.0, r4);
    float cycle = fract(uTime / period + r1);
    float on = smoothstep(0.0, 0.1, cycle) * (1.0 - smoothstep(0.4, 0.5, cycle));
    float run = cycle / 0.5;

    // Any heading, and a straight line through a point somewhere in the frame.
    float ang = r2 * 6.28318;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 anchor = vec2((r5 - 0.5) * 2.0 * wide, (r6 - 0.5) * 2.0 * tall);
    float travel = (tall + wide) * 1.1;
    float len = mix(0.3, 0.8, r3) * tall;

    vec2 head = anchor + dir * (run - 0.5) * travel;
    vec2 pos = head - dir * aAlong * len;

    // The same clearing the stars observe: a comet crossing the type dims.
    float clear = smoothstep(0.5, 1.45, length((pos / tall) * vec2(0.58, 1.0)));

    vec4 mv = modelViewMatrix * vec4(pos, -uFocus, 1.0);

    vHead = 1.0 - smoothstep(0.0, 0.08, aAlong);
    gl_PointSize = mix(5.0, 1.4, pow(aAlong, 0.7)) * uBead * uPixel;
    vFade = on * pow(1.0 - aAlong, 1.6) * 0.92 * mix(0.15, 1.0, clear);

    gl_Position = projectionMatrix * mv;
  }
`;

export const cometFragment = /* glsl */ `
  precision highp float;

  varying float vFade;
  varying float vHead;

  void main() {
    float d = length((gl_PointCoord - 0.5) * 2.0);
    if (d > 1.0) discard;

    float bead = 1.0 - smoothstep(0.55, 1.0, d);
    // The head carries a halo the tail does not.
    float halo = pow(1.0 - d, 2.0) * vHead * 0.8;

    float a = (bead + halo) * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vec3(1.0), a);
  }
`;
