/**
 * The field behind every section.
 *
 * A radial bloom: one soft light sitting in a deep ground, with the ground
 * going deeper toward the edges. This replaces the displaced-plane port that
 * used to be here, because the artwork the page is now built on is exactly
 * this — a radial gradient in three stops, supplied as four stills with the
 * light in four different places. Rendered rather than played back: a single
 * fragment pass reproduces the stops precisely at any viewport, and the light
 * can move continuously between the poses instead of cross-fading between
 * four photographs of it.
 *
 * The stops are read from the stylesheet, so the two grounds — the wine of the
 * front page and the blush of the Aleph page — are the same shader with a
 * different palette.
 *
 *   uColor3  the light itself, at the centre of the bloom
 *   uColor2  the body colour the light sits in
 *   uColor1  the deep edge
 *   uBg      what the corners fall toward
 */
export const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const fragment = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uProgress;    // 0..1 through the whole page
  uniform vec2  uResolution;
  uniform vec2  uPointer;

  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform vec3  uBg;

  /** Radius of the bloom, as a fraction of the frame's height. */
  uniform float uAmplitude;
  uniform float uDensity;
  uniform float uFrequency;
  /** How fast the light walks. */
  uniform float uSpeed;
  uniform float uStrength;
  uniform float uBrightness;
  uniform float uReflection;
  uniform float uShade;
  uniform float uRotation;
  /** A standing bias on where the light sits, per page. */
  uniform vec2  uOffset;

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    /**
     * Where the light is.
     *
     * The four stills put it upper right, right, lower right and low centre.
     * Two slow sines at unrelated rates carry it round a loop that passes
     * through all four and never repeats exactly — slower than anything on the
     * page, so nothing appears to move because of it; the frame is simply
     * different whenever the reader comes back to it. The pointer nudges it a
     * little, so the ground answers the hand without turning into a torch.
     */
    float era = uTime * uSpeed * 0.11;
    vec2 light = vec2(
      0.22 + sin(era) * 0.16 + cos(era * 0.63 + 1.2) * 0.07,
      0.08 + cos(era * 0.81) * 0.17 + sin(era * 0.47 + 2.1) * 0.06
    );
    light += (uPointer - 0.5) * 0.12;
    light += uOffset * 0.1;

    // A slightly wider-than-tall disc, which is what the artwork has: the
    // light was drawn as a landscape bloom, not a spot.
    float d = length((p - light) / vec2(1.0, 0.82));
    float r = clamp(d / max(0.86 * uAmplitude, 0.05), 0.0, 1.0);

    // Three stops. The light gives way to the body colour over the inner half
    // and the body to the deep edge over the outer half, overlapping in the
    // middle so there is no ring where one hands to the other.
    vec3 col = mix(uColor3, uColor2, smoothstep(0.0, 0.55, r));
    col = mix(col, uColor1, smoothstep(0.40, 1.0, r));

    // A second, much fainter bloom on the far side, low. Without it a single
    // light leaves the opposite corner dead, and the artwork does not.
    vec2 second = vec2(-light.x * 0.9, -0.34 + sin(era * 0.53) * 0.05);
    float d2 = length((p - second) / vec2(1.0, 0.7));
    col = mix(col, uColor2, (1.0 - smoothstep(0.0, 0.7, d2)) * 0.28);

    col *= uBrightness;

    // The page's own travel warms the field slightly, so the site has a
    // temperature arc rather than one flat mood for its whole length.
    col *= 1.0 + smoothstep(0.15, 0.95, uProgress) * 0.08;

    // Toward the ground colour at the far corners, which is what keeps type
    // legible over a wide viewport.
    float vig = smoothstep(1.6, 0.5, length(p));
    col = mix(uBg, col, 0.55 + vig * 0.45);

    // Back to sRGB before writing.
    //
    // Three converts every Color to linear space on construction, so the
    // colours arriving here are already linearised. Mixing in linear is
    // correct — that is where light adds properly — but writing the result raw
    // displays the whole field about a gamma too dark. This is the encode that
    // closes that loop.
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

    // Grain, applied after the encode rather than before it: in display space
    // the same offset is the same perceived step everywhere, which is all it
    // is for — breaking the banding an eight-bit panel shows across a large
    // smooth gradient.
    float grain = (fract(sin(dot(uv * uResolution + fract(uTime), vec2(127.1, 311.7))) * 43758.5453) - 0.5) * 0.014;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;
