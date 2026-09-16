// Whether the person reached the current element by key or by pointer. Chromium matches
// `:focus-visible` on a contenteditable that code focused, so restoring the window's focus draws a
// ring nobody asked for; only the last real input says which it was (#2262). Pointer is the
// opening assumption, so a Session that focuses its composer on mount starts ringless.
let lastInput: 'keyboard' | 'pointer' = 'pointer'

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      lastInput = 'pointer'
    },
    true,
  )
  document.addEventListener(
    'keydown',
    () => {
      lastInput = 'keyboard'
    },
    true,
  )
}

export function lastInputWasKeyboard() {
  return lastInput === 'keyboard'
}
