/**
 * The card coming apart.
 *
 * This is the dispersal from the section it replaces, unchanged in every way
 * that can be seen: matte discs, normal-blended so they occlude one another,
 * an outward fan over a wide spread of throws, edge points leaving last so the
 * outline holds, and a long float afterwards. The only thing that differs is
 * what is being taken apart, and one addition that the subject earns — each
 * point carries the colour of the pixel it was seeded from, so the card breaks
 * into its own reds and golds rather than into a palette chosen for it.
 *
 * Those colours then bleed toward the field's three inks as the throw plays
 * out, because what this hands over to is a corridor lit in pale grey, warm
 * beige and near-black. A burst that stayed card-red would arrive at that
 * boundary as a different set of particles.
 */

export const motesVertex = /* glsl */ `
  precision highp float;

  attribute float aSeed;
  /** 1 for a point taken from the card's border, 0 for its interior. */
  attribute float aEdge;
  /** The colour of the pixel this point was seeded from. */
  attribute vec3  aInk;

  uniform float uTime;
  uniform float uScatter;
  uniform float uSize;
  uniform float uPixel;
  /** Distance from the lens at which uSize is quoted in pixels. */
  uniform float uFocus;
  /**
   * Half the frame, in the card's own units.
   *
   * The throw is aimed at this rather than at a fixed distance, because the
   * card is a portrait object in a landscape frame: a radial burst scaled to
   * the subject fills a circle the width of the card and leaves the corners of
   * the screen empty, however far it is thrown.
   */
  uniform vec2  uSpread;
  uniform vec3  uPale;
  uniform vec3  uWarm;
  uniform vec3  uDark;

  varying float vFade;
  varying float vBlur;
  varying vec3  vColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec2 home = position.xy;
    float r1 = hash(vec2(aSeed, 1.0));
    float r2 = hash(vec2(aSeed, 2.0));
    float r3 = hash(vec2(aSeed, 3.0));
    float r4 = hash(vec2(aSeed, 4.0));

    // Outward, fanned so the cloud opens into the frame rather than radiating
    // as a perfect star, and over a wide spread of distances so the middle
    // does not empty into a hole where the card used to be.
    vec2 dir = normalize(home + vec2(0.0001, 0.0001));
    float fan = (r3 - 0.5) * 1.2;
    dir = mat2(cos(fan), -sin(fan), sin(fan), cos(fan)) * dir;

    /**
     * Outward, to the edges of the screen.
     *
     * Two things had kept this inside the card's own footprint. The throw was
     * measured in the subject's units, so it went as far as the card was wide
     * rather than as far as the frame is; and the distances were distributed as
     * r^1.6, which piles two thirds of the points into the middle third of the
     * travel — the cloud read as dense in the centre and empty at the edges no
     * matter how far the furthest ones went.
     *
     * Aimed at the frame and spread as r^0.62 instead, which is close to even
     * across the area rather than across the radius, so the burst arrives at
     * the corners with as much in it as the middle.
     */
    vec2 away = vec2(dir.x * uSpread.x, dir.y * uSpread.y)
      * (0.04 + pow(r1, 0.62) * 1.3);

    float s = uScatter * uScatter;

    // And then they float. The burst is over well before the section is, so
    // past the throw the field keeps moving on its own — a slow rise with a
    // long sideways wander, which is what stops it reading as a freeze frame.
    float drift = uTime * 0.035;
    vec2 wander = vec2(
      sin(uTime * 0.22 + aSeed * 8.0) * 0.09,
      drift * (0.35 + r2 * 0.8) + cos(uTime * 0.17 + aSeed * 5.0) * 0.05
    ) * uScatter;

    vec2 p = home + away * s + vec2(0.0, s * 0.35) + wander;

    // Edge points carry the outline, so they leave last: the card's shape stays
    // readable in the drift while the interior has already gone.
    p = mix(home, p, mix(1.0, 0.45, aEdge));

    vec4 mv = modelViewMatrix * vec4(p, 0.0, 1.0);
    float dist = max(-mv.z, 0.35);

    // Size grade. Most are specks; a few are large. It is the spread that reads
    // as depth — a field of one size reads as a texture.
    float grade = pow(r4, 3.4);
    float swell = 1.0 + s * s * (0.8 + grade * 2.2);
    gl_PointSize = uSize * uPixel * (0.3 + grade * 3.0) * (1.0 + aEdge * 0.25)
      * swell * uFocus / dist;

    // Bigger means nearer means softer, which is the whole depth cue.
    vBlur = grade;

    /**
     * The card's own colour first, the field's inks by the end.
     *
     * Weighted the way the field it hands over to is: mostly pale, some warm, a
     * few almost black so the near discs read as objects in front of the light
     * rather than more of it.
     */
    vec3 ink = r2 < 0.72 ? uPale : (r2 < 0.9 ? uWarm : uDark);
    // Lifted. The card is a dark object, and its own colours taken literally
    // give dark fragments on a dark ground — mud rather than debris. Raised
    // together so the hue survives and the pieces read as catching light.
    vColor = mix(min(aInk * 2.3, vec3(1.0)), ink, smoothstep(0.15, 0.85, uScatter));

    // In on the burst, and never fully out: the field is the frame now. Never
    // fully opaque either — the ground has to stay visible through it or the
    // burst covers the page instead of filling it.
    vFade = smoothstep(0.0, 0.16, uScatter) * (0.28 + r1 * 0.46);

    gl_Position = projectionMatrix * mv;
  }
`;

export const motesFragment = /* glsl */ `
  precision highp float;

  varying float vFade;
  varying float vBlur;
  varying vec3  vColor;

  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;

    // A flat disc with an edge that softens as the disc grows. A small far
    // speck is sharp; a large near one is defocused. One falloff for both is
    // what made these read as fog instead of as particles at different depths.
    float soft = mix(0.05, 0.72, vBlur);
    float a = smoothstep(1.0, 1.0 - soft, d) * vFade;
    if (a < 0.004) discard;

    gl_FragColor = vec4(vColor, a);
  }
`;
