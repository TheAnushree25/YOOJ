/**
 * The field behind every section.
 *
 * A port of the ShaderGradient "defaults" plane: a surface displaced by
 * gradient noise and shaded along its own slope, rather than a flat ramp with
 * noise laid over it. That distinction is the whole look — the light is a
 * response to the geometry, so the bands stay coherent as they move instead of
 * boiling the way a pure colour-noise field does.
 *
 * The plane is not actually built; there is no geometry to displace on a full
 * screen quad. The displacement is evaluated per fragment and its analytic
 * slope is what the lighting reads, which gets the same image for the cost of
 * one fragment pass.
 *
 * Every uniform below maps to a control on the original:
 *
 *   uAmplitude  uDensity  uFrequency  uSpeed  uStrength
 *   uBrightness uReflection
 *   uRotation (rotationZ)  uOffset (positionX/Y)
 *   uColor1 uColor2 uColor3  uBg
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

  uniform float uAmplitude;
  uniform float uDensity;
  uniform float uFrequency;
  uniform float uSpeed;
  uniform float uStrength;
  uniform float uBrightness;
  uniform float uReflection;
  uniform float uRotation;    // radians
  uniform vec2  uOffset;

  /* ---------------------------------------------------------------- noise */

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  // Ashima's simplex noise. The original plane is displaced with 3D simplex
  // sampled at (position, time) — value noise reads visibly gridded at the low
  // densities this runs at, which is why it is worth the extra arithmetic.
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  /* ------------------------------------------------------------ the plane */

  // The surface's height at a point. Two terms, as the original has: a slow
  // broad one carrying the form and a faster one at uFrequency putting the
  // ripple across it.
  float height(vec2 p, float t) {
    float base  = snoise(vec3(p * uDensity, t)) * uAmplitude;
    // uFrequency is the plane's own subdivision on the original, not a noise
    // octave — fed straight in as a multiplier it turns a flowing surface into
    // fine static. Scaled to the band it actually controls, it puts one slow
    // undulation across the form and nothing finer.
    float ridge = snoise(vec3(p * uDensity * (uFrequency * 0.17), t * 0.8))
                * (uAmplitude * 0.3);
    return (base + ridge) * (uStrength * 0.25);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);

    // Into plane space: centred, aspect-corrected, rotated and offset the way
    // the original's camera sees it.
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * 2.0;
    float turn = uRotation + sin(uTime * 0.021) * 0.16;
    float c = cos(turn);
    float s = sin(turn);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    p += uOffset;

    // The pointer nudges the field rather than tracking it, so the surface
    // feels alive without turning into a spotlight that follows the mouse.
    p += (uPointer - 0.5) * 0.22;

    float t = uTime * uSpeed;

    /**
     * The field is never twice the same.
     *
     * The noise already flows, but a flowing surface under a fixed colour ramp
     * reads as one image being stirred — the colour never actually changes.
     * These three drifts are what make it a gradient that evolves: the plane
     * turns, the light walks around it, and the stops the ramp is read between
     * breathe apart and together. All far slower than the surface itself, so
     * nothing on screen appears to move because of them; the frame is simply
     * different whenever you come back to it.
     */
    float era = uTime * 0.045;

    float h = height(p, t);

    // The slope, taken by differencing the height either side. This is what
    // the light reads, and it is why the bands hold their shape while they
    // move — a colour ramp driven by the height alone shimmers instead.
    float e = 0.09;
    vec2 slope = vec2(
      height(p + vec2(e, 0.0), t) - height(p - vec2(e, 0.0), t),
      height(p + vec2(0.0, e), t) - height(p - vec2(0.0, e), t)
    ) / (2.0 * e);
    vec3 normal = normalize(vec3(-slope, 1.0));

    // Three stops along the surface, exactly as the original mixes them —
    // with the thresholds drifting, so the balance between them keeps moving.
    float ramp = clamp(h * 0.5 + 0.5, 0.0, 1.0);
    float lo = 0.18 + sin(era) * 0.10;
    float hi = 0.72 + sin(era * 0.73 + 1.7) * 0.12;
    vec3 col = mix(uColor1, uColor2, smoothstep(lo, hi, ramp));
    col = mix(col, uColor3, smoothstep(0.58 + sin(era * 0.51 + 3.1) * 0.12, 1.0, ramp));

    // A key from the upper left, where the preset's studio light sits, walking
    // slowly around the surface so the lit side of every fold keeps changing.
    vec3 key = normalize(vec3(-0.55 + sin(era * 0.8) * 0.4, 0.72, 0.62 + cos(era * 0.8) * 0.22));
    float lambert = max(dot(normal, key), 0.0);

    // A broad sheen, not a point highlight.
    //
    // At a tight exponent this term found every small slope in the noise and
    // lit it to near-white — the field was covered in little comets. Widened
    // to a soft roll-off and multiplied by the diffuse term, it can only
    // brighten a face that is already lit, which is what a reflection does.
    float sheen = pow(max(dot(reflect(-key, normal), vec3(0.0, 0.0, 1.0)), 0.0), 5.0);

    col *= 0.72 + lambert * 0.44;

    // Multiplied in, never added.
    //
    // This colour's green channel is close to zero, so adding even a hundredth
    // of white light to every channel equally raises green by orders of
    // magnitude and the crimson desaturates to a pale streak. That is what the
    // white comets across the field were: not highlights, but the hue being
    // washed out wherever the surface faced the light. Scaling keeps the hue
    // and brightens what is already there.
    col *= 1.0 + uReflection * sheen * lambert * 0.8;
    col *= uBrightness;

    // The page's own travel warms the field slightly, so the site has a
    // temperature arc rather than one flat mood for its whole length.
    col *= 1.0 + smoothstep(0.15, 0.95, uProgress) * 0.14;

    // Toward the background colour at the corners, which is what keeps type
    // legible over a wide viewport.
    float vig = smoothstep(1.5, 0.3, length(vec2((uv.x - 0.5) * aspect, uv.y - 0.5)));
    col = mix(uBg, col, 0.34 + vig * 0.66);

    // Back to sRGB before writing.
    //
    // Three converts every Color to linear space on construction, so the
    // colours arriving here are already linearised. Mixing in linear is
    // correct — that is where light adds properly — but writing the result raw
    // displays the whole field about a gamma too dark, and the page reads as
    // black. This is the encode that closes that loop.
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

    // Grain, applied after the encode rather than before it.
    //
    // In linear space a fixed offset is enormous relative to a channel that is
    // almost zero, so grain added there speckles the darks and tints them. In
    // display space the same offset is the same perceived step everywhere,
    // which is all it is for: breaking the banding an eight-bit panel shows
    // across a large smooth gradient.
    float grain = (fract(sin(dot(uv * uResolution + fract(uTime), vec2(127.1, 311.7))) * 43758.5453) - 0.5) * 0.016;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;
