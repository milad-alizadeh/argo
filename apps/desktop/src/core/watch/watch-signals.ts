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
