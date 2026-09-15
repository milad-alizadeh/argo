// One run's readings, reduced to the numbers a reader compares: frame timing against the
// display's own period, blank frames, and the long frames with the scripts that caused them.
import type { FrameSample, LongFrame } from './frame-recorder'

const WORST_FRAMES = 5
const TOP_SCRIPTS = 8

const round = (value: number) => Math.round(value * 10) / 10

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return (
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))] ?? 0
  )
}

function frameTiming(frames: FrameSample[], periodMs: number) {
  const deltas = frames.slice(1).map((frame, index) => frame.at - (frames[index]?.at ?? frame.at))
  // A frame that took 2.1 periods skipped one vsync: the reader saw the previous frame twice.
  const dropped = deltas.reduce(
    (total, delta) => total + Math.max(0, Math.round(delta / periodMs) - 1),
    0,
  )
  return {
    displayHz: Math.round(1000 / periodMs),
    painted: frames.length,
    dropped,
    p50Ms: round(percentile(deltas, 0.5)),
    p95Ms: round(percentile(deltas, 0.95)),
    p99Ms: round(percentile(deltas, 0.99)),
    worstMs: round(deltas.reduce((worst, delta) => Math.max(worst, delta), 0)),
  }
}

// The compositor scrolls on without the main thread, so between two frames the reader sees empty
// space wherever the scroll outran the rows mounted at the earlier one. Travel is capped at the
// gesture's own pace, so a scroll-anchoring correction does not count as movement.
function exposedPx(from: FrameSample, to: FrameSample, speed: number) {
  const moved = to.scrollTop - from.scrollTop
  const travel = Math.min(Math.abs(moved), (speed * (to.at - from.at)) / 1000)
  const reach = moved > 0 ? from.reachBelowPx : from.reachAbovePx
  return reach === null ? 0 : Math.max(0, Math.round(travel - reach))
}

function blankFrames(frames: FrameSample[], speed: number) {
  const exposed = frames
    .slice(1)
    .map((frame, index) => exposedPx(frames[index] ?? frame, frame, speed))
    .filter((pixels) => pixels > 0)
  const painted = frames.filter((frame) => frame.blankPx > 0)
  return {
    // Frames the main thread itself painted with part of the viewport empty.
    paintedFrames: painted.length,
    worstPaintedPx: painted.reduce((worst, frame) => Math.max(worst, frame.blankPx), 0),
    // Frame gaps where the compositor scrolled past the mounted rows: the white flash.
    exposedFrames: exposed.length,
    percentOfFrames: frames.length ? round((exposed.length / frames.length) * 100) : 0,
    worstExposedPx: exposed.reduce((worst, pixels) => Math.max(worst, pixels), 0),
  }
}

function longFrames(entries: LongFrame[]) {
  const scripts = new Map<string, { ms: number; forcedLayoutMs: number; count: number }>()
  for (const script of entries.flatMap((entry) => entry.scripts)) {
    const key = `${script.invoker} → ${script.source}`
    const total = scripts.get(key) ?? { ms: 0, forcedLayoutMs: 0, count: 0 }
    scripts.set(key, {
      ms: total.ms + script.duration,
      forcedLayoutMs: total.forcedLayoutMs + script.forcedLayoutMs,
      count: total.count + 1,
    })
  }
  return {
    count: entries.length,
    blockingMs: round(entries.reduce((total, entry) => total + entry.blockingDuration, 0)),
    worst: [...entries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, WORST_FRAMES)
      .map((entry) => ({
        ms: round(entry.duration),
        blockingMs: round(entry.blockingDuration),
        scripts: entry.scripts.map((script) => `${round(script.duration)}ms ${script.source}`),
      })),
    scripts: [...scripts]
      .sort((a, b) => b[1].ms - a[1].ms)
      .slice(0, TOP_SCRIPTS)
      .map(([name, total]) => ({
        name,
        ms: round(total.ms),
        forcedLayoutMs: round(total.forcedLayoutMs),
        count: total.count,
      })),
  }
}

export function summariseRun(
  recording: { frames: FrameSample[]; longFrames: LongFrame[] },
  pace: { periodMs: number; speed: number },
) {
  return {
    frames: frameTiming(recording.frames, pace.periodMs),
    blank: blankFrames(recording.frames, pace.speed),
    longFrames: longFrames(recording.longFrames),
  }
}
