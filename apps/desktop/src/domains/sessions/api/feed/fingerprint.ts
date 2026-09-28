// Ids cross the Session IPC boundary, where identifiers are capped at 256 characters, so a long
// value is named by a bounded, deterministic fingerprint: two independent 32-bit passes, with no
// Node API, because this module is also renderer-safe.
function pass(value: string, seed: number) {
  let hash = seed
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function fingerprint(value: string): string {
  return `${pass(value, 0x811c9dc5)}${pass(value, 0x9e3779b9)}`
}
