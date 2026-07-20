import type { RibbonModel, RibbonNodeKey, RibbonNodeState, TerminalState } from './ribbonModel'
import type { SessionFacts, SessionLifecycle } from './sessionFacts'

// The rail row's word — a POINTER into the ribbon's head node, never a value of its
// own. Tone is a name the row resolves to a `--status-*` token; no colour lives here.

export type RailTone = 'run' | 'amber' | 'mist' | 'gray' | 'red' | 'stale' | 'landed'

export type RailIcon =
  | 'arrow-line-up'
  | 'check'
  | 'circle'
  | 'circle-notch'
  | 'gear'
  | 'git-commit'
  | 'git-merge'
  | 'git-pull-request'
  | 'prohibit'
  | 'user'
  | 'warning'
  | 'x'

export interface RailStatus {
  word: string
  tone: RailTone
  icon: RailIcon
}

const LIFECYCLE_STATUS: Record<SessionLifecycle, RailStatus> = {
  running: { word: 'Running', tone: 'run', icon: 'circle-notch' },
  'needs-input': { word: 'Needs input', tone: 'amber', icon: 'warning' },
  done: { word: 'Done', tone: 'mist', icon: 'check' },
  failed: { word: 'Failed', tone: 'red', icon: 'x' },
  queued: { word: 'Queued', tone: 'gray', icon: 'circle' },
  orphaned: { word: 'Orphaned', tone: 'stale', icon: 'circle' },
}

const TERMINAL_STATUS: Record<TerminalState, RailStatus> = {
  merged: { word: 'Landed', tone: 'landed', icon: 'git-merge' },
  closed: { word: 'Closed', tone: 'stale', icon: 'prohibit' },
}

// Keyed by the head node and the state it is in — the row can only ever speak for
// the stage R1 already chose, so it cannot re-rank the nodes behind the ribbon's
// back. A pair absent from the table wants nothing from you (`now`/`wait`/`done`),
// which is where the Session's own triage word belongs.
const HEAD_STATUS: Partial<
  Record<`${RibbonNodeKey}:${RibbonNodeState}`, RailStatus | ((facts: SessionFacts) => RailStatus)>
> = {
  'commits:gate': { word: 'Commit ready', tone: 'amber', icon: 'git-commit' },
  'commits:sync': (facts) => ({
    word: `↑${facts.unpushed} unpushed`,
    tone: 'run',
    icon: 'arrow-line-up',
  }),
  'pr:gate': { word: 'Create PR ready', tone: 'amber', icon: 'git-pull-request' },
  'pr:auto': { word: 'Opening PR · auto', tone: 'run', icon: 'gear' },
  // CI only runs against a PR (R4), so the row names the PR triage is watching.
  'ci:now': (facts) =>
    facts.pr
      ? { word: `PR #${facts.pr.num} · CI`, tone: 'run', icon: 'git-pull-request' }
      : LIFECYCLE_STATUS[facts.lifecycle],
  'ci:fail': { word: 'CI failing', tone: 'amber', icon: 'warning' },
  'review:now': { word: 'In review', tone: 'run', icon: 'user' },
  'review:warn': { word: 'Changes requested', tone: 'amber', icon: 'user' },
  'merge:gate': { word: 'Ready to merge', tone: 'amber', icon: 'git-pull-request' },
  'merge:auto': { word: 'Auto-merge armed', tone: 'run', icon: 'gear' },
}

// Takes the model the ribbon is already rendering, so the row cannot be derived
// from a second, differently-timed reading of the same facts.
export function railStatus(facts: SessionFacts, model: RibbonModel | null): RailStatus {
  if (!model) return LIFECYCLE_STATUS[facts.lifecycle]
  if (model.terminal) return TERMINAL_STATUS[model.terminal]

  const status = HEAD_STATUS[`${model.head}:${model.nodes[model.head]}`]
  if (!status) return LIFECYCLE_STATUS[facts.lifecycle]
  return typeof status === 'function' ? status(facts) : status
}
