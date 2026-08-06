import type { GitFacts, GitRequest } from '../git/facts'
import type { ProjectionDelta } from '../projection/projection'

// IPC channel names for the main → renderer projection (ADR-0005). Shared so the
// send side (main) and the receive side (preload) can never disagree on the string.
export const PROJECTION_CHANNEL = 'cockpit:projection'
export const PROJECTION_READY_CHANNEL = 'cockpit:projection-ready'

// The steering PTY (ADR-0005's companion to the projection): a session's Dock is THE AGENT'S OWN
// terminal (#323), not a sibling shell in the same folder. A renderer attaches with the SESSION it
// is attaching for plus its viewport size; main resolves that session to the agent PTY it spawned,
// so two open sessions steer their own agents and never each other's. A session whose agent Argo
// does not own — external, or orphaned after a restart — has no PTY, and the attach is a no-op.
// Names are shared so all three processes agree on the string.
export const TERMINAL_ATTACH_CHANNEL = 'cockpit:terminal-attach'
export const TERMINAL_DATA_CHANNEL = 'cockpit:terminal-data'
export const TERMINAL_INPUT_CHANNEL = 'cockpit:terminal-input'
export const TERMINAL_RESIZE_CHANNEL = 'cockpit:terminal-resize'

/** Which session's terminal an attach/input/resize is for, plus the size where one is carried. The id
 * travels on every message because one window holds many sessions and each keeps its own PTY. */
export interface TerminalAttachRequest {
  sessionId: string
  size: TerminalSize
}

/** A terminal's size in character cells — what the PTY is told, derived from the viewport. */
export interface TerminalSize {
  cols: number
  rows: number
}

/** The renderer's handle on the session's agent PTY, returned by `openTerminal`. */
export interface TerminalSession {
  /** Send keystrokes to the agent. */
  write(data: string): void
  /** Match the PTY to the viewport after a fit. */
  resize(size: TerminalSize): void
  /** Detach this view: stop delivery and drop the listener. The agent keeps running. */
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
// patches) and pipes the agent's PTY.
export interface CockpitBridge {
  subscribeProjection(listener: (delta: ProjectionDelta) => void): () => void
  /** Attach to ONE session's agent PTY (ADR-0005) — the terminal the CLI itself is running on.
   * Main streams its output to `onData`, replaying the recent tail first so a Dock opened
   * mid-flight is not blank, and the returned handle types keystrokes back and resizes it.
   * Detaching leaves the agent running. A session Argo does not own delivers nothing. */
  openTerminal(
    sessionId: string,
    size: TerminalSize,
    onData: (chunk: string) => void,
  ): TerminalSession
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
