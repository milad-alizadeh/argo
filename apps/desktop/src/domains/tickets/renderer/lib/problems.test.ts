import { expect, test } from 'bun:test'
import { connection } from '@/domains/tickets/renderer/detail/ticket-fixtures'
import { connectionProblem } from '@/domains/tickets/renderer/lib/problems'
import { initializeRendererI18n } from '@/platform/renderer/i18n/i18n'
import { CATALOGS } from '@/renderer/catalogs'

await initializeRendererI18n({
  catalogs: CATALOGS,
  defaultNamespace: 'tickets',
  language: 'en',
})

const recovery = { onReconnect: () => {}, onDisconnectSource: () => {} }

test('names a refused GitHub Connection by its repository', () => {
  const problem = connectionProblem(connection('github', 'account-revoked'), recovery)
  expect(problem.title).toBe('GitHub no longer accepts octocat')
  expect(problem.description).toBe('Reconnect it to read octocat/hello-world again.')
  expect(problem.actions.map((action) => action.label)).toEqual([
    'Reconnect GitHub',
    'Disconnect repository',
  ])
})

test('names an expired Linear Connection by its team', () => {
  const problem = connectionProblem(connection('linear', 'account-expired'), recovery)
  expect(problem.title).toBe('The sign-in for ada@analytical.dev expired')
  expect(problem.description).toBe('Reconnect it to read Engine again.')
  expect(problem.actions.map((action) => action.label)).toEqual([
    'Reconnect Linear',
    'Disconnect team',
  ])
})
