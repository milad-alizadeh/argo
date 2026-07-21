/**
 * Single source of truth for every Three.js tuning value in the eclipse-ring
 * orb scene (cockpit ring + backdrop).
 *
 * Shader GLSL literals (shaders.ts) and runtime-adaptive values are
 * intentionally excluded — those are hardware-query or CSS-token reads.
 */

import type { OrbState } from './eclipseOrb/types'

export interface EclipseStateLook {
  // Ring visual targets
  bright: number
  glow: number
  pulse: number
  bottom: number
  seg: number
  // Audio sensitivity — how mic/TTS level modulates the ring in this state
  mic: { brightAdd: number; glowDrive: number }
  audio: { breathAdd: number; bottomAdd: number }
  // Per-state render-loop motion params (shape differs per state; empty when none)
  motion: Record<string, number>
}

export const SCENE_CONFIG = {
  // ── Eclipse Orb (cockpit ring scene) ───────────────────────────────────────
  eclipseOrb: {
    renderer: {
      clearColor: 0x020408,
      pixelRatioMult: 2, // window.devicePixelRatio × this …
      pixelRatioCap: 2, // … capped here (2 = native retina; 3 rendered ~2.25× more fragments for no visible gain on a 2× display)
    },
    camera: {
      fov: 45, // degrees — default (no panels)
      fovOpen: 52, // degrees — wider FOV when any panel is open (subtle zoom-out)
      fovSpeed: 2, // lerp speed for the FOV transition
      z: 6.5, // world units
      near: 0.1,
      far: 100,
    },
    lerpSpeed: 4.0, // SP default — 1.0 means full change per second

    ring: {
      planeSize: 5.0, // PlaneGeometry side length (world units)
      posY: 0.1, // mesh Y offset from origin
      scale: 0.8, // uniform XY scale applied to ring mesh
      uvRadius: 0.45, // RING_R in shader — must stay in sync with shaders.ts define
      fillFeather: 0.85, // disc gradient start — 0=full gradient from centre, 1=hard edge at rim
      discRenderOrder: -50, // between background (-100) and ring (0): occludes stars, sits under the rim
    },
    background: {
      z: 0,
      imgW: 6400, // 4× AI-upscaled plate dimensions (aspect ratio only)
      imgH: 4812,
      shiftY: 0.0, // vertical pan: + pushes mountains lower in frame, − raises them
      zoom: 1.0, // 2D scale of the photo: >1 zooms IN (mountains bigger), <1 zooms OUT
      // FOV (deg) at which the mountains exactly fill the screen. The backdrop is
      // a FIXED-SIZE world object sized against THIS — not the live camera.fov — so
      // changing camera.fov zooms the orb AND the mountains together (one scene).
      // Set this to your most zoomed-OUT camera.fov so there's room to pull back
      // without black bars: when camera.fov > coverFov, the plane no longer fills.
      coverFov: 60,
      renderOrder: -100,
    },
    beam: {
      speed: 6.0, // sweep speed (~330ms at 60 fps)
      fadeOutSpeed: 8.0, // fade-out speed after sweep (units/s — higher = faster dissolve)
      planeW: 0.1, // plane geometry width (world units)
      renderOrder: 10,
      coreWidth: 320.0, // core gaussian tightness — higher = narrower beam
      haloWidth: 30.0, // halo gaussian tightness — higher = tighter halo
      haloAmt: 0.08, // halo brightness multiplier
      fadeExp: 1.5, // length fade exponent — higher = faster fade toward top
    },
    dot: {
      worldY: -2.2, // ground glow vertical position
      worldZ: 0, // same z as ring — keeps dot/beam perspective-aligned when camera shifts
      planeSize: 0.4,
      flickerBase: 0.07, // base flicker amount
      flickerMic: 0.16, // mic-level flicker multiplier
      renderOrder: 10,
      alphaLerpSpd: 5, // dot alpha lerp speed
      flickerFreq: 22.0, // primary flicker sin frequency
      flickerMod: 9.1, // modulation sin frequency
      flickerDepth: 2.0, // modulation depth
      // Star shape — 0 depth = plain circle, higher depth = sharper rays
      starPoints: 13.0, // number of star arms
      starDepth: 0.1, // arm prominence (0 = circle, 1 = very pointy)
      starIrregularity: 0.35, // secondary harmonic strength — breaks perfect symmetry
      haloDelaySpd: 3.0, // how fast the ground halo fades in after the beam lands
    },
    // SP (smooth parameter) interpolation speeds for eclipse-specific params
    smoothing: {
      seg: 2.0,
      think: 3.0,
      mist: 2.0,
      sceneLit: 2.0,
      panelShift: 1.8, // camera-X drift speed when panels open/close (higher = snappier)
      emit: 3.5, // ripple amplitude ramp when entering/leaving listening/speaking
    },

    // Per-state ring targets + audio sensitivity — everything about a state in one place.
    // mic.brightAdd  — micLevel × this added to ring brightness while listening
    // mic.glowDrive  — micLevel × this multiplied into the glow formula while listening
    // audio.breathAdd — audioLevel × this added to breath pulse amplitude while speaking
    // audio.bottomAdd — audioLevel × this added to bottom-arc intensity while speaking
    states: {
      idle: {
        bright: 0.55,
        glow: 0.0,
        pulse: 0.0,
        bottom: 0.0,
        seg: 0,
        mic: { brightAdd: 0, glowDrive: 0 },
        audio: { breathAdd: 0, bottomAdd: 0 },
        motion: { freq: 0.45, amp: 0.015 }, // gentle resting bob
      },
      listening: {
        bright: 0.9,
        glow: 0.9, // consistent active-state glow base
        pulse: 1.0,
        bottom: 0.0,
        seg: 0,
        mic: { brightAdd: 0.15, glowDrive: 0.4 },
        audio: { breathAdd: 0, bottomAdd: 0 },
        motion: { pulseGain: 1.6, pulseMod: 1.0, pulseFreq: 1.6 }, // alert pulse — pronounced
      },
      thinking: {
        bright: 0.9,
        glow: 0.9, // consistent active-state glow base
        pulse: 1.0,
        bottom: 0.0,
        seg: 0,
        mic: { brightAdd: 0, glowDrive: 0 },
        audio: { breathAdd: 0, bottomAdd: 0 },
        motion: { speed: 0.2, inward: 1.4, lensCount: 4, lensGlow: 1.5 },
      },
      speaking: {
        bright: 0.85,
        glow: 0.9, // consistent active-state glow base
        pulse: 0.32,
        bottom: 0.9,
        seg: 0,
        mic: { brightAdd: 0, glowDrive: 0 },
        audio: { breathAdd: 0.025, bottomAdd: 0.4 },
        motion: { breathFreq: 1.9, breathAmp: 0.018 }, // calm swell
      },
      error: {
        // Loud on purpose — bright red corona (palette lerps base→error), so it
        // never reads as a dim idle. bright well above idle's 0.55; full glow.
        bright: 0.85,
        glow: 1.0,
        pulse: 0.0,
        bottom: 0.0,
        seg: 0,
        mic: { brightAdd: 0, glowDrive: 0 },
        audio: { breathAdd: 0, bottomAdd: 0 },
        motion: {},
      },
    } as Record<OrbState, EclipseStateLook>,

    // Cross-state render-loop constants. Per-state motion (idle bob, listen
    // pulse, speak breath, think lenses) now lives on each states.<name>.motion.
    animation: {
      sweep: { listenSpeed: 0.5, idleSpeed: 0.12 },
      sway: {
        listenAmp: 0.4,
        idleAmp: 0.07,
        lerpSpd: 1.5,
        listenPhaseSpd: 0.5,
        idlePhaseSpd: 0.14,
      },
      drift: { primaryAmp: 0.75, secondaryFreq: 0.43, secondaryPhase: 1.3, secondaryAmp: 0.25 },
      glow: { baseBright: 3.5, soundGain: 0.4 }, // strong always-on corona; sound only subtly modulates it (awake states)
      listenBreathFreq: 1.7,
      pulseVisualAmp: 0.08,
      // Traveling pulse — concentric wavefronts radiating UNIFORMLY all around the
      // eclipse. Inward while listening (drawing your voice in, mic-reactive),
      // outward while speaking (emitting, TTS-reactive). Same field, opposite sign.
      ripple: {
        freq: 16.0, // ring spacing — higher = tighter, more rings
        speed: 3.5, // travel speed (rad/s)
        reach: 0.34, // how far rings extend past the rim before fading to nothing
        weight: 1.2, // overall intensity folded into the ring glow
        listenBase: 0.3, // always-on inward crescent — marks "receiving" even in silence
        listenMic: 0.5, // micLevel × this added to inward amplitude (reacts to your voice)
        speakBase: 0.3, // always-on outward crescent — marks "emitting" even in silence
        speakAudio: 0.5, // audioLevel × this added to outward amplitude (reacts to TTS)
        listenAngle: 0, // radians — direction the listen crescent points (0 = top / 12 o'clock)
        speakAngle: Math.PI, // radians — direction the speak crescent points (PI = bottom / 6 o'clock)
        thinkBase: 0.2, // thinking: steady all-around pulse amplitude (no sound reactivity)
        crescent: 3.0, // crescent concentration — higher = tighter (less at 90°), lower = more uniform
      },
    },

    // uGlowI — internal glow intensity driver (feeds the ground dot only).
    // Higher values = a brighter, more reactive dot.
    sceneGlow: {
      base: 0.4, // resting glow when active
      listenMult: 0.2, // added by the listening pulse
      breathMult: 0.45, // added by the speaking breath
      bottomMult: 0.08, // added by bottom-arc intensity
      activeMult: 0.04, // added simply for being non-idle
    },
    // ── Whole-photo brightness when active ─────────────────────────────────
    // These lift the ENTIRE background photo (including its sky) once the orb
    // wakes. This — not the synthetic light below — is what makes the sky/center
    // brighten upward. Turn these down to keep the upper scene darker.
    sceneExposure: {
      brightMult: 0.18, // exposure added per unit of ring brightness
      breathMult: 0.35, // exposure added by the speaking breath
      activeMult: 0.08, // flat exposure boost for being non-idle (0 = none)
    },
    // Tone lift applied to the photo when active (reveals shadow detail / sky).
    sceneLift: {
      gamma: 0.72, // gamma curve (lower = lifts darks more)
      gammaMix: 0.45, // how much of the gamma lift to blend in (0 = off)
      lumScale: 1.5, // luminance multiplier (>1 = brighter overall)
      lumMix: 0.4, // how much of the luminance boost to blend in (0 = off)
    },
    sceneMist: {
      strength: 0.3, // overall vignette opacity (0 = off, 1 = full)
      power: 2.0, // falloff sharpness — higher = harder edge
      inner: 0.3, // radius (0–1, where 1 = viewport short-edge half) where darkening begins
    },
    // ── Synthetic ground light source ──────────────────────────────────────
    // Recreates the "sun cresting the ridge" lighting that was baked into the
    // old photo. The light sits on the terrain (anchored on the dot) and lights
    // the scene around it. EVERYTHING here is live-tunable — adjust freely.
    //
    // How to read the numbers:
    //   • brightness  → 0 turns that piece OFF; higher = brighter.
    //   • width / height / depth / reach → these are gaussian "tightness".
    //       HIGHER number = TIGHTER (smaller / thinner) light.
    //       LOWER  number = LOOSER  (wider / taller / further-spreading) light.
    //   • colors are [r, g, b], each 0–1.
    horizonGlow: {
      // ── Position ───────────────────────────────────────────────────────
      // Vertical screen position of the light, 0 = bottom edge, 1 = top edge.
      // Keep aligned with the ground dot (~0.23) so the glow sits on it.
      screenY: 0.2,
      // Texture-v of the photo's horizon ridge (0 = bottom of image, 1 = top).
      // The backdrop shader PINS this image line to `screenY` so the ridge sits
      // on the glow/dot at every window size (no drift on resize). Raise to pull
      // a higher part of the photo onto the horizon line; lower for a lower part.
      imageHorizonV: 0.295,
      // Fine-tune horizontal position: added on top of the parallax-computed value.
      // 0 = auto-centred under the dot. Positive shifts glow right, negative left.
      xAdjust: 0.0,

      // ── Hot core (the bright heart in the middle) ──────────────────────
      // The synthetic light's broad ambient fill (core + sheen + sky) lights the
      // whole scene on activation and balances the mist vignette. It also blooms
      // into the sky region above the ridge now (BG_FRAG alpha bloom).
      coreBrightness: 0.3, // brightness of the central hot spot (0 = off)
      coreWidth: 170, // horizontal tightness (higher = narrower spot)
      coreHeight: 500, // vertical tightness   (higher = flatter spot)

      // ── Horizontal flare (the streak smeared left↔right on the horizon) ─
      flareBrightness: 0.2, // brightness of the horizon streak (0 = off)
      flareWidth: 500, // sideways tightness (LOWER = streak reaches wider)
      flareHeight: 3000, // vertical tightness (higher = thinner line)

      // ── Ground sheen (light pooling on the terrain below the source) ────
      sheenBrightness: 0, // brightness of the ground pool (0 = off)
      sheenWidth: 100, // horizontal tightness (LOWER = pool reaches wider)
      sheenDepth: 100, // downward falloff (HIGHER = hugs horizon / shallow,
      //                   LOWER = bleeds further DOWN)

      // ── Sky glow (how far the light reaches UP into the sky above) ──────
      // This is the upward column rising toward the ring. Turn skyBrightness up
      // and skyReach DOWN to make the light climb all the way to the top.
      skyBrightness: 0.05, // brightness of the upward glow (0 = no sky glow)
      skyWidth: 30, // horizontal tightness — was 500 (too narrow, appeared as a line)
      skyReach: 80, // upward falloff (HIGHER = stops low / short, LOWER = reaches toward the TOP)
    },
    // ── Scene palette — the single colour knob ─────────────────────────────────
    // ONE saturated base colour drives the WHOLE scene. The ring rim, ground dot,
    // horizon glow, and hot core are all this colour lifted toward white by a
    // fixed amount (the *Lift constants below — these preserve the tonal
    // hierarchy and are NOT meant to be retuned for warmth).
    //
    // To recolour the scene, change ONE value: `base`. The error state swaps
    // `base`→`error`, and the colour lerp carries every element together.
    palette: {
      base: [0.22, 0.4, 0.85] as [number, number, number], // cool eclipse blue (default)
      error: [0.92, 0.16, 0.12] as [number, number, number], // alarm red (error state only)
      coreLift: 0.74, // hot core → near-white
      rimLift: 0.5, // ring rim → bright
      dotLift: 0.4, // ground dot
      glowLift: 0.0, // horizon glow/flare/sky = base, full saturation
    },
  },
}
