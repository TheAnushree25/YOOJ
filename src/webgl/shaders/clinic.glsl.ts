/**
 * The clinic: a shape read out of a photograph, lit, replaced, and scattered.
 *
 * Two passes share this file. The first draws the building as a silhouette —
 * the photograph is never shown as a photograph; only its mask is used, filled
 * with the page's ink and given an edge where the light falls. The second
 * draws the bloom: a point cloud that is born out of the same mask, so the
 * particles can only ever appear on the building and not around it.
 *
 * The mask is taken from luminance rather than alpha. Both source images are
 * subjects on white, and a luminance key works on a flat JPEG as well as on a
 * cut-out — one fewer thing that has to be true of the art.
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

  uniform sampler2D uBefore;
  uniform sampler2D uAfter;
  uniform float uTime;
  /** 0 at the section's start, 1 at its end. */
  uniform float uProgress;
  /** How far the key light has travelled in, 0 to 1. */
  uniform float uLight;
  /** How far the second building has replaced the first, 0 to 1. */
  uniform float uSwap;
  /** Where the light sits, in uv. */
  uniform vec2  uLightAt;
  uniform vec3  uInk;
  uniform vec3  uGlow;
  uniform vec2  uAspect;

  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  /** The subject, keyed off the white it was shot on. */
  float maskOf(sampler2D tex, vec2 uv) {
    vec3 c = texture2D(tex, uv).rgb;
    float a = texture2D(tex, uv).a;
    // A transparent cut-out answers on alpha; a flat white ground answers on
    // luminance. Taking the stronger of the two means either kind of file
    // works without the component having to know which it was given.
    return max(1.0 - smoothstep(0.82, 0.99, luma(c)), a < 0.999 ? a : 0.0);
  }

  void main() {
    vec2 uv = vUv;

    float mBefore = maskOf(uBefore, uv);
    float mAfter  = maskOf(uAfter, uv);

    // The swap is a dissolve, not a cross-fade: a noise field decides which of
    // the two is showing at each point, and the threshold sweeps across it. A
    // straight fade would show both buildings at once as ghosts.
    float grain = noise(uv * 18.0) * 0.65 + noise(uv * 46.0) * 0.35;
    float edge = smoothstep(uSwap - 0.22, uSwap + 0.22, grain);
    float mask = mix(mAfter, mBefore, edge);

    if (mask < 0.02) discard;

    // Distance to the light, corrected for the frame's aspect so the falloff
    // is round rather than stretched.
    float d = length((uv - uLightAt) * uAspect);
    float lamp = uLight * exp(-d * 3.4);

    // The edge of the mask, from its own gradient. This is what the light
    // actually catches — a silhouette lit across its face reads as a flat fill
    // going grey, lit along its rim it reads as a solid object.
    float e = 0.0035;
    float gx = maskOf(uBefore, uv + vec2(e, 0.0)) - maskOf(uBefore, uv - vec2(e, 0.0));
    float gy = maskOf(uBefore, uv + vec2(0.0, e)) - maskOf(uBefore, uv - vec2(0.0, e));
    float rim = clamp(length(vec2(gx, gy)) * 2.4, 0.0, 1.0);

    // The body stays near-black throughout; everything visible on it is light.
    vec3 col = uInk;
    col += uGlow * rim * (0.25 + lamp * 2.6);
    col += uGlow * lamp * 0.5;

    // A faint dot matrix inside the shape, which is what makes the surface
    // read as sampled rather than as a cut-out of black paper.
    vec2 grid = fract(uv * vec2(230.0, 160.0)) - 0.5;
    float dot = smoothstep(0.34, 0.0, length(grid));
    col += uGlow * dot * 0.16 * lamp * mask;

    gl_FragColor = vec4(col, mask);
  }
`;

/**
 * The bloom.
 *
 * Every point is given a home on the building's mask by the CPU and then
 * pushed around by curl-ish noise here. Growth is a radius: points outside it
 * are not drawn at all rather than drawn transparent, so the cloud has an edge
 * that moves instead of a haze that brightens.
 */
export const motesVertex = /* glsl */ `
  precision highp float;

  attribute float aSeed;

  uniform float uTime;
  uniform float uGrow;
  uniform vec2  uOrigin;
  uniform float uSize;
  uniform float uSpread;
  uniform vec2  uAspect;

  varying float vFade;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec2 home = position.xy;

    // How far this point sits from where the bloom starts. Points nearer the
    // origin join first, which is what makes it read as spreading out of one
    // place rather than switching on everywhere.
    float reach = length((home - uOrigin) * uAspect) / max(uSpread, 0.0001);
    float born = smoothstep(uGrow, uGrow - 0.42, reach);

    // Two noise samples at different rates: one drifts the whole cloud, the
    // other agitates each point, so the tangle keeps turning over itself.
    float t = uTime * 0.35 + aSeed * 6.2831;
    vec2 drift = vec2(
      noise(home * 7.0 + vec2(t, 0.0)) - 0.5,
      noise(home * 7.0 + vec2(0.0, t) + 11.3) - 0.5
    );
    vec2 churn = vec2(
      noise(home * 26.0 + vec2(t * 1.9, 4.0)) - 0.5,
      noise(home * 26.0 + vec2(9.0, t * 1.7)) - 0.5
    );

    vec2 p = home + (drift * 0.085 + churn * 0.03) * born;

    vFade = born * (0.35 + 0.65 * hash(vec2(aSeed, 3.0)));

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
    gl_PointSize = uSize * (0.45 + hash(vec2(aSeed, 7.0)) * 0.9) * born;
  }
`;

export const motesFragment = /* glsl */ `
  precision highp float;

  uniform vec3 uGlow;
  varying float vFade;

  void main() {
    // Round points with a soft shoulder; a square point at this size reads as
    // a pixel artefact rather than as a mote.
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.08, d) * vFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uGlow, a);
  }
`;
