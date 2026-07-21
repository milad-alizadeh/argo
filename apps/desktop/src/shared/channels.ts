import type { ProjectionDelta } from './projection'

// IPC channel names for the main → renderer projection (ADR-0005). Shared so the
// send side (main) and the receive side (preload) can never disagree on the string.
export const PROJECTION_CHANNEL = 'cockpit:projection'
export const PROJECTION_READY_CHANNEL = 'cockpit:projection-ready'

// The steering PTY (ADR-0005's companion to the projection): the Console's live channel is a
// real shell. A renderer attaches with its viewport size; main spawns the PTY and streams its
// output, while keystrokes and resizes flow back. Names are shared so all three processes
// agree on the string.
export const TERMINAL_ATTACH_CHANNEL = 'cockpit:terminal-attach'
export const TERMINAL_DATA_CHANNEL = 'cockpit:terminal-data'
export const TERMINAL_INPUT_CHANNEL = 'cockpit:terminal-input'
export const TERMINAL_RESIZE_CHANNEL = 'cockpit:terminal-resize'

/** A terminal's size in character cells — what the PTY is told, derived from the viewport. */
export interface TerminalSize {
  cols: number
  rows: number
}

/** The renderer's handle on the session's live shell PTY, returned by `openTerminal`. */
export interface TerminalSession {
  /** Send keystrokes to the shell. */
  write(data: string): void
  /** Match the PTY to the viewport after a fit. */
  resize(size: TerminalSize): void
  /** Detach this view: stop delivery and drop the listener. */
  dispose(): void
}

// The preload bridge the renderer sees as `window.cockpit`. The renderer subscribes to the
// projection and opens the live terminal; main streams deltas (a snapshot first, then live
// patches) and pipes the shell.
export interface CockpitBridge {
  subscribeProjection(listener: (delta: ProjectionDelta) => void): () => void
  /** Attach to the session's live shell PTY (ADR-0005). Main spawns the shell on first
   * attach and streams its output to `onData` — a live shell, so there is no snapshot to
   * replay. The returned session writes keystrokes back and resizes the PTY to the viewport. */
  openTerminal(size: TerminalSize, onData: (chunk: string) => void): TerminalSession
}
