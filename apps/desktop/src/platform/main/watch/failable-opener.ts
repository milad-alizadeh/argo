import type { WatchOpener } from './watch-paths'

// The one thing a real watch cannot be made to do. Deleting the watched root emits an ordinary
// change event and leaves the handle working (probed on macOS 26), and an unmount needs a volume,
// so the `error` path is driven through this stand-in. Everything else in these proofs is real.
export function failableOpener() {
  let onEvent: () => void = () => {}
  let onError: () => void = () => {}
  let opens = 0
  const open: WatchOpener = (_root, event) => {
    opens += 1
    onEvent = event
    return {
      close: () => {},
      on: (_name: 'error', listener: () => void) => {
        onError = listener
      },
    }
  }
  return {
    get opens() {
      return opens
    },
    open,
    emit: () => onEvent(),
    fail: () => onError(),
  }
}
