/**
 * The head, and what happens inside it.
 *
 * Four renders of the same subject — plain, chaotic, ordered, and resolved
 * into a grid — cross-faded by where the reader is in the section. They are
 * the same photograph under different treatments, so a straight fade is right:
 * nothing moves between them, only what is lit inside the silhouette changes.
 * (The clinic pair needed a noise dissolve for the opposite reason — those are
 * two different buildings, and fading would show both at once as ghosts.)
 *
 * On top of the plates sit two point clouds. The first is the dispersal: the
 * head's own edge, seeded as contour points that drift apart. The second is
 * the bokeh — large, soft, out-of-focus discs that give the dark frame depth.
 */

export const plateVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const plateFragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform sampler2D uBase;
  uniform sampler2D uChaos;
  uniform sampler2D uOrder;
  uniform sampler2D uTwin;

  /** One weight per effect — chaos, order, twin. The head is not one of them. */
  uniform vec3  uMix;
  /** How far the head has come apart, 0 to 1. */
  uniform float uScatter;
  uniform float uTime;

  void main() {
    vec4 base  = texture2D(uBase,  vUv);
    vec4 chaos = texture2D(uChaos, vUv);
    vec4 order = texture2D(uOrder, vUv);
    vec4 twin  = texture2D(uTwin,  vUv);

    /**
     * The head is constant. Only the light inside it changes.
     *
     * Cross-fading the four plates as whole images was wrong: the boy himself
     * dissolved into the next boy, so it read as photographs being swapped
     * rather than as something happening in one person's mind. Every effect
     * plate is the same photograph with light added, so subtracting the base
     * leaves exactly that light and nothing else — the difference is the
     * effect, isolated. Added back over a base that never fades, the subject
     * cannot move, blink or shift by a pixel between states.
     */
    vec3 glowChaos = max(chaos.rgb - base.rgb, 0.0);
    vec3 glowOrder = max(order.rgb - base.rgb, 0.0);
    vec3 glowTwin  = max(twin.rgb  - base.rgb, 0.0);

    vec4 col = base;
    col.rgb += glowChaos * uMix.x + glowOrder * uMix.y + glowTwin * uMix.z;

    // As the head disperses the plate goes with it, from the bottom up — the
    // points take over the shape, so the photograph has to leave or the two
    // would be visible on top of one another.
    float lift = smoothstep(0.0, 1.0, uScatter * 1.6 - (1.0 - vUv.y) * 0.6);
    col.a *= 1.0 - lift;

    if (col.a < 0.004) discard;
    gl_FragColor = col;
  }
`;

/**
 * The dispersal, and the field it becomes.
 *
 * One system, not two. The points seeded on the head are the same points that
 * end up drifting across the frame — a separate bokeh layer was two things
 * pretending to be one, and they never matched because they were never the
 * same particles.
 *
 * They are matte discs, not glowing sprites. That is the thing the reference
 * actually does and the reason nothing else read correctly: its field is flat
 * opaque confetti in pale grey, warm beige and near-black, sharp where the
 * discs are small and defocused where they are large. Additive glow gave a
 * fog; normal-blended discs give a depth of field.
 */
export const motesVertex = /* glsl */ `
  precision highp float;

  attribute float aSeed;
  /** 1 for a point taken from the silhouette's edge, 0 for its interior. */
  attribute float aEdge;

  uniform float uTime;
  uniform float uScatter;
  uniform float uSize;
  uniform float uPixel;
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
    // does not empty into a hole where the head used to be.
    vec2 dir = normalize(home + vec2(0.0001, 0.0001));
    float fan = (r3 - 0.5) * 1.2;
    dir = mat2(cos(fan), -sin(fan), sin(fan), cos(fan)) * dir;
    vec2 away = dir * (0.05 + pow(r1, 1.6) * 2.8);

    float s = uScatter * uScatter;

    // And then they float. The burst is over well before the section is, so
    // past the throw the field keeps moving on its own — a slow rise with a
    // long sideways wander, which is what stops it reading as a freeze frame.
    float drift = uTime * 0.035;
    vec2 float2 = vec2(
      sin(uTime * 0.22 + aSeed * 8.0) * 0.09,
      drift * (0.35 + r2 * 0.8) + cos(uTime * 0.17 + aSeed * 5.0) * 0.05
    ) * uScatter;

    vec2 p = home + away * s + vec2(0.0, s * 0.35) + float2;

    // Edge points carry the outline, so they leave last: the profile stays
    // readable in the drift while the interior has already gone.
    p = mix(home, p, mix(1.0, 0.45, aEdge));

    // Size grade. Most are specks; a few are large. It is the spread that
    // reads as depth — a field of one size reads as a texture.
    // Steep, so the overwhelming majority stay specks and the large discs are
    // genuinely rare. The reference's field is mostly navy with a scattering
    // across it, and every multiplier here is bounded to keep it that way —
    // unbounded, they compound into a wall of confetti with no ground behind.
    float grade = pow(r4, 3.4);
    float swell = 1.0 + uScatter * uScatter * (0.8 + grade * 2.2);
    gl_PointSize = uSize * uPixel * (0.3 + grade * 3.0) * (1.0 + aEdge * 0.25) * swell;

    // Bigger means nearer means softer, which is the whole depth cue.
    vBlur = grade;

    // Three inks, weighted the way the reference's field is: mostly pale, some
    // warm, a few almost black so the near discs read as objects in front of
    // the light rather than more of it.
    vColor = r2 < 0.72 ? uPale : (r2 < 0.9 ? uWarm : uDark);

    // In on the burst, and never fully out: the field is the frame now.
    // Never fully opaque. The ground has to stay visible through the field or
    // the burst covers the page instead of filling it.
    vFade = smoothstep(0.0, 0.16, uScatter) * (0.28 + r1 * 0.46);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
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
