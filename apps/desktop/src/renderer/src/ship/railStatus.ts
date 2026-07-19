import { ribbonModel } from './ribbonModel'
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

export function railStatus(facts: SessionFacts): RailStatus {
  const model = ribbonModel(facts)
  if (!model) return LIFECYCLE_STATUS[facts.lifecycle]

  switch (model.terminal) {
    case 'merged':
      return { word: 'Landed', tone: 'landed', icon: 'git-merge' }
    case 'closed':
      return { word: 'Closed', tone: 'stale', icon: 'prohibit' }
  }

  // Ordered worst-first: the first stage that wants something from you wins the row.
  const { nodes } = model
  if (nodes.ci === 'fail') return { word: 'CI failing', tone: 'amber', icon: 'warning' }
  if (nodes.review === 'warn') return { word: 'Changes requested', tone: 'amber', icon: 'user' }
  if (nodes.merge === 'gate') {
    return { word: 'Ready to merge', tone: 'amber', icon: 'git-pull-request' }
  }
  if (nodes.merge === 'auto') return { word: 'Auto-merge armed', tone: 'run', icon: 'gear' }
  if (nodes.commits === 'sync') {
    return { word: `↑${facts.unpushed} unpushed`, tone: 'run', icon: 'arrow-line-up' }
  }
  if (nodes.commits === 'gate') return { word: 'Commit ready', tone: 'amber', icon: 'git-commit' }
  if (nodes.pr === 'gate') {
    return { word: 'Create PR ready', tone: 'amber', icon: 'git-pull-request' }
  }
  if (nodes.pr === 'auto') return { word: 'Opening PR · auto', tone: 'run', icon: 'gear' }
  if (nodes.review === 'now') return { word: 'In review', tone: 'run', icon: 'user' }
  if (facts.pr) {
    return { word: `PR #${facts.pr.num} · CI`, tone: 'run', icon: 'git-pull-request' }
  }
  return LIFECYCLE_STATUS[facts.lifecycle]
}
