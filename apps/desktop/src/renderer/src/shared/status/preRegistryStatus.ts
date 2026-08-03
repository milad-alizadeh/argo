import type {
  LifecycleModel,
  LifecycleNodeKey,
  LifecycleNodeState,
  SessionFacts,
  SessionStatus,
  TerminalState,
} from '@shared'
import type { RosterIcon, RosterTone } from './rosterStatus'

// DEAD ON ARRIVAL (issue 267 Phase B). This is the pre-registry word table: its words
// (`Needs input`, `Done`, `Landed`, `Commit ready`, …) contradict
// `docs/designs/cockpit-status-vocabulary.md`, which `rosterStatus.ts` now derives instead. It
// survives only because `domains/roster` and `SessionScreen` still render it, and issue 267 Phase C
// deletes those surfaces — this file goes with them. Nothing new may read it.

export interface RosterStatus {
  word: string
  tone: RosterTone
  icon: RosterIcon
}

export const SESSION_STATUS: Record<SessionStatus, RosterStatus> = {
  running: { word: 'Running', tone: 'run', icon: 'circle-notch' },
  permission: { word: 'Needs you', tone: 'amber', icon: 'warning' },
  asking: { word: 'Needs you', tone: 'amber', icon: 'warning' },
  idle: { word: 'Idle', tone: 'gray', icon: 'circle' },
  stopped: { word: 'Failed', tone: 'red', icon: 'x' },
  ended: { word: 'Ended', tone: 'stale', icon: 'circle' },
}

const TERMINAL_STATUS: Record<TerminalState, RosterStatus> = {
  merged: { word: 'Landed', tone: 'landed', icon: 'git-merge' },
  closed: { word: 'Closed', tone: 'stale', icon: 'prohibit' },
}

const HEAD_STATUS: Partial<
  Record<
    `${LifecycleNodeKey}:${LifecycleNodeState}`,
    RosterStatus | ((facts: SessionFacts) => RosterStatus)
  >
> = {
  'commits:gate': { word: 'Commit ready', tone: 'amber', icon: 'git-commit' },
  'commits:sync': (facts) => ({
    word: `↑${facts.unpushed} unpushed`,
    tone: 'run',
    icon: 'arrow-line-up',
  }),
  'pr:gate': { word: 'Create PR ready', tone: 'amber', icon: 'git-pull-request' },
  'pr:auto': { word: 'Opening PR · auto', tone: 'run', icon: 'gear' },
  'ci:now': (facts) =>
    facts.pr
      ? { word: `PR #${facts.pr.num} · CI`, tone: 'run', icon: 'git-pull-request' }
      : SESSION_STATUS[facts.status],
  'ci:fail': { word: 'CI failing', tone: 'amber', icon: 'warning' },
  'review:now': { word: 'In review', tone: 'run', icon: 'user' },
  'review:warn': { word: 'Changes requested', tone: 'amber', icon: 'user' },
  'merge:gate': { word: 'Ready to merge', tone: 'amber', icon: 'git-pull-request' },
  'merge:auto': { word: 'Auto-merge armed', tone: 'run', icon: 'gear' },
}

export function rosterStatus(facts: SessionFacts, model: LifecycleModel | null): RosterStatus {
  if (!model) return SESSION_STATUS[facts.status]
  if (model.terminal) return TERMINAL_STATUS[model.terminal]

  const status = HEAD_STATUS[`${model.head}:${model.nodes[model.head]}`]
  if (!status) return SESSION_STATUS[facts.status]
  return typeof status === 'function' ? status(facts) : status
}
