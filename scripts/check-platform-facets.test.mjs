import assert from 'node:assert/strict'
import { test } from 'node:test'
import { domainFacetViolations } from './domain-facet-boundaries.mjs'

const platformFile = (facet, name, source) => ({
  path: `apps/desktop/src/platform/${facet}/${name}.ts`,
  source,
})

const sharedFile = (name, source) => ({
  path: `apps/desktop/src/shared/${name}.ts`,
  source,
})

test('refuses imports between platform runtimes', () => {
  const files = [
    platformFile('main', 'client', "import '../preload/client'"),
    platformFile('preload', 'window', "import '../main/window'"),
    platformFile('renderer', 'menu', "import '../main/menu'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [
      ['main', 'preload'],
      ['preload', 'main'],
      ['renderer', 'main'],
    ],
  )
})

test('allows the platform renderer shell to compose a renderer domain', () => {
  const files = [
    platformFile(
      'renderer',
      'cockpit/router',
      "import '@/domains/sessions/renderer/pages/sessions-page'",
    ),
  ]

  assert.deepEqual(domainFacetViolations(files), [])
})

test('keeps platform shared code runtime neutral', () => {
  const files = [
    platformFile('shared', 'file', "import fs from 'node:fs'"),
    platformFile('shared', 'window', "import '../main/window'"),
    platformFile('shared', 'view', "import React from 'react'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ specifier }) => specifier),
    ['node:fs', '../main/window', 'react'],
  )
})

test('keeps application shared code runtime neutral', () => {
  const files = [
    sharedFile('filesystem', "import fs from 'node:fs'"),
    sharedFile('window', "import '@/platform/main/window/create-window'"),
    sharedFile('view', "import React from 'react'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ specifier }) => specifier),
    ['node:fs', '@/platform/main/window/create-window', 'react'],
  )
})
