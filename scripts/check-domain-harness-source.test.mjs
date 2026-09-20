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
