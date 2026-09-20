import assert from 'node:assert/strict'
import { test } from 'node:test'
import { domainFacetViolations } from './domain-facet-boundaries.mjs'

test('refuses a harness Session source importing Sessions main code', () => {
  const files = [
    {
      path: 'apps/desktop/src/harnesses/claude/sessions/read-sessions.ts',
      source: "import { createSessionReader } from '@/domains/sessions/main/observation/reader'",
    },
  ]
  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [['harness', 'main']],
  )
})

test('refuses any harness drive implementation importing Sessions main code', () => {
  const files = [
    {
      path: 'apps/desktop/src/harnesses/third/drive/driver.ts',
      source: "import { managedRow } from '@/domains/sessions/main/lifecycle/managed-row'",
    },
  ]
  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [['harness', 'main']],
  )
})

// The harness facet inverted (#2505): every path under harnesses/ is now the harness facet by
// default, and only two directories are declared exceptions.
const harnessFile = (path, source) => ({ path, source })
const IMPORTS_SESSION_MAIN = "import '@/domains/sessions/main/observation/reader'"

test('treats compaction, integration, and a root harnesses/ file as the harness facet', () => {
  const files = [
    harnessFile(
      'apps/desktop/src/harnesses/claude/compaction/compaction-timer.ts',
      IMPORTS_SESSION_MAIN,
    ),
    harnessFile('apps/desktop/src/harnesses/claude/integration/live-feed.ts', IMPORTS_SESSION_MAIN),
    harnessFile('apps/desktop/src/harnesses/discover.ts', IMPORTS_SESSION_MAIN),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ path }) => path),
    files.map(({ path }) => path),
  )
})

test('exempts the declared harnesses/composition/ root from the harness facet', () => {
  const files = [
    harnessFile(
      'apps/desktop/src/harnesses/composition/harness-registration.ts',
      IMPORTS_SESSION_MAIN,
    ),
  ]

  assert.deepEqual(domainFacetViolations(files), [])
})

test('gives a Harness renderer directory the renderer facet, which still refuses Sessions main', () => {
  const files = [
    harnessFile(
      'apps/desktop/src/harnesses/claude/renderer/session-view.tsx',
      IMPORTS_SESSION_MAIN,
    ),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, kind }) => [sourceFacet, kind]),
    [['renderer', 'private-domain-import']],
  )
})

test('refuses a Harness renderer file that reaches into Node', () => {
  const files = [
    harnessFile(
      'apps/desktop/src/harnesses/claude/renderer/session-view.tsx',
      "import fs from 'node:fs'",
    ),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ kind }) => kind),
    ['privileged-import'],
  )
})
