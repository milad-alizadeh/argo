import { expect, test } from 'bun:test'
import type { TicketProblemProps } from '../lib/problems'
import { activeProblems } from './use-ticket-problem-toasts'
import type { TicketsView } from './use-tickets-view-derive'

const alertProblem = (title: string): TicketProblemProps => ({
  icon: 'warning',
  title,
  description: 'Argo cannot reach GitHub.',
  alert: true,
  actions: [],
})

const stateProblem = (title: string): TicketProblemProps => ({
  ...alertProblem(title),
  alert: false,
})

test('a top-level failure is picked up, a Connection state is not', () => {
  const failure = alertProblem('failed')
  const failed = { kind: 'problem', ...failure } as TicketsView
  expect(activeProblems(failed)).toEqual({ main: failure })

  const connection = { kind: 'problem', ...stateProblem('waiting') } as TicketsView
  expect(activeProblems(connection)).toEqual({})
})

test('a background sync failure and a detail failure both surface, side by side', () => {
  const view = {
    kind: 'tickets',
    backlog: { sync: { problem: alertProblem('sync') } },
    detail: { problem: alertProblem('detail') },
  } as unknown as TicketsView
  expect(activeProblems(view)).toEqual({
    sync: alertProblem('sync'),
    detail: alertProblem('detail'),
  })
})

test('a Connection state on the sync slot does not surface, since it never clears itself', () => {
  const view = {
    kind: 'tickets',
    backlog: { sync: { problem: stateProblem('sync') } },
    detail: { problem: null },
  } as unknown as TicketsView
  expect(activeProblems(view)).toEqual({})
})

test('loading and unconnected views carry no problem', () => {
  expect(activeProblems({ kind: 'no-project' } as TicketsView)).toEqual({})
  expect(activeProblems({ kind: 'loading', label: 'Reading…' } as TicketsView)).toEqual({})
})
