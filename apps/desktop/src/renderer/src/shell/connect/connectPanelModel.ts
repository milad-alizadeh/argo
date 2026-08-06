import type { Cli, DeviceCodePrompt, GrantState } from '@shared'

// What the connect panel renders (#165 / #265). Onboarding IS creating a Project (ADR-0015),
// so this one model serves both entries: a brand-new Project and Project Settings re-opened on
// an existing one, which differ in their call to action and in one extra row, not in kind.
//
// The three rows are INDEPENDENT and complete in any order — none of them gates another, and a
// folder alone already makes a working Project at the observation floor. That is why `canCreate`
// reads the folder and nothing else.

export const CONNECT_STATES = [
  'welcome',
  'fresh',
  'direct',
  'connecting',
  'partial',
  'wired',
  'error',
] as const

/**
 * `welcome` — the first screen, before anything is asked for.
 * `fresh` — the panel with nothing set.
 * `direct` — a folder and nothing else: the observation floor, honestly usable.
 * `connecting` — the device code is showing and the panel is waiting on the browser.
 * `partial` — some rows done, the rest still offered, the Project already usable.
 * `wired` — folder, provider and companion plugin all in place.
 * `error` — the grant expired or was revoked; the panel is also the reconnect surface.
 */
export type ConnectState = (typeof CONNECT_STATES)[number]

/** Which entry opened the panel. The rows are the same either way; only the call to action and
 * the Agent/CLI row differ, which is what "Project Settings IS this panel" means. */
export type ConnectMode = 'onboarding' | 'settings'

/**
 * `installed` — the companion plugin is loaded, so Argo can see permission prompts and steer.
 * `unavailable` — Argo ships no plugin to install yet, which is a different thing from the
 * user declining to install one and is said in those words rather than offered as a button.
 *
 * The derivation reads both because `wired` is the design target (ADR-0016) and the panel has
 * to be able to reach it; what is missing today is the artifact, not the rung.
 */
export type PluginState = 'installed' | 'unavailable'

/** One of the three rows, told as what the user gets rather than what tier it lights up:
 * honesty tiers are an internal attribute and never reach the screen (#165). */
export interface ConnectRowView {
  key: 'folder' | 'connections' | 'plugin'
  title: string
  /** The plain benefit of doing this, in the user's terms. */
  benefit: string
  /** What is set, or `null` when the row is still an offer. */
  value: string | null
  done: boolean
  /** The row's button, or `null` where there is nothing Argo can do yet. */
  action: string | null
}

export interface ConnectPanelModel {
  state: ConnectState
  /** What the panel calls itself. The two entries differ in name because one creates the
   * Project and the other returns to it, not because they are two surfaces. */
  title: string
  rows: ConnectRowView[]
  /** The primary button: `Create project` for a Project that does not exist yet, `Done` for one
   * that does. Enabled the moment a folder is set, so connections are an upgrade, never a gate. */
  cta: { label: string; enabled: boolean }
  /** The code to type and where to type it, while a sign-in is in flight. */
  device: DeviceCodePrompt | null
  /** Which agent CLI this Project spawns. Project Settings only: onboarding has no Project to
   * set it on yet, and ⌘N is zero-config either way (#186). */
  cli: Cli | null
}

export interface ConnectPanelInput {
  mode: ConnectMode
  /** True while the Welcome screen is showing. It is a screen, not a step: nothing is gated
   * behind it and it never returns once passed. */
  welcoming: boolean
  /** The chosen folder, whether or not the Project has been created from it yet. */
  folder: string | null
  grant: GrantState
  plugin: PluginState
  device: DeviceCodePrompt | null
  cli: Cli | null
}

export function buildConnectPanelModel(input: ConnectPanelInput): ConnectPanelModel {
  const rows = [folderRow(input), connectionsRow(input), pluginRow(input.plugin)]
  const settings = input.mode === 'settings'
  return {
    state: connectState(input, rows),
    title: settings ? 'Project settings' : 'Set up your project',
    rows,
    cta: {
      label: settings ? 'Done' : 'Create project',
      enabled: settings || input.folder !== null,
    },
    device: input.device,
    cli: settings ? input.cli : null,
  }
}

// Ordered by what beats what, not by row order: the panel is also the reconnect surface, so a
// refused grant outranks whatever else is set, and a sign-in in flight outranks the tally
// because the user is mid-act and the panel owes them the code.
function connectState(input: ConnectPanelInput, rows: ConnectRowView[]): ConnectState {
  if (input.welcoming) return 'welcome'
  if (input.grant === 'needs-reconnect') return 'error'
  if (input.device !== null) return 'connecting'

  const done = rows.filter((row) => row.done).length
  if (done === 0) return 'fresh'
  if (done === rows.length) return 'wired'
  // A folder alone is not a half-finished setup: it is the observation floor, which the spec
  // names as its own state precisely because it is a place to stop rather than pass through.
  return done === 1 && input.folder !== null ? 'direct' : 'partial'
}

// A Project's folder is its scope and its id's one mutable attribute, so re-pointing it is a
// RELOCATE rather than a re-pick (CONTEXT.md L1) — a different act, owned by the failure policy
// that has to offer it when a folder vanishes. Project Settings therefore reports the folder
// and offers no button, instead of a `Change folder` that would quietly do nothing.
function folderRow(input: ConnectPanelInput): ConnectRowView {
  return {
    key: 'folder',
    title: 'Project folder',
    benefit: 'Argo watches this folder for agent sessions and shows you the files in it.',
    value: input.folder,
    done: input.folder !== null,
    action: input.mode === 'settings' ? null : chooseFolderLabel(input.folder),
  }
}

const chooseFolderLabel = (folder: string | null): string =>
  folder === null ? 'Choose folder' : 'Choose a different folder'

function connectionsRow(input: ConnectPanelInput): ConnectRowView {
  const connected = input.grant === 'connected'
  return {
    key: 'connections',
    title: 'GitHub',
    benefit: 'See your backlog, your pull requests and their checks next to the work.',
    value: connected ? 'Signed in' : null,
    done: connected,
    action: signInLabel(input.grant),
  }
}

function signInLabel(grant: GrantState): string {
  switch (grant) {
    case 'none':
      return 'Sign in to GitHub'
    case 'connected':
      return 'Sign in again'
    case 'needs-reconnect':
      return 'Reconnect'
  }
}

// The one row Argo has nothing to offer for yet: there is no companion plugin to install, so
// the row states the benefit and says so plainly rather than showing a button that does
// nothing. An install action arrives with the plugin, not before it.
function pluginRow(plugin: PluginState): ConnectRowView {
  const installed = plugin === 'installed'
  return {
    key: 'plugin',
    title: 'Companion plugin',
    benefit: 'Lets Argo see what an agent is waiting on and steer it, not just watch it.',
    value: installed ? 'Installed' : 'Not available yet',
    done: installed,
    action: null,
  }
}
