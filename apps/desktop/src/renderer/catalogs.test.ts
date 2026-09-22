// A catalog key with no call site is copy nobody can read, and a call site naming a key no catalog
// holds draws the key itself on screen (#2130). Both directions are checked here.
//
// The typed `t` catches a missing key while the code is written, and this is the backstop: it also
// reads the keys built from a variable, which no type can follow. The namespaces come from the
// renderer's own registration, so a namespace is added in one place.
import { expect, test } from 'bun:test'
import { PROJECT_ERROR_CODES } from '@/domains/projects/contract/contract'
import { PROJECT_SETUP_RECOVERY_CODES } from '@/domains/projects/contract/setup'
import { PROJECT_SETUP_RECOVERY_KEYS } from '@/domains/projects/renderer/setup/project-setup-recovery-text'
import { CATALOGS } from '@/renderer/catalogs'

const NAMESPACES = Object.keys(CATALOGS)

// A module keeps its catalog until its own pull request moves its copy across. Each migration
// deletes a line here, and the last one deletes the list (#2130).
const NAMESPACES_AWAITING_MIGRATION = ['sessions']

const SOURCE_ROOT = `${import.meta.dir}/..`

// i18next appends a count suffix to the key it is given, so `confirm.github_one` is reached by a
// call site naming `confirm.github`.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

// What a `${…}` in a source string stands for while the string is read as a key pattern.
const HOLE = ' '

const sourceGlob = new Bun.Glob('**/*.{ts,tsx}')
const sourceFiles: string[] = []
for await (const file of sourceGlob.scan({ absolute: true, cwd: SOURCE_ROOT })) {
  // A story or a test is not a call site: a key only they name is copy no screen draws.
  const proof = /\.(test|stories)\.tsx?$/.test(file)
  if (!file.includes('/locales/') && !proof) sourceFiles.push(file)
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
  const literals = source.match(/(['`])[\w.:${}[\]-]+?\1/g) ?? []
  return literals.flatMap((literal) => {
    const body = literal.slice(1, -1).replace(/\$\{[^}]*\}/g, HOLE)
    const segments = body.split('.')
    if (segments.length < 2 || segments.every((segment) => segment === HOLE)) return []
    const escaped = body.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll(HOLE, '[^.:]+')
    return [new RegExp(`^${escaped}$`)]
  })
}

const sources = await Promise.all(sourceFiles.map((file) => Bun.file(file).text()))
const PATTERNS = sources.flatMap(keyPatterns)

test('every Project error code has reader text', () => {
  expect(Object.keys(CATALOGS.projects.error).sort()).toEqual([...PROJECT_ERROR_CODES].sort())
})

test('every Project setup recovery code has reader text', () => {
  expect(Object.keys(PROJECT_SETUP_RECOVERY_KEYS).sort()).toEqual(
    [...PROJECT_SETUP_RECOVERY_CODES].sort(),
  )
  expect(Object.keys(CATALOGS.projects.setup.actor.recovery).sort()).toEqual(
    Object.values(PROJECT_SETUP_RECOVERY_KEYS)
      .flatMap((key) => (key ? [key.slice(key.lastIndexOf('.') + 1)] : []))
      .sort(),
  )
})

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
  expect([...new Set(unused)]).toEqual([])
})

test('a call site naming a namespace names a key that namespace holds', () => {
  const namespaced = new RegExp(`(?:${NAMESPACES.join('|')}):[\\w.-]+`, 'g')
  const declared = new Map(
    Object.entries(CATALOGS).map(([namespace, catalog]) => [
      namespace,
      new Set(leafKeys(catalog).map((key) => key.replace(PLURAL_SUFFIX, ''))),
    ]),
  )
  const missing = sources.flatMap((source) =>
    (source.match(namespaced) ?? []).filter((reference) => {
      const [namespace, key] = reference.split(':')
      // A key built from a variable ends at the hole, so there is no whole key to look up.
      if (key === undefined || key.endsWith('.')) return false
      return !declared.get(namespace ?? '')?.has(key)
    }),
  )
  expect([...new Set(missing)]).toEqual([])
})
