// The contract between the packaged app and the driver that launches it, in one place because it
// spans a bundling boundary: `src/` is compiled into the app by Vite, `scripts/` runs as plain
// node outside it. Written twice, a rename on one side makes the driver report "the app printed no
// ARGO_PTY_ACCEPTANCE line; node-pty may have failed to load" — a false diagnosis naming the one
// thing that is fine. [#1769](https://github.com/milad-alizadeh/argo/issues/1769).

/** The app prints exactly one line starting with this; everything after it is the JSON result. */
export const RESULT_PREFIX = 'ARGO_PTY_ACCEPTANCE '

/** Set to '1' to make the packaged app run the acceptance boundary instead of opening a window. */
export const ACCEPTANCE_ENV = 'ARGO_PTY_ACCEPTANCE'

/** Set to '1' to drop the endurance check. The driver decides this; see `resultFailures`. */
export const SKIP_ENDURANCE_ENV = 'ARGO_PTY_SKIP_ENDURANCE'

// The #1749 boundary names 600, and the number is the assertion: node-pty 1.1.0 dies at about 497
// on macOS, where `kern.tty.ptmx_max` is 511. A run that did fewer has not tested the thing.
export const CYCLES = 600
