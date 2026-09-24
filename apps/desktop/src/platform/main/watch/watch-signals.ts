import type { BrowserWindow, PowerMonitor } from 'electron'
import type { WatchedSource } from './watch-source'

// The two moments the app may have been blind without any watch saying so. Each announces once, so
// neither settles: the tree watch owns the settle window because only a write arrives in a burst.
//
// Focus is the one a reader feels. Whatever a lost FSEvents subscription missed, looking at the
// window again reads it.
export function watchWindowFocus(window: BrowserWindow): WatchedSource {
  return (onChanged) => {
    window.on('focus', onChanged)
    return () => void window.removeListener('focus', onChanged)
  }
}

// `resume` is emitted when the machine wakes. A write that landed while it slept, and a watch that
// the sleep quietly killed, are both caught here.
export function watchSystemResume(powerMonitor: PowerMonitor): WatchedSource {
  return (onChanged) => {
    powerMonitor.on('resume', onChanged)
    return () => void powerMonitor.removeListener('resume', onChanged)
  }
}

export type IntervalScheduler = (callback: () => void, ms: number) => { clear: () => void }

const realInterval: IntervalScheduler = (callback, ms) => {
  const timer = setInterval(callback, ms)
  timer.unref?.()
  return { clear: () => clearInterval(timer) }
}

// A read a reader never triggers: focus and resume are both moments a person is present for, but a
// Session left running while Argo sits untouched in the background gets neither. FSEvents can lose
// the one notification that would have told the Session list about it (#2414), so this is the backstop
// that bounds how long that loss can hide a Session, whether or not anyone looks at the window again.
export const SESSION_LIST_BACKSTOP_MS = 60_000

export function watchPeriodically(
  intervalMs: number = SESSION_LIST_BACKSTOP_MS,
  schedule: IntervalScheduler = realInterval,
): WatchedSource {
  return (onChanged) => {
    const scheduled = schedule(onChanged, intervalMs)
    return () => scheduled.clear()
  }
}
