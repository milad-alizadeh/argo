// A catalog key with no call site is copy nobody can read, and a call site naming a key no catalog
// holds draws the key itself on screen (#2130). Both directions are checked here.
//
// The typed `t` catches a missing key while the code is written, and this is the backstop: it also
// reads the keys built from a variable, which no type can follow. It sits beside the platform
// catalog rather than in the renderer because it walks the source tree, and the renderer may not
// import a Node built-in.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import shared from '../../renderer/i18n/locales/en.json'
import accounts from '../../renderer/modules/accounts/locales/en.json'
import sessions from '../../renderer/modules/sessions/locales/en.json'
import { ACCOUNT_ERRORS } from '../accounts/contract'
import platform from './locales/en.json'

const CATALOGS: Record<string, object> = { accounts, platform, sessions, shared }

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
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : []
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
  const namespaced = /(?:accounts|platform|sessions|shared):[\w.-]+/g
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

test('the accounts catalog answers every Account error code', () => {
  assert.deepEqual(Object.keys(accounts.error).sort(), Object.keys(ACCOUNT_ERRORS).sort())
})
