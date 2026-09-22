import type { TFunction } from 'i18next'
import type { ShellState } from '@/domains/sessions/contract/model'
import { durationText, spentTokens, type WorkState, workDuration } from './session-work'

export type WorkPresentation = { title: string; state: string; facts: string }

type SubagentWork = {
  kind: 'subagent'
  id: string
  name: string | null
  state: WorkState
  model: string | null
  durationMs: number | null
  tokens: number | null
}

type ShellWork = {
  kind: 'shell'
  id: string
  command: string | null
  label: string | null
  state: ShellState
  startedAt: string | null
  endedAt: string | null
  result: string | null
  now: number
}

function joined(facts: readonly (string | null)[]): string {
  return facts.filter((fact) => fact !== null).join(' · ')
}

// A harness names a Subagent by a slug; every reader surface says the same sentence form.
export function readableWorkTitle(name: string): string {
  return name.replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
}

export function workPresentation(
  work: SubagentWork | ShellWork,
  t: TFunction<'sessions'>,
): WorkPresentation {
  if (work.kind === 'subagent') {
    return {
      title: work.name === null ? work.id : readableWorkTitle(work.name),
      state: t(`workState.${work.state}`),
      facts: joined([work.model, durationText(work.durationMs), spentTokens(work.tokens, t)]),
    }
  }

  return {
    title: work.label ?? work.command ?? work.id,
    state: t(`workState.${work.state}`),
    facts: joined([workDuration(work.startedAt, work.endedAt, work.now), work.result]),
  }
}
