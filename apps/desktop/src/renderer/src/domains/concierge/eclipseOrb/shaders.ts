/** GLSL shaders for the Argo scene. */

export const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Background plate — the (AI-upscaled) cockpit photo, cover-fit to the viewport.
export const BG_FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uImgAspect;
uniform float uViewAspect;
uniform float uExposure;
uniform float uGlowI;
uniform float uShiftY;
uniform float uBgZoom;
uniform float uMist;
uniform float uMistPower;
uniform float uMistInner;
uniform float uHorizonY;
uniform float uCoreBright;
uniform float uCoreWidth;
uniform float uCoreHeight;
uniform float uFlareBright;
uniform float uFlareWidth;
uniform float uFlareHeight;
uniform float uSkyBright;
uniform float uSkyWidth;
uniform float uSkyReach;
uniform vec3  uCoreColor;
uniform vec3  uGlowColor;
uniform float uSceneLit;
uniform float uLiftGamma;
uniform float uLiftGammaMix;
uniform float uLiftLumScale;
uniform float uLiftLumMix;
uniform float uHorizonX;
uniform float uImageHorizonV;  // texture-v of the photo's horizon ridge (0=bottom)
void main() {
  vec2 uv = vUv;

  // Cover-fit scales: one axis is cropped depending on the window aspect.
  float vScale = (uViewAspect > uImgAspect) ? (uImgAspect / uViewAspect) : 1.0;
  float hScale = (uViewAspect > uImgAspect) ? 1.0 : (uViewAspect / uImgAspect);

  // Vertical: PIN the photo's horizon (uImageHorizonV) to the fixed screen line
  // the glow/dot live on (uHorizonY). Both the cover scale and the zoom pivot
  // around that line, so the ridge never drifts when the window resizes — the
  // crop eats sky/foreground instead. uShiftY is a fine vertical nudge.
  uv.y = (uv.y - uHorizonY) * (vScale / uBgZoom) + uImageHorizonV + uShiftY;
  // Horizontal: cover-fit, centered (zoom pivots around center).
  uv.x = (uv.x - 0.5) * (hScale / uBgZoom) + 0.5;
  vec3 col = texture2D(uTex, uv).rgb;
  col *= uExposure;
  col = pow(max(col, vec3(0.0)), vec3(mix(1.0, uLiftGamma, uSceneLit * uLiftGammaMix)));
  col = mix(col, col * uLiftLumScale, uSceneLit * uLiftLumMix);

  // ── Soft screen-edge vignette (applied to the photo only) ─────────────────
  // Multiplies into the image first — the synthetic lights below are added
  // on top so the vignette cannot crush their wide lateral spread.
  vec2 vigUv = vUv - 0.5;
  float vigR  = length(vigUv) * 2.0;
  float vig   = pow(1.0 - smoothstep(uMistInner, 1.0, vigR), uMistPower);
  col *= mix(1.0, vig, uMist);

  // ── Synthetic ground light source — added after the vignette ──────────────
  // A single light sitting on the terrain (anchored on the dot at uHorizonY).
  // It does NOT just sit there — it lights up the ground around it like a sun
  // cresting the ridge: a hot core, a wide horizontal flare smeared along the
  // horizon, a broad pool that illuminates the terrain below, and a faint
  // vertical column rising toward the ring. Zero at idle (uSceneLit 0→1).

  float dx   = vUv.x - uHorizonX;
  float dy   = vUv.y - uHorizonY;    // >0 above the source (toward ring), <0 below (ground)
  float up   = max( dy, 0.0);        // distance above the source (toward sky/ring)

  // Hot core — the bright heart in the middle.
  float core = exp(-(dx * dx * uCoreWidth + dy * dy * uCoreHeight));
  col += core * uSceneLit * uCoreBright * uCoreColor;

  // Horizontal flare — bright streak smeared left↔right along the horizon.
  float flare = exp(-(dx * dx * uFlareWidth + dy * dy * uFlareHeight));
  col += flare * uSceneLit * uFlareBright * mix(uGlowColor, uCoreColor, flare);

  // Sky glow — upward column rising from the source toward the ring/top.
  float sky = exp(-(dx * dx * uSkyWidth + up * up * uSkyReach));
  col += sky * uSceneLit * uSkyBright * uGlowColor;

  gl_FragColor = vec4(col, 1.0);
}
`

// Eclipse interior — an opaque black disc that fills the circle so the backdrop
// (stars/sky) does NOT show through. Drawn behind the additive rim with normal
// alpha blending; the additive rim + thinking lenses still glow on top of it.
export const DISC_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uRadius;
uniform float uFillInner;
uniform float uOrbAlpha;
void main() {
  vec2  p    = vUv * 2.0 - 1.0;
  float dist = length(p);
  float a    = 1.0 - smoothstep(uRadius * uFillInner, uRadius, dist);
  gl_FragColor = vec4(0.0, 0.0, 0.0, a * uOrbAlpha);
}
`

// Hairline beam — sweeps bottom-of-circle to ground dot on transition, then stays.
export const BEAM_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uProgress;
uniform float uAlpha;
uniform float uCoreWidth;
uniform float uHaloWidth;
uniform float uHaloAmt;
uniform float uFadeExp;
void main() {
  float cutoff = 1.0 - uProgress;
  if (vUv.y < cutoff) discard;
  float t = (vUv.y - cutoff) / max(uProgress, 0.001);
  float fade = pow(1.0 - t, uFadeExp);
  float x = (vUv.x - 0.5) * 2.0;
  float xFade = exp(-x * x * uCoreWidth);
  float halo  = exp(-x * x * uHaloWidth) * uHaloAmt;
  float intensity = (fade * xFade + halo * fade * 0.5) * uAlpha;
  gl_FragColor = vec4(vec3(1.0), intensity);
}
`

// Radial glow dot — persists at the horizon after the beam lands.
// uStarPoints/uStarDepth add star-shaped rays; depth=0 → plain circle.
export const DOT_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uAlpha;
uniform float uStarPoints;
uniform float uStarDepth;
uniform float uStarIrregularity;
uniform vec3  uDotColor;
void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  float r     = length(uv);
  float theta = atan(uv.y, uv.x);
  float primary   = cos(uStarPoints * theta);
  float secondary = cos((uStarPoints - 1.0) * theta + 1.7) * uStarIrregularity;
  float star  = 1.0 + uStarDepth * (primary + secondary);
  float d     = r / max(star, 0.001);
  float core  = exp(-d * d * 55.0);
  float halo  = exp(-d * d * 8.0) * 0.28;
  float bloom = exp(-d * d * 1.8) * 0.06;
  float intensity = (core + halo + bloom) * uAlpha;
  gl_FragColor = vec4(uDotColor * intensity, intensity);
}
`

export const RING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const RING_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uBright;
uniform float uGlow;
uniform float uPulse;
uniform float uBottom;
uniform float uSeg;
uniform float uSegAngle;
uniform float uBreath;
uniform float uSweep;
uniform float uSway;
uniform float uThink;
uniform float uThinkSpeed;
uniform float uThinkInward;
uniform float uThinkCount;
uniform float uThinkGlow;
uniform float uEmitIn;      // inward ripple amplitude (listening)
uniform float uEmitOut;     // outward ripple amplitude (speaking)
uniform float uRippleFreq;
uniform float uRippleSpeed;
uniform float uRippleReach;
uniform float uActive;      // 0 idle → 1 active: hide the rim, even the glow into a uniform halo
uniform float uEmitAll;     // thinking: uniform all-around outward pulse amplitude
uniform float uCrescent;    // pulse crescent width exponent — lower = wider/flatter (spreads horizontally)
uniform float uListenAngle; // radians — direction the inward listen crescent points (0 = top)
uniform float uSpeakAngle;  // radians — direction the outward speak crescent points (PI = bottom)
uniform vec3  uRimColor;    // ring rim base colour (lifted toward white at the bottom arc)
uniform float uOrbAlpha;

#define PI  3.14159265359
#define TAU 6.28318530718
#define RING_R 0.45
#define RING_W 0.006
#define GLOW_W 0.075
#define MAX_LENS 8   // GLSL needs a constant loop bound; uThinkCount picks how many of these actually run

void main() {
  vec2 uv    = vUv * 2.0 - 1.0;
  float dist = length(uv);
  float r    = RING_R;
  float sd   = dist - r;
  float d    = abs(sd);
  float dout = max(sd, 0.0);
  float om   = step(0.0, sd);
  float angle = atan(uv.x, uv.y);
  float c     = cos(angle);

  float core = exp(-d * d / (RING_W * RING_W));

  float topArc = pow(max(c, 0.0), 2.0);
  float cb     = cos(angle - uSway);
  float botArc = pow(max(-cb, 0.0), 1.5);
  float along  = mix(0.04 + topArc * 0.6 + botArc * 1.7, 1.0, uThink); // even, continuous ring while thinking

  float seg = 1.0;
  if (uSeg > 0.5 && uThink < 0.5) { // never segment the ring while thinking — keep it continuous
    const float N = 8.0;
    float aN = mod(angle + uSegAngle + PI, TAU) / TAU;
    float s  = fract(aN * N);
    seg = smoothstep(0.0, 0.14, s) * smoothstep(1.0, 0.86, s);
    float idx = floor(aN * N);
    seg *= 0.4 + 0.6 * sin(uTime * 1.6 + idx * 1.57);
  }

  float ring = core * along * seg;

  float bloom = exp(-d * d / (0.016 * 0.016)) * mix(0.05 + topArc * 0.30 + botArc * 0.9 * (1.0 + uBottom * 0.6), 0.7, uThink);

  // Snap to uniform corona immediately on activation so angular asymmetry never flickers.
  float outerAng = mix(0.08 + topArc * 0.45 + botArc * 1.0, 0.7, smoothstep(0.0, 0.3, uActive));

  // Lorentzian corona — atmospheric eclipse falloff for the outer glow.
  float corona = 1.0 / (d / (GLOW_W * 0.45) + 1.0);

  // Outside disc (sd≥0): Lorentzian corona — atmospheric eclipse glow.
  // Inside  disc (sd<0) + thinking: exact Shadertoy C/d_main × C/d_lens product.
  //   Bright ONLY near the geometric intersection of the two ring circles → sharp crescent.
  //   Dark everywhere else inside (DISC_FRAG provides opaque black behind the ring mesh).
  // Inside  disc (sd<0) + not thinking: zero — disc is dark, no phantom ring.
  float outer;
  if (sd >= 0.0) {
    outer = corona * outerAng * uGlow;
  } else if (uThink > 0.001) {
    const float TC = 0.035; // C constant scaled for RING_R=0.45 UV space
    const float TD = 0.003; // min-d clamp — prevents div-by-zero at exact ring intersections
    float mainF    = TC / max(d, TD);
    float lensN    = max(uThinkCount, 1.0);
    float bestLens = 0.0;
    for (int i = 0; i < MAX_LENS; i++) {
      if (float(i) >= uThinkCount) break;
      float fi    = float(i);
      float bang  = uTime * 0.5 + fi * (TAU / lensN);
      float cyc   = fract(uTime * uThinkSpeed + fi / lensN);
      float dip   = cyc < 0.40 ? sin(cyc / 0.40 * PI) : 0.0;
      float rad   = mix(2.55, uThinkInward, dip) * RING_R;
      vec2  off   = vec2(cos(bang), sin(bang)) * rad;
      float dLens = abs(length(uv - off) - RING_R);
      bestLens    = max(bestLens, TC / max(dLens, TD));
    }
    outer = mainF * bestLens * uThinkGlow * outerAng * uGlow * uThink;
  } else {
    // Listening / speaking: soft inner rim glow — same Lorentzian at 30% — smooths the
    // hard disc edge so the corona blends through the ring on both sides (no hard clip).
    outer = corona * outerAng * uGlow * 0.3 * uActive;
  }

  float orbit   = pow(0.5 + 0.5 * cos(angle - uSweep), 5.0) + pow(0.5 + 0.5 * cos(angle + uSweep), 5.0);
  float shimmer = om * exp(-dout * dout / (0.030 * 0.030)) * orbit * uGlow;

  float hD   = abs(dist - r * 1.08);
  float halo = exp(-hD * hD / (GLOW_W * GLOW_W * 1.6)) * uPulse * 0.32 * (0.3 + botArc);

  // Traveling crescent pulse outside the rim. Listening: inward at uListenAngle.
  // Speaking: outward at uSpeakAngle. Thinking: uniform all-around.
  // uListenAngle / uSpeakAngle control which direction each state pools toward —
  // tune in sceneConfig.animation.ripple to avoid horizon clash or visual clip.
  float ripple = 0.0;
  if (sd > 0.0 && (uEmitIn + uEmitOut + uEmitAll) > 0.001) {
    float falloff   = smoothstep(0.0, uRippleReach * 0.45, dout) * exp(-dout * dout / (uRippleReach * uRippleReach));
    float inW       = 0.5 + 0.5 * sin(dout * uRippleFreq + uTime * uRippleSpeed);
    float outW      = 0.5 + 0.5 * sin(dout * uRippleFreq - uTime * uRippleSpeed);
    // (1+cos)/2 ranges 0→1 with no hard cutoff — gradient crescent, no equatorial seam.
    float listenCresc = pow((1.0 + cos(angle - uListenAngle)) * 0.5, uCrescent);
    float speakCresc  = pow((1.0 + cos(angle - uSpeakAngle))  * 0.5, uCrescent);
    ripple = (inW * uEmitIn * listenCresc + outW * uEmitOut * speakCresc + outW * uEmitAll) * falloff;
  }

  float rimVis = 1.0 - uActive;
  float intensity = ((ring * 1.5 + bloom * 0.4 + shimmer * 0.35 + halo) * rimVis + outer * 0.7 + ripple) * uBright * (1.0 + uBreath);
  float white      = clamp(botArc * 0.5, 0.0, 1.0);
  vec3  eclipseRGB = mix(uRimColor, vec3(1.0, 1.0, 1.0), white) * intensity;

  float alpha = clamp(intensity, 0.0, 1.0);
  gl_FragColor = vec4(eclipseRGB, alpha * uOrbAlpha);
}
`
