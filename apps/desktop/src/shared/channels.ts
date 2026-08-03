import type { GitFacts, GitRequest } from './git'
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

// The project's primary checkout (ADR-0004: main runs git). Request/response rather than a
// projection: git's answer is a snapshot the renderer asks for when it opens the group, not a
// stream main can push, because nothing tells main when a branch moved outside the app.
export const GIT_FACTS_CHANNEL = 'cockpit:git-facts'
export const GIT_OPERATION_CHANNEL = 'cockpit:git-operation'

// The two acts Argo owns above the Session (ADR-0017), plus ⌘N's spawn. Main owns the folder
// dialog and the registry file, so the renderer names the act and never the mechanism.
export const PROJECT_REGISTER_CHANNEL = 'cockpit:project-register'
export const PROJECT_ACTIVATE_CHANNEL = 'cockpit:project-activate'
export const SESSION_SPAWN_CHANNEL = 'cockpit:session-spawn'

/** What an act reports back: it happened, or the reason it did not — in the underlying tool's
 * own words where the tool refused, so the shell never invents an explanation. */
export interface CommandResult {
  ok: boolean
  detail: string
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
  /** Read one Project's primary checkout. `null` means the folder is no git repository, which
   * the shell renders by hiding the whole git group. */
  readGitFacts(projectId: string): Promise<GitFacts | null>
  runGitOperation(request: GitRequest): Promise<CommandResult>
  /** Register a folder as a Project. Main opens the folder picker, so the renderer has no
   * path to supply and nothing to validate. */
  registerProject(): Promise<CommandResult>
  activateProject(projectId: string): Promise<CommandResult>
  /** Spawn a session in the ACTIVE project's root folder — zero-config, no arguments to pick. */
  spawnSession(): Promise<CommandResult>
}
