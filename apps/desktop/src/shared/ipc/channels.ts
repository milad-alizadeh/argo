import type { GitFacts, GitRequest } from '../git/facts'
import type { ProjectionDelta } from '../projection/projection'
import type { Cli } from '../session/cli'

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

// The acts Argo owns above the Session (ADR-0017), plus ⌘N's spawn. Main owns the folder
// dialog and the registry file, so the renderer names the act and never the mechanism.
//
// Choosing and creating are TWO channels, not one, because the connect panel puts a decision
// between them: a folder is all a Project takes, so `Create project` lights up the moment one
// is chosen and the user may connect a provider first (#165). One combined act would register
// on the picker's OK and leave the panel with nothing left to enable.
export const PROJECT_CHOOSE_FOLDER_CHANNEL = 'cockpit:project-choose-folder'
export const PROJECT_CREATE_CHANNEL = 'cockpit:project-create'
export const PROJECT_ACTIVATE_CHANNEL = 'cockpit:project-activate'
export const PROJECT_SET_CLI_CHANNEL = 'cockpit:project-set-cli'
export const SESSION_SPAWN_CHANNEL = 'cockpit:session-spawn'

// Connecting the Work Item provider (ADR-0018). Two channels rather than one because the
// device flow has something to SAY mid-flight: the invoke settles only when the user has
// finished at GitHub, and the code they must type is pushed the moment GitHub issues it, so
// the connect panel shows it rather than spinning blind.
export const WORK_ITEMS_CONNECT_CHANNEL = 'cockpit:work-items-connect'
export const WORK_ITEMS_DEVICE_CODE_CHANNEL = 'cockpit:work-items-device-code'

/** What the user must act on to complete a device-flow sign-in: the code to type and where to
 * type it, plus how long the code stays good for. */
export interface DeviceCodePrompt {
  userCode: string
  verificationUri: string
  /** Seconds the provider will honour this code for. */
  expiresIn: number
}

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
  /** Open main's folder picker. `detail` is the chosen folder; `ok: false` means the user
   * cancelled, which leaves whatever folder the panel already had rather than clearing it. */
  chooseProjectFolder(): Promise<CommandResult>
  /** Register a chosen folder as a Project. A folder is all it takes and git is not required
   * (#165): an empty greenfield directory creates a Project at the observation floor. */
  createProject(path: string): Promise<CommandResult>
  activateProject(projectId: string): Promise<CommandResult>
  /** Which agent CLI ⌘N spawns in this Project (#186). Per Project, because nobody runs two
   * editors at once, and kept out of spawn so ⌘N stays zero-config. */
  setProjectCli(projectId: string, cli: Cli): Promise<CommandResult>
  /** Spawn a session in the ACTIVE project's root folder — zero-config, no arguments to pick. */
  spawnSession(): Promise<CommandResult>
  /** Run the Work Item provider's device-flow sign-in. `onCode` fires once, as soon as the
   * provider issues the code, and the promise settles only when the grant completes, expires
   * or is refused — so the panel waits visibly rather than blind. */
  connectWorkItems(onCode: (prompt: DeviceCodePrompt) => void): Promise<CommandResult>
}
