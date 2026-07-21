/**
 * Eclipse-ring orb — Three.js scene ported from the v1 Argo prototype.
 * Photo backdrop (cockpit_bg.webp) + eclipse ring with the full voice-state
 * machine (idle / listening / thinking / speaking / loading / error).
 *
 * This is the **prop-driven, IO-free** port (issue 153): `setState` is a pure prop,
 * `setPanelShift`/`setFovOpen` are layout facts, and `pause`/`resume` are the
 * render-loop stop that State B (a session detail covering the orb) drives. The
 * v1 audio analyser, conversation-mode palette swap and hit-testing are dropped —
 * `micLevel`/`audioLevel` stay pinned at 0 so the shader math is unchanged.
 */

import * as THREE from 'three'
import cockpitBgUrl from '../assets/cockpit_bg.webp'
import { SCENE_CONFIG } from '../sceneConfig'
import { BEAM_FRAG, BG_FRAG, BG_VERT, DISC_FRAG, DOT_FRAG, RING_FRAG, RING_VERT } from './shaders'
import type { OrbHandle, OrbOptions, OrbState } from './types'

const C = SCENE_CONFIG.eclipseOrb
const P = C.palette

// Lift a base colour toward white by `k` (0 = base, 1 = white). Every element
// in the scene is the single `palette.base` colour lifted by a fixed amount.
function lift(base: readonly [number, number, number], k: number): [number, number, number] {
  return [base[0] * (1 - k) + k, base[1] * (1 - k) + k, base[2] * (1 - k) + k]
}

// ── Smooth parameter helper ────────────────────────────────────────────────
class SP {
  v: number
  t: number
  s: number
  constructor(init: number, speed = C.lerpSpeed) {
    this.v = this.t = init
    this.s = speed
  }
  update(dt: number) {
    this.v += (this.t - this.v) * Math.min(this.s * dt, 1)
  }
  set(target: number) {
    this.t = target
  }
}

// ── Ring world radius (for reference) ──────────────────────────────────────
// uvRadius in UV space × plane half-width × mesh scale
const RING_WORLD_R = C.ring.uvRadius * (C.ring.planeSize / 2) * C.ring.scale

// ── Main factory ───────────────────────────────────────────────────────────
export function createEclipseOrb(canvas: HTMLCanvasElement, options: OrbOptions = {}): OrbHandle {
  const reducedMotion = options.reducedMotion ?? false
  const withBackdrop = options.backdrop ?? true
  let destroyed = false
  let rafId = 0
  // The loop runs only while `running`. `pause()` stops it (a real RAF cancel,
  // not a hidden canvas) and leaves the last frame frozen on the double buffer;
  // `resume()` restarts it. Under reduced motion it never starts — one frame only.
  let running = false
  let prevTime = 0

  // ── Renderer ─────────────────────────────────────────────────────────────
  // Reuse/obtain the canvas' WebGL2 context ourselves and clear the unpack
  // flip/premultiply flags before handing it to three. On a remount (HMR or a
  // variant switch) the disposed renderer leaves these set true from its 2D
  // texture uploads; three's constructor then eagerly builds its empty 3D/array
  // placeholders via texImage3D, which WebGL2 rejects when FLIP_Y is on. Passing
  // a pre-cleaned context silences the "texImage3D: FLIP_Y …" warnings.
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    // The dock orb (no backdrop) needs a transparent canvas so it sits on the
    // frosted panel; the full stage is opaque — it draws the mountain plate.
    alpha: !withBackdrop,
  }) as WebGL2RenderingContext | null
  // No WebGL2 (a headless CI runner without a GPU, an unsupported device): fail
  // soft with a no-op handle so the app and every story still mount and pass.
  if (!gl) {
    return {
      setState() {},
      setPanelShift() {},
      setFovOpen() {},
      pause() {},
      resume() {},
      destroy() {},
    }
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: true,
    alpha: !withBackdrop,
  })
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio * C.renderer.pixelRatioMult, C.renderer.pixelRatioCap),
  )
  renderer.setClearColor(C.renderer.clearColor, withBackdrop ? 1 : 0)

  // ── Camera ────────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(C.camera.fov, 1, C.camera.near, C.camera.far)
  camera.position.set(0, 0, C.camera.z)

  // ── Scene ─────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene()

  // ── Photo backdrop ────────────────────────────────────────────────────────
  const bgUniforms = {
    uTex: { value: null as THREE.Texture | null },
    uImgAspect: { value: C.background.imgW / C.background.imgH },
    uViewAspect: { value: 1 },
    uExposure: { value: 1.0 },
    uGlowI: { value: 0.0 },
    uShiftY: { value: C.background.shiftY },
    uBgZoom: { value: C.background.zoom },
    uMist: { value: 0.0 },
    uMistPower: { value: C.sceneMist.power },
    uMistInner: { value: C.sceneMist.inner },
    // Synthetic ground light source — all live-tunable from C.horizonGlow.
    uHorizonY: { value: C.horizonGlow.screenY },
    uHorizonX: { value: 0.5 },
    uImageHorizonV: { value: C.horizonGlow.imageHorizonV },
    uCoreBright: { value: C.horizonGlow.coreBrightness },
    uCoreWidth: { value: C.horizonGlow.coreWidth },
    uCoreHeight: { value: C.horizonGlow.coreHeight },
    uFlareBright: { value: C.horizonGlow.flareBrightness },
    uFlareWidth: { value: C.horizonGlow.flareWidth },
    uFlareHeight: { value: C.horizonGlow.flareHeight },
    uSkyBright: { value: C.horizonGlow.skyBrightness },
    uSkyWidth: { value: C.horizonGlow.skyWidth },
    uSkyReach: { value: C.horizonGlow.skyReach },
    uCoreColor: { value: new THREE.Vector3(...lift(P.base, P.coreLift)) },
    uGlowColor: { value: new THREE.Vector3(...lift(P.base, P.glowLift)) },
    uSceneLit: { value: 0.0 },
    uLiftGamma: { value: C.sceneLift.gamma },
    uLiftGammaMix: { value: C.sceneLift.gammaMix },
    uLiftLumScale: { value: C.sceneLift.lumScale },
    uLiftLumMix: { value: C.sceneLift.lumMix },
  }
  const bgMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: bgUniforms,
    }),
  )
  bgMesh.position.z = C.background.z
  bgMesh.renderOrder = C.background.renderOrder
  // Dock mode skips the mountain plate (and its 1.5MB texture) entirely — the
  // orb floats on a transparent canvas. bgUniforms are still updated each frame;
  // with the mesh out of the scene those writes are simply inert.
  if (withBackdrop) {
    scene.add(bgMesh)
    new THREE.TextureLoader().load(cockpitBgUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearMipmapLinearFilter // trilinear — prevents blur at high downscale ratios
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = true
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      bgUniforms.uTex.value = tex
      // The texture lands async; paint one fresh frame so a paused/reduced-motion
      // scene shows the mountains rather than the bare clear colour.
      if (!running) renderFrame()
    })
  }

  // Size the backdrop plane to a FIXED world size — the frustum height at the
  // reference `coverFov`, NOT the live camera.fov. This makes the mountains a real
  // scene object: changing camera.fov scales the orb and the mountains together
  // via perspective, instead of re-fitting the photo to keep it screen-static.
  const BG_DEPTH = camera.position.z - bgMesh.position.z
  function sizeBackdrop() {
    const h = 2 * BG_DEPTH * Math.tan(THREE.MathUtils.degToRad(C.background.coverFov / 2))
    bgMesh.scale.set(h * camera.aspect, h, 1)
    bgUniforms.uViewAspect.value = camera.aspect
  }

  // ── Eclipse interior disc ──────────────────────────────────────────────────
  // Opaque black fill so the backdrop's stars don't show through the circle.
  // Same geometry/position as the ring so its uv→radius mapping matches RING_R;
  // drawn after the backdrop but before the additive rim (renderOrder), with
  // normal alpha blending so it actually occludes (additive can't darken).
  const discUniforms = {
    uRadius: { value: C.ring.uvRadius },
    uFillInner: { value: C.ring.fillFeather },
    uOrbAlpha: { value: 1.0 },
  }
  const discMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(C.ring.planeSize, C.ring.planeSize),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: DISC_FRAG,
      uniforms: discUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  )
  discMesh.position.set(0, C.ring.posY, 0)
  discMesh.scale.set(C.ring.scale, C.ring.scale, 1)
  discMesh.renderOrder = C.ring.discRenderOrder
  scene.add(discMesh)

  // ── Eclipse ring ──────────────────────────────────────────────────────────
  const ringUniforms = {
    uTime: { value: 0 },
    uBright: { value: C.states.idle.bright },
    uGlow: { value: 0.0 },
    uPulse: { value: 0.0 },
    uBottom: { value: 0.0 },
    uSeg: { value: 0.0 },
    uSegAngle: { value: 0.0 },
    uBreath: { value: 0.0 },
    uSweep: { value: 0.0 },
    uSway: { value: 0.0 },
    uThink: { value: 0.0 },
    uThinkSpeed: { value: C.states.thinking.motion.speed },
    uThinkInward: { value: C.states.thinking.motion.inward },
    uThinkCount: { value: C.states.thinking.motion.lensCount },
    uThinkGlow: { value: C.states.thinking.motion.lensGlow },
    uEmitIn: { value: 0.0 },
    uEmitOut: { value: 0.0 },
    uEmitAll: { value: 0.0 },
    uActive: { value: 0.0 },
    uRippleFreq: { value: C.animation.ripple.freq },
    uRippleSpeed: { value: C.animation.ripple.speed },
    uRippleReach: { value: C.animation.ripple.reach },
    uCrescent: { value: C.animation.ripple.crescent },
    uListenAngle: { value: C.animation.ripple.listenAngle },
    uSpeakAngle: { value: C.animation.ripple.speakAngle },
    uRimColor: { value: new THREE.Vector3(...lift(P.base, P.rimLift)) },
    uOrbAlpha: { value: 1.0 },
  }
  const ringMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(C.ring.planeSize, C.ring.planeSize),
    new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: ringUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  ringMesh.position.set(0, C.ring.posY, 0)
  ringMesh.scale.set(C.ring.scale, C.ring.scale, 1)
  scene.add(ringMesh)

  // ── Beam + dot meshes ─────────────────────────────────────────────────────
  const CIRCLE_BOTTOM = C.ring.posY - RING_WORLD_R
  const BEAM_HEIGHT = CIRCLE_BOTTOM - C.dot.worldY
  const BEAM_MID_Y = (CIRCLE_BOTTOM + C.dot.worldY) / 2

  const beamUniforms = {
    uProgress: { value: 0.0 },
    uAlpha: { value: 1.0 },
    uCoreWidth: { value: C.beam.coreWidth },
    uHaloWidth: { value: C.beam.haloWidth },
    uHaloAmt: { value: C.beam.haloAmt },
    uFadeExp: { value: C.beam.fadeExp },
  }
  const beamMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(C.beam.planeW, BEAM_HEIGHT),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: beamUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  )
  beamMesh.position.set(0, BEAM_MID_Y, C.dot.worldZ)
  beamMesh.renderOrder = C.beam.renderOrder
  beamMesh.visible = false
  scene.add(beamMesh)

  const dotUniforms = {
    uAlpha: { value: 0.0 },
    uStarPoints: { value: C.dot.starPoints },
    uStarDepth: { value: C.dot.starDepth },
    uStarIrregularity: { value: C.dot.starIrregularity },
    uDotColor: { value: new THREE.Vector3(...lift(P.base, P.dotLift)) },
  }
  const dotMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(C.dot.planeSize, C.dot.planeSize),
    new THREE.ShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: dotUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }),
  )
  dotMesh.position.set(0, C.dot.worldY, C.dot.worldZ)
  dotMesh.renderOrder = C.dot.renderOrder
  dotMesh.visible = false
  scene.add(dotMesh)

  let beamProg = -1 // -1=inactive, 0→1=sweeping, 1=fading out
  let beamAlpha = 0 // 1→0 fade-out after sweep completes
  let dotAlpha = 0
  let haloReady = 0 // 0→1, opens only after beam lands

  // ── Scene palette ───────────────────────────────────────────────────────────
  // ONE base colour drives the whole scene (rim, dot, glow, core — each `base`
  // lifted toward white). It stays the cool eclipse blue except in `error`, where
  // it lerps to a hot red so the state reads as an alarm, not a dimmer idle. The
  // lerp (~80% in 0.5s) makes the switch a smooth flush, not a hard cut.
  const COLOR_LERP_SPEED = 4.0
  const sBaseR = new SP(P.base[0], COLOR_LERP_SPEED)
  const sBaseG = new SP(P.base[1], COLOR_LERP_SPEED)
  const sBaseB = new SP(P.base[2], COLOR_LERP_SPEED)

  // ── State + level inputs ──────────────────────────────────────────────────
  // Audio is out of scope for this port; the levels stay pinned at 0 so the
  // shader math (mic/TTS-reactive terms) is unchanged but simply contributes 0.
  let state: OrbState = 'idle'
  const micLevel = 0
  const audioLevel = 0

  // ── Smooth parameters ─────────────────────────────────────────────────────
  const sm = C.smoothing
  const sBright = new SP(C.states.idle.bright)
  const sGlow = new SP(0.0)
  const sPulse = new SP(0.0)
  const sBottom = new SP(0.0)
  const sSeg = new SP(0.0, sm.seg)
  const sThink = new SP(0.0, sm.think)
  const sEmitIn = new SP(0.0, sm.emit)
  const sEmitOut = new SP(0.0, sm.emit)
  const sEmitAll = new SP(0.0, sm.emit)
  const sActive = new SP(0.0, sm.emit)
  const sMist = new SP(0.0, sm.mist)
  const sSceneLit = new SP(0.0, sm.sceneLit)
  // Camera X shift: tracks the pixel offset so the orb centers in the visible gap.
  const sCamShiftPx = new SP(0.0, sm.panelShift)
  const sFov = new SP(C.camera.fov, C.camera.fovSpeed)
  const segAngle = 0
  let sweepAngle = 0
  let swayPhase = 0
  let swayAmp = C.animation.sway.idleAmp

  function applyState() {
    const isIdle = state === 'idle'
    sMist.set(isIdle ? 0.0 : 1.0)
    sSceneLit.set(isIdle ? 0.0 : 1.0)
    const s = C.states[state]
    sBright.set(s.bright)
    sGlow.set(s.glow)
    sPulse.set(s.pulse)
    sBottom.set(s.bottom)
    sSeg.set(s.seg)
    sThink.set(state === 'thinking' ? 1 : 0) // derived from state, not a per-state style field
    // Error flushes the whole scene red; every other state holds the cool base.
    const tint = state === 'error' ? P.error : P.base
    sBaseR.set(tint[0])
    sBaseG.set(tint[1])
    sBaseB.set(tint[2])
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    sizeBackdrop()
    // A resize while paused (or under reduced motion) still needs a fresh frame
    // at the new size — the loop isn't running to draw it.
    if (!running) renderFrame()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // ── Per-frame step ──────────────────────────────────────────────────────────
  function step(now: number) {
    if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return

    const t = now / 1000
    const dt = prevTime > 0 ? Math.min(t - prevTime, 0.1) : 0.016
    prevTime = t

    sBaseR.update(dt)
    sBaseG.update(dt)
    sBaseB.update(dt)
    const base: [number, number, number] = [sBaseR.v, sBaseG.v, sBaseB.v]
    bgUniforms.uCoreColor.value.set(...lift(base, P.coreLift))
    bgUniforms.uGlowColor.value.set(...lift(base, P.glowLift))
    ringUniforms.uRimColor.value.set(...lift(base, P.rimLift))
    dotUniforms.uDotColor.value.set(...lift(base, P.dotLift))

    sBright.update(dt)
    sGlow.update(dt)
    sPulse.update(dt)
    // Lens caustic snaps out fast (~0.2s) when leaving thinking, normal fade in.
    sThink.s = sThink.t < sThink.v ? 14 : sm.think
    sBottom.update(dt)
    sSeg.update(dt)
    sThink.update(dt)
    sMist.update(dt)
    sSceneLit.update(dt)
    sCamShiftPx.update(dt)
    sFov.update(dt)
    camera.fov = sFov.v
    camera.updateProjectionMatrix()

    // Shift the camera left so the orb drifts right toward the center of the
    // visible gap between panels. worldW is the frustum width at the ring plane.
    const worldW =
      2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect
    camera.position.x = -(sCamShiftPx.v / canvas.clientWidth) * worldW

    // Parallax-correct the horizon glow to sit directly under the dot on screen.
    // BG_DEPTH is fixed at init (camera.z_init + |bg.z|); the dot is at a different
    // depth. Derivation: equate the glow's NDC-x (via bg UV → world → screen) with
    // the dot's NDC-x to solve for the bg UV that tracks the dot.
    //   uHorizonX = 0.5 + shift * camZ * (dot.z − bg.z) / (dotDepth * BG_DEPTH)
    const _dotDepth = camera.position.z - C.dot.worldZ // cam_z + 0.5
    const _depthDiff = C.dot.worldZ - C.background.z // −0.5 − (−5) = 4.5, constant
    bgUniforms.uHorizonX.value =
      0.5 +
      ((sCamShiftPx.v / canvas.clientWidth) * camera.position.z * _depthDiff) /
        (_dotDepth * BG_DEPTH) +
      C.horizonGlow.xAdjust

    const inListen = state === 'listening'
    const an = C.animation
    const s = C.states[state]

    const mIdle = C.states.idle.motion
    const mListen = C.states.listening.motion
    const mSpeak = C.states.speaking.motion
    const idle = state === 'idle' ? Math.sin(t * mIdle.freq) * mIdle.amp : 0
    const listen = inListen
      ? sPulse.v * (mListen.pulseGain + mListen.pulseMod * Math.sin(t * mListen.pulseFreq))
      : 0
    const breath =
      state === 'speaking'
        ? Math.sin(t * mSpeak.breathFreq) * mSpeak.breathAmp + audioLevel * s.audio.breathAdd
        : idle
    const dynBot = sBottom.v + audioLevel * s.audio.bottomAdd
    const dynBright = sBright.v + micLevel * s.mic.brightAdd

    // Consistent glow across the active states, driven by the live sound level:
    // mic when listening, TTS when speaking, nothing when thinking (steady).
    const sound = state === 'listening' ? micLevel : state === 'speaking' ? audioLevel : 0
    const glowActive = state !== 'idle' // awake: every non-idle state keeps the baseline glow (no rim)

    sweepAngle += dt * (inListen ? an.sweep.listenSpeed : an.sweep.idleSpeed)
    const swayAmpTarget = inListen ? an.sway.listenAmp : an.sway.idleAmp
    swayAmp += (swayAmpTarget - swayAmp) * Math.min(an.sway.lerpSpd * dt, 1)
    swayPhase += dt * (inListen ? an.sway.listenPhaseSpd : an.sway.idlePhaseSpd)
    const drift =
      Math.sin(swayPhase) * an.drift.primaryAmp +
      Math.sin(swayPhase * an.drift.secondaryFreq + an.drift.secondaryPhase) * an.drift.secondaryAmp

    ringUniforms.uTime.value = t
    ringUniforms.uBright.value = dynBright
    ringUniforms.uGlow.value = sGlow.v * (an.glow.baseBright + sound * an.glow.soundGain)
    ringUniforms.uPulse.value = listen + sPulse.v * an.pulseVisualAmp
    ringUniforms.uBottom.value = dynBot
    ringUniforms.uSeg.value = sSeg.v
    ringUniforms.uSegAngle.value = segAngle
    ringUniforms.uBreath.value = breath
    ringUniforms.uSweep.value = sweepAngle
    ringUniforms.uSway.value = drift * swayAmp
    ringUniforms.uThink.value = sThink.v

    // Traveling ripples — inward (mic-driven) while listening, outward
    // (TTS-driven) while speaking. Amplitude smoothed so they ramp on switch.
    const rip = an.ripple
    sEmitIn.set(
      state === 'listening' ? rip.weight * (rip.listenBase + micLevel * rip.listenMic) : 0,
    )
    sEmitOut.set(
      state === 'speaking' ? rip.weight * (rip.speakBase + audioLevel * rip.speakAudio) : 0,
    )
    sEmitAll.set(state === 'thinking' ? rip.weight * rip.thinkBase : 0) // steady all-around pulse (no sound)
    sActive.set(glowActive ? 1 : 0)
    sEmitIn.update(dt)
    sEmitOut.update(dt)
    sEmitAll.update(dt)
    sActive.update(dt)
    ringUniforms.uEmitIn.value = sEmitIn.v
    ringUniforms.uEmitOut.value = sEmitOut.v
    ringUniforms.uEmitAll.value = sEmitAll.v
    ringUniforms.uActive.value = sActive.v
    ringUniforms.uListenAngle.value = rip.listenAngle
    ringUniforms.uSpeakAngle.value = rip.speakAngle

    // ── Beam sweep → fade out into dot ─────────────────────────────────────
    if (beamProg >= 0 && beamProg < 1) {
      beamProg = Math.min(1, beamProg + dt * C.beam.speed)
      const eased = beamProg * beamProg * (3 - 2 * beamProg)
      beamUniforms.uProgress.value = eased
      beamUniforms.uAlpha.value = 1.0
    } else if (beamProg >= 1 && beamAlpha > 0) {
      beamAlpha = Math.max(0, beamAlpha - dt * C.beam.fadeOutSpeed)
      beamUniforms.uAlpha.value = beamAlpha
      if (beamAlpha <= 0) beamMesh.visible = false
    }

    // ── Ground glow dot + halo gate ─────────────────────────────────────────
    const isActive = state !== 'idle'
    const beamLanded = isActive && beamProg >= 1
    const dotTarget = beamLanded ? 1.0 : 0.0
    haloReady += ((beamLanded ? 1.0 : 0.0) - haloReady) * Math.min(C.dot.haloDelaySpd * dt, 1)
    dotAlpha += (dotTarget - dotAlpha) * Math.min(C.dot.alphaLerpSpd * dt, 1)
    if (dotAlpha > 0.005) {
      dotMesh.visible = true
      const flickerBase =
        Math.sin(t * C.dot.flickerFreq + Math.sin(t * C.dot.flickerMod) * C.dot.flickerDepth) *
          0.5 +
        0.5
      const flickerAmt = C.dot.flickerBase + micLevel * C.dot.flickerMic
      dotUniforms.uAlpha.value = dotAlpha * (1.0 - flickerAmt * flickerBase)
    } else {
      dotMesh.visible = false
    }

    const activeT = sSceneLit.v
    bgUniforms.uExposure.value =
      1.0 +
      (dynBright - 0.55) * C.sceneExposure.brightMult +
      breath * C.sceneExposure.breathMult +
      activeT * C.sceneExposure.activeMult
    bgUniforms.uGlowI.value =
      haloReady *
      (C.sceneGlow.base +
        listen * C.sceneGlow.listenMult +
        breath * C.sceneGlow.breathMult +
        dynBot * C.sceneGlow.bottomMult +
        activeT * C.sceneGlow.activeMult)
    bgUniforms.uMist.value = sMist.v * C.sceneMist.strength
    bgUniforms.uSceneLit.value = activeT * haloReady

    renderer.render(scene, camera)
  }

  // Draw exactly one frame at the current wall-clock time (paused resize, reduced
  // motion, async texture arrival). Skipped once the scene is destroyed.
  function renderFrame() {
    if (destroyed) return
    step(performance.now())
  }

  // ── Loop control ────────────────────────────────────────────────────────────
  function loop(now: number) {
    if (destroyed || !running) return
    rafId = requestAnimationFrame(loop)
    if (document.hidden) return // page not visible → skip the draw, keep the schedule cheap
    step(now)
  }
  function start() {
    if (running || destroyed || reducedMotion) return
    running = true
    prevTime = 0
    rafId = requestAnimationFrame(loop)
  }
  function stop() {
    running = false
    cancelAnimationFrame(rafId)
  }

  // First paint + loop bootstrap. Reduced motion draws a single static frame and
  // never schedules; otherwise we paint once immediately (so a screenshot is never
  // a blank buffer) and start the loop.
  resize()
  renderFrame()
  if (!reducedMotion) start()

  // ── OrbHandle ─────────────────────────────────────────────────────────────
  return {
    setState(s) {
      const prev = state
      state = s
      applyState()
      if (prev === 'idle' && s !== 'idle') {
        beamProg = 0
        beamAlpha = 1.0
        beamMesh.visible = true
      }
      if (s === 'idle') {
        beamProg = -1
        beamAlpha = 0
        beamMesh.visible = false
      }
      if (!running) renderFrame() // paused/reduced-motion: reflect the new state at once
    },
    setPanelShift(px) {
      sCamShiftPx.set(px)
      if (!running) renderFrame()
    },
    setFovOpen(open) {
      sFov.set(open ? C.camera.fovOpen : C.camera.fov)
      if (!running) renderFrame()
    },
    pause() {
      if (!running) return
      stop()
      renderFrame() // freeze on a current frame
    },
    resume() {
      start()
    },
    destroy() {
      destroyed = true
      stop()
      ro.disconnect()
      renderer.dispose()
    },
  }
}
