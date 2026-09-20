export const FIRST_FRAME_TIMEOUT_MS = 10_000
// Claude Code drops input that arrives before its interface is up. The end of its first
// synchronized frame is the earliest point measured to accept a paste, about 1 s after spawn (#2002).
const FIRST_FRAME = '\u001b[?2026l'

type Schedule = (callback: () => void, milliseconds: number) => void

// `ready` resolves once `claude` has drawn its first frame, or when the time limit passes without one.
export function firstFrame(schedule: Schedule) {
  let drawn = false
  let release = () => {}
  const ready = new Promise<void>((resolve) => {
    release = resolve
    schedule(resolve, FIRST_FRAME_TIMEOUT_MS)
  })
  return {
    ready,
    see(screen: string) {
      if (drawn || !screen.includes(FIRST_FRAME)) return
      drawn = true
      release()
    },
  }
}
