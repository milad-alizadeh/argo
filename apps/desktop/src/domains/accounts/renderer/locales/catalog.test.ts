import { expect, test } from 'bun:test'
import { ACCOUNT_ERRORS, PROVIDERS } from '@/domains/accounts/contract/contract'
import accounts from '@/domains/accounts/renderer/locales/en.json'

test('the Accounts catalog answers every Account error code', () => {
  expect(Object.keys(accounts.error).sort()).toEqual(Object.keys(ACCOUNT_ERRORS).sort())
})

test('the Accounts catalog answers every provider', () => {
  const expected = [...PROVIDERS].sort()
  expect(Object.keys(accounts.provider).sort()).toEqual(expected)
  expect(Object.keys(accounts.row.connections).sort()).toEqual(expected)
  const confirm = Object.keys(accounts.confirm)
    .flatMap((key) => key.match(/^(.+)_(?:one|other)$/)?.[1] ?? [])
    .sort()
  expect([...new Set(confirm)]).toEqual(expected)
})
