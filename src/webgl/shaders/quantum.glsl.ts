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
  uniform vec3  uPale;
  uniform vec3  uWarm;
  uniform vec3  uDark;
  /** The lit floor the low discs borrow their colour from. */
  uniform vec3  uGlow;
  uniform float uSize;
  /** The tail of the dispersal above, 1 on arrival and gone shortly after. */
  uniform float uBurst;
  /** The field's own travel down the corridor, independent of the reader. */
  uniform float uFlow;
  /** How far the discs have drawn out into falling light. 0 to 1. */
  uniform float uStreak;

  varying float vFade;
  varying float vBlur;
  varying float vStreak;
  varying vec3  vColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float r1 = hash(vec2(aSeed, 1.0));
    float r2 = hash(vec2(aSeed, 2.0));
    float r4 = hash(vec2(aSeed, 4.0));

    /**
     * They rise, they wander, and they keep coming.
     *
     * Three motions, and the section needs all of them for its whole length —
     * ten viewports is a long time to hold a frame, and a field that settles
     * into a hover after the burst has finished turns the rest of it into a
     * still photograph with text passing over it.
     *
     * The rise and the wander are per-point, so the field never moves as a
     * sheet. The third is the important one: the points travel down the
     * corridor on their own clock, past the reader and round again, so there is
     * always something crossing the frame whether or not anyone is scrolling.
     * It is deliberately the field's own number and not the one that carries
     * the mark — tie them together and the mark rushes past a reader who has
     * stopped to read, which is the opposite of what a held frame is for.
     *
     * Two sine terms at unrelated rates rather than one, so the paths curl
     * instead of sliding along parallel tracks.
     */
    /**
     * The rise has to wrap, or the field empties.
     *
     * This was an unbounded drift: every point travelled upward for as long as
     * the page was open and none of them ever came back. Over a section ten
     * viewports long the reader spends minutes here, and by the end the frame
     * had quietly drained — the particles had not stopped moving, they had
     * left. Wrapped through the height of their own box they leave the top and
     * re-enter at the bottom, so the field is as full at the last statement as
     * at the first.
     *
     * The floor gradient is not carried by where they are seeded any more,
     * because a wrap evens that out within a minute whatever it starts as. It
     * is carried by size and strength instead, further down, which is a
     * property of where a point is now rather than of where it began.
     */
    float span = 21.0;
    float rise = uTime * (0.10 + r1 * 0.2);
    float y = mod(position.y + rise + span * 0.5, span) - span * 0.5;

    vec3 p = vec3(
      position.x
        + sin(uTime * 0.19 + aSeed * 8.0) * 0.26
        + sin(uTime * 0.07 + aSeed * 21.0) * 0.34,
      y
        + cos(uTime * 0.14 + aSeed * 5.0) * 0.2
        + cos(uTime * 0.05 + aSeed * 17.0) * 0.28,
      corridor(position.z + uFlow)
    );

    /**
     * The burst does not stop at the section boundary.
     *
     * The dispersal above throws the head outward and hands over while the
     * particles are still travelling. Opening this section on a field that is
     * already settled ends the explosion at the join — the reader watches it
     * begin and never sees it finish, which is exactly what reads as the effect
     * having been taken away. So the field arrives still expanding, wide and
     * thinning, and comes to rest over the first eighth of the section.
     *
     * Scaling outward from the centre rather than pushing along a fixed vector,
     * because that is what an expansion is: everything moves away from where it
     * came from, and further out means further travelled.
     */
    p.xy *= 1.0 + uBurst * 0.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    /**
     * How low in the frame this point sits, 0 at the top and 1 at the bottom.
     *
     * The half-height of the frame grows with distance, so a world height has
     * to be divided by it to mean anything on screen. Everything below keys off
     * this: the reference's field is not an even scatter, it is a drift that
     * gathers toward the floor, where the discs are bigger, paler and closer
     * together — which is what makes the lit ground read as the source of them.
     */
    float low = clamp(0.5 - p.y / max(dist * 0.933, 0.001), 0.0, 1.0);

    /**
     * The clearing.
     *
     * Every statement in this section is set in the middle of the frame, and a
     * field dense enough to be beautiful at the edges is dense enough to eat
     * white type at the centre. Rather than thinning the whole thing — which
     * costs the room its depth to fix a problem that only exists in one place —
     * the field opens where the words are.
     *
     * Measured in screen space, not world space: the type occupies a fixed part
     * of the frame whatever the depth, so a world-space test would clear a
     * cylinder that is far too wide up close and far too narrow at the back.
     * Squashed horizontally because a column of text is wider than it is tall.
     */
    vec2 onScreen = mv.xy / max(dist * 0.4663, 0.001);
    float clear = smoothstep(0.42, 1.25, length(onScreen * vec2(0.66, 1.0)));

    /**
     * Size grade.
     *
     * A fifth power made the big discs so rare that the field was effectively
     * one size — a sprinkle of specks — and no amount of extra count fixed it,
     * because every added point was another speck. The reference's field is
     * mostly mid-sized discs with a scattering of large ones, which is a much
     * shallower curve; perspective then does the rest, since a mid disc near
     * the lens is a large one on screen.
     */
    float grade = pow(r4, 3.4);
    gl_PointSize = uSize * uPixel
      * (0.26 + grade * 3.4) * (0.45 + low * 1.85) * (1.0 + uBurst * 0.85)
      // Smaller through the clearing, so what remains there reads as distant
      // rather than as the same field turned down.
      * mix(0.5, 1.0, clear)
      // A point sprite is square, so a trail four times its own length has
      // to be drawn inside a sprite four times the size.
      * (1.0 + uStreak * 3.6)
      * uFocus / max(dist, 0.6);

    // Near means out of focus. This is the whole depth cue and the reason the
    // field reads as a room rather than as a texture.
    vBlur = 1.0 - smoothstep(0.0, uFocus, dist);

    /**
     * Three inks, weighted the way the reference's field is: mostly pale, some
     * warm, a few almost black so the near discs read as objects in front of
     * the light rather than more of it.
     *
     * The dark ink is reserved for small points. Size and colour are drawn
     * independently, so a dark one is free to come up huge — and a huge dark
     * disc on a dark ground is not a particle in front of the light, it is a
     * smudge on the lens.
     */
    vec3 ink = r2 < 0.72 ? uPale : uWarm;
    if (r2 >= 0.9 && grade < 0.22) ink = uDark;
    // Low in the frame they take the colour of the floor they are lit by.
    vColor = mix(ink, uGlow, low * 0.4);
    // Not every disc draws out at once — a field that all stretches together
    // reads as one object being scaled rather than as rain starting.
    vStreak = uStreak * smoothstep(0.0, 0.55, uStreak * 1.5 - r2 * 0.7);

    /**
     * In from the far plane, and out again just before a point would cross the
     * lens and smear across the whole frame.
     *
     * These are out-of-focus lights, not haze. Held at the alpha that suits a
     * speck they were technically present and visually absent — a field you
     * could only find by looking for it. A disc has to be solid enough in the
     * middle to read as an object the light is coming from, and the ground
     * stays visible because the discs are sparse, not because each one is
     * nearly transparent.
     */
    vFade = (0.3 + r1 * 0.5) * (0.45 + low * 1.0)
      // And far fainter. Alpha does most of the work here: a disc that is
      // merely smaller still breaks a letterform it sits on, where one that
      // is barely there does not.
      * mix(0.22, 1.0, clear)
      * smoothstep(0.0, uFocus * 0.22, dist)
      * (1.0 - smoothstep(uTunnel * 0.68, uTunnel * 0.99, dist));

    gl_Position = projectionMatrix * mv;
  }
`;

export const fieldFragment = /* glsl */ `
  precision highp float;

  varying float vFade;
  varying float vBlur;
  varying float vStreak;
  varying vec3  vColor;

  void main() {
    /**
     * A disc, or a fall of light.
     *
     * Squeezing the coordinate horizontally before measuring the distance turns
     * the same round falloff into a vertical streak — the sprite stays square
     * and what is drawn inside it does not. Cheaper than a second system of
     * quads, and it means a disc can become a trail and go back again on one
     * number, rather than one set of particles having to hand over to another.
     */
    vec2 q = (gl_PointCoord - 0.5) * 2.0;
    q.x *= 1.0 + vStreak * 7.0;
    // The head of a trail is brighter than its tail.
    float head = mix(1.0, smoothstep(1.0, -0.2, q.y), vStreak);
    float d = length(q);
    if (d > 1.0) discard;

    // A flat disc whose edge softens as it nears the lens. One falloff for both
    // near and far is what makes a field like this read as fog instead of as
    // particles at different depths.
    float soft = mix(0.26, 0.92, vBlur);
    float a = smoothstep(1.0, 1.0 - soft, d) * vFade * head;
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

/* ------------------------------------------------------------- the strands */

/**
 * Beaded trails, falling and splaying.
 *
 * The light that ends the section does not simply rise: strands come down to
 * meet it, hanging from the top of the frame and curving outward as they
 * descend, the way a willow firework falls. Each is a chain of beads rather
 * than a drawn line — a stroked path at this scale reads as wire, and what is
 * wanted is something made of light.
 *
 * The curve is closed-form rather than simulated. A point knows which strand it
 * is on and how far along it sits, and that is enough: descent accelerates with
 * the square of the distance travelled and the outward splay with it, which is
 * exactly the shape a thrown spark makes under gravity. Nothing is integrated,
 * nothing is stored between frames, and the whole thing is scrubbable in both
 * directions — which a particle simulation is not.
 */
export const strandVertex = /* glsl */ `
  precision highp float;

  /** Which strand, 0 to 1 across the set. */
  attribute float aStrand;
  /** How far along it, 0 at the crown and 1 at the tip. */
  attribute float aAlong;
  attribute float aSeed;

  uniform float uTime;
  /** How far the strands have fallen, 0 to 1. */
  uniform float uDrop;
  uniform float uPixel;
  uniform float uFocus;
  uniform vec3  uInk;
  /** Bead size in pixels at the focal plane, before the taper. */
  uniform float uBead;

  varying float vFade;

  float hash(float p) { return fract(sin(p * 127.1) * 43758.5453); }

  void main() {
    float r1 = hash(aStrand + 1.3);
    float r2 = hash(aStrand + 7.7);
    float r3 = hash(aStrand + 19.1);

    /**
     * Where it hangs from, and which way it leans.
     *
     * Every number here is measured against the frame at the focal distance —
     * about 6.7 units to the side and 4.2 up. Sized generously instead, the
     * strands hung far above the top of the screen and fell far below it, and
     * the only part of each one both paid out and inside the frustum was a
     * sliver a few beads long: the canopy was being drawn correctly and was
     * almost entirely off screen.
     */
    float rootX = (r1 - 0.5) * 16.0;
    float lean = sign(rootX + 0.001) * (0.35 + r2 * 0.85);

    // Only the part of the strand that has been paid out is drawn. Staggered,
    // so they do not all reach for the floor on the same frame.
    float paid = clamp((uDrop * 1.45 - r3 * 0.45) * 1.3, 0.0, 1.0);
    float a = aAlong;
    if (a > paid) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

    // Falling, and accelerating as it falls: the crown sits just above the top
    // of the frame and the tips just below the bottom of it.
    float fall = a * (0.5 + a * 0.8) * 8.2;
    // And carried outward by the same travel, quadratically — which is what
    // turns a row of vertical threads into a canopy.
    float splay = lean * a * a * 6.4;
    // A slow sway, per strand, so the canopy breathes.
    float sway = sin(uTime * 0.5 + aStrand * 24.0 + a * 2.2) * (0.25 + a * 0.7);

    vec3 p = vec3(
      rootX + splay + sway,
      5.0 - fall,
      -7.5 - r2 * 4.0
    );

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.6);

    // Beads, not a line: bright and close-set near the crown, sparser and
    // smaller toward the tip, which is what gives a strand a direction.
    float grain = hash(aSeed * 31.7);
    float bead = 0.45 + grain * 0.9;
    // Tapering toward the tip, which is most of what reads as a strand
    // rather than as a column of identical dots.
    gl_PointSize = uBead * (1.0 - a * 0.34) * bead * uPixel * uFocus / dist;

    // Lit along the whole of what has been paid out, with a soft leading edge —
    // so the strand reads as still arriving without the length behind the head
    // being dark, which is what a narrow window here produces.
    float tip = smoothstep(paid, paid - 0.07, a);
    vFade = uDrop * tip * (0.5 + grain * 0.7) * (1.0 - a * 0.22);

    gl_Position = projectionMatrix * mv;
  }
`;

export const strandFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uInk;
  varying float vFade;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    // A hard little core inside a wide halo, which is what a bead of light is.
    float core = smoothstep(1.0, 0.45, d);
    float halo = pow(1.0 - d, 2.4);
    float a = (core * 0.75 + halo * 0.55) * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uInk, a);
  }
`;
