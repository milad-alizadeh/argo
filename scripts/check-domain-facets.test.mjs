import assert from 'node:assert/strict'
import { test } from 'node:test'
import { domainFacetViolations } from './domain-facet-boundaries.mjs'

const projectFile = (facet, name, source) => ({
  path: `apps/desktop/src/domains/projects/${facet}/${name}.ts`,
  source,
})

test('allows every runtime facet to depend on its Project contract', () => {
  const files = [
    projectFile('contract', 'messages', "import { z } from 'zod'"),
    projectFile('main', 'open-project', "import type { Project } from '../contract/messages'"),
    projectFile('preload', 'client', "import { PROJECT_OPERATIONS } from '../contract/operations'"),
    projectFile('renderer', 'queries', "import type { Project } from '../contract/messages'"),
  ]

  assert.deepEqual(domainFacetViolations(files), [])
})

test('refuses imports that point away from the Project contract', () => {
  const files = [
    projectFile('contract', 'messages', "import '../main/store'"),
    projectFile('main', 'bridge', "import '../renderer/queries'"),
    projectFile('preload', 'client', "import '../main/bridge'"),
    projectFile('renderer', 'queries', "import '../preload/client'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [
      ['contract', 'main'],
      ['main', 'renderer'],
      ['preload', 'main'],
      ['renderer', 'preload'],
    ],
  )
})

test('refuses privileged imports from contracts and renderer code', () => {
  const files = [
    projectFile('contract', 'messages', "import fs from 'node:fs'"),
    projectFile('contract', 'view', "import React from 'react'"),
    projectFile('contract', 'stored', "import '@/core/storage/portable-file'"),
    projectFile('contract', 'provider', "import '@/providers/github/client'"),
    projectFile('contract', 'screen', "import '@/renderer/app'"),
    projectFile('renderer', 'queries', "import { ipcRenderer } from 'electron'"),
    projectFile('renderer', 'stored', "import '@/core/storage/portable-file'"),
    projectFile('renderer', 'provider', "import '@/providers/github/client'"),
    projectFile('renderer', 'main-state', "import '@/main'"),
    projectFile('renderer', 'preload-client', "import '@/preload'"),
    projectFile('renderer', 'legacy-main', "import '@/core/accounts/bridge'"),
    projectFile('renderer', 'legacy-preload', "import '@/core/accounts/client'"),
    projectFile('renderer', 'legacy-domain', "import '@/core/contract/domain'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ specifier }) => specifier),
    [
      'node:fs',
      'react',
      '@/core/storage/portable-file',
      '@/providers/github/client',
      '@/renderer/app',
      'electron',
      '@/core/storage/portable-file',
      '@/providers/github/client',
      '@/main',
      '@/preload',
      '@/core/accounts/bridge',
      '@/core/accounts/client',
      '@/core/contract/domain',
    ],
  )
})

test('allows a renderer facet to import a legacy domain contract', () => {
  const files = [
    projectFile('renderer', 'accounts', "import type { Account } from '@/core/accounts/contract'"),
  ]

  assert.deepEqual(domainFacetViolations(files), [])
})

test('refuses a domain facet importing an application composition root', () => {
  const files = [projectFile('main', 'bridge', "import '../../../main'")]

  assert.deepEqual(
    domainFacetViolations(files).map(({ kind }) => kind),
    ['composition-root'],
  )
})
