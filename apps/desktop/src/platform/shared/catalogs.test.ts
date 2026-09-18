// A catalog key with no call site is copy nobody can read, and a call site naming a key no catalog
// holds draws the key itself on screen (#2130). Both directions are checked here.
//
// The typed `t` catches a missing key while the code is written, and this is the backstop: it also
// reads the keys built from a variable, which no type can follow. It sits beside the platform
// catalog rather than in the renderer because it walks the source tree, and the renderer may not
// import a Node built-in. The namespaces come from the renderer's own registration, so a namespace
// is added in one place.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ACCOUNT_ERRORS, PROVIDERS } from '../../domains/accounts/contract/contract'
import accounts from '../../domains/accounts/renderer/locales/en.json'
import { CONNECTION_STATES, TICKET_ERRORS } from '../../domains/tickets/contract/contract'
import tickets from '../../domains/tickets/renderer/locales/en.json'
import { CATALOGS } from '../renderer/i18n/catalogs'

const NAMESPACES = Object.keys(CATALOGS)

// A module keeps its catalog until its own pull request moves its copy across. Each migration
// deletes a line here, and the last one deletes the list (#2130).
const NAMESPACES_AWAITING_MIGRATION = ['sessions']

const SOURCE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// i18next appends a count suffix to the key it is given, so `confirm.github_one` is reached by a
// call site naming `confirm.github`.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

// What a `${…}` in a source string stands for while the string is read as a key pattern.
const HOLE = ' '

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === 'locales' ? [] : sourceFiles(full)
    // A story or a test is not a call site: a key only they name is copy no screen draws.
    const proof = /\.(test|stories)\.tsx?$/.test(entry.name)
    return /\.tsx?$/.test(entry.name) && !proof ? [full] : []
  })
}

function leafKeys(catalog: object, prefix = ''): string[] {
  return Object.entries(catalog).flatMap(([segment, value]) => {
    const key = prefix ? `${prefix}.${segment}` : segment
    return typeof value === 'string' ? [key] : leafKeys(value as object, key)
  })
}

// Every quoted or backtick string in the source that could name a key, as a pattern: a hole stands
// for one key segment, which is exactly what a key built from a variable fills. A string whose
// every segment is a hole names nothing in particular, or a `${a}.${b}` written for some other
// purpose would answer for the whole catalog.
function keyPatterns(source: string): RegExp[] {
  const literals = source.match(/(['`])[\w.:${}[\]]+?\1/g) ?? []
  return literals.flatMap((literal) => {
    const body = literal.slice(1, -1).replace(/\$\{[^}]*\}/g, HOLE)
    const segments = body.split('.')
    if (segments.length < 2 || segments.every((segment) => segment === HOLE)) return []
    const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll(HOLE, '[^.:]+')
    return [new RegExp(`^${escaped}$`)]
  })
}

const PATTERNS = sourceFiles(SOURCE_ROOT).flatMap((file) => keyPatterns(readFileSync(file, 'utf8')))

test('every catalog key has a call site', () => {
  const skipped = new Set(NAMESPACES_AWAITING_MIGRATION)
  const unused = Object.entries(CATALOGS)
    .filter(([namespace]) => !skipped.has(namespace))
    .flatMap(([namespace, catalog]) =>
      leafKeys(catalog)
        .map((key) => `${namespace}:${key.replace(PLURAL_SUFFIX, '')}`)
        // A call site names a key bare, under the namespace its hook bound, or with the prefix.
        .filter((reference) => {
          const key = reference.slice(namespace.length + 1)
          return !PATTERNS.some((pattern) => pattern.test(key) || pattern.test(reference))
        }),
    )
  assert.deepEqual([...new Set(unused)], [])
})

test('a call site naming a namespace names a key that namespace holds', () => {
  const namespaced = new RegExp(`(?:${NAMESPACES.join('|')}):[\\w.-]+`, 'g')
  const declared = new Map(
    Object.entries(CATALOGS).map(([namespace, catalog]) => [
      namespace,
      new Set(leafKeys(catalog).map((key) => key.replace(PLURAL_SUFFIX, ''))),
    ]),
  )
  const missing = sourceFiles(SOURCE_ROOT).flatMap((file) =>
    (readFileSync(file, 'utf8').match(namespaced) ?? []).filter((reference) => {
      const [namespace, key] = reference.split(':')
      // A key built from a variable ends at the hole, so there is no whole key to look up.
      if (key === undefined || key.endsWith('.')) return false
      return !declared.get(namespace ?? '')?.has(key)
    }),
  )
  assert.deepEqual([...new Set(missing)], [])
})

// The two closed sets the Accounts catalog is keyed by. A key built from one of these is reached by
// no pattern above, so a member added to either would otherwise draw its own key on screen.
test('the accounts catalog answers every Account error code', () => {
  assert.deepEqual(Object.keys(accounts.error).sort(), Object.keys(ACCOUNT_ERRORS).sort())
})

test('the accounts catalog answers every provider', () => {
  const expected = [...PROVIDERS].sort()
  assert.deepEqual(Object.keys(accounts.provider).sort(), expected)
  assert.deepEqual(Object.keys(accounts.row.connections).sort(), expected)
  const confirm = Object.keys(accounts.confirm)
    .flatMap((key) => key.match(/^(.+)_(?:one|other)$/)?.[1] ?? [])
    .sort()
  assert.deepEqual([...new Set(confirm)], expected)
})

// The three closed sets the Tickets catalog is keyed by: a Ticket error code, a Connection state
// and a provider, none reached by the patterns above.
test('the tickets catalog answers every Ticket error code', () => {
  assert.deepEqual(Object.keys(tickets.error).sort(), Object.keys(TICKET_ERRORS).sort())
})

test('the tickets catalog answers every Connection state but ready', () => {
  const expected = CONNECTION_STATES.filter((state) => state !== 'ready').sort()
  assert.deepEqual(Object.keys(tickets.connection.state).sort(), [...CONNECTION_STATES].sort())
  assert.deepEqual(Object.keys(tickets.problem.connection).sort(), expected)
})

test('the tickets catalog answers every provider', () => {
  const expected = [...PROVIDERS].sort()
  assert.deepEqual(Object.keys(tickets.source).sort(), expected)
})
