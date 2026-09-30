// Every alert-worthy Ticket problem reaches a toast once, not only the inline banner it also draws.
// A Connection state (alert: false) stays inline only, since it persists until reconnected rather
// than announcing a single failed read.
import { useEffect, useRef } from 'react'
import { useToastManager } from '@/platform/renderer/components/ui/toast'
import type { TicketProblemProps } from '../lib'
import type { TicketsView } from './use-tickets-view-derive'

const SLOTS = ['main', 'sync', 'detail'] as const
type Slot = (typeof SLOTS)[number]

export function activeProblems(view: TicketsView): Partial<Record<Slot, TicketProblemProps>> {
  if (view.kind === 'problem') {
    const { kind: _kind, ...problem } = view
    return problem.alert ? { main: problem } : {}
  }
  if (view.kind !== 'tickets') return {}
  const problems: Partial<Record<Slot, TicketProblemProps>> = {}
  if (view.backlog.sync.problem?.alert) problems.sync = view.backlog.sync.problem
  if (view.detail.problem?.alert) problems.detail = view.detail.problem
  return problems
}

const signature = (problem: TicketProblemProps | undefined) =>
  problem && `${problem.title}|${problem.description}`

export function useTicketProblemToasts(view: TicketsView): void {
  const { add } = useToastManager()
  const seen = useRef<Partial<Record<Slot, string>>>({})
  useEffect(() => {
    const active = activeProblems(view)
    for (const slot of SLOTS) {
      const problem = active[slot]
      const next = signature(problem)
      if (next === seen.current[slot]) continue
      seen.current[slot] = next
      if (problem) add({ title: problem.title, description: problem.description, type: 'error' })
    }
  }, [view, add])
}
