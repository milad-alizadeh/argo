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

test('allows a domain to use another domain only through its declared public port', () => {
  const files = [
    projectFile(
      'main',
      'ticket-reader',
      "import { ticketSource } from '@/domains/connections/main/port'",
    ),
    projectFile(
      'main',
      'account-reader',
      "import { registry } from '@/domains/accounts/main/registry'",
    ),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ kind, specifier }) => [kind, specifier]),
    [['private-domain-import', '@/domains/accounts/main/registry']],
  )
})

test('refuses privileged imports from contracts and renderer code', () => {
  const files = [
    projectFile('contract', 'messages', "import fs from 'node:fs'"),
    projectFile('contract', 'view', "import React from 'react'"),
    projectFile('contract', 'provider', "import '@/providers/github/client'"),
    projectFile('contract', 'screen', "import '@/renderer/app'"),
    projectFile('renderer', 'queries', "import { ipcRenderer } from 'electron'"),
    projectFile('renderer', 'provider', "import '@/providers/github/client'"),
    projectFile('renderer', 'main-state', "import '@/main'"),
    projectFile('renderer', 'preload-client', "import '@/preload'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ specifier }) => specifier),
    [
      'node:fs',
      'react',
      '@/providers/github/client',
      '@/renderer/app',
      'electron',
      '@/providers/github/client',
      '@/main',
      '@/preload',
    ],
  )
})

test('refuses an import from a legacy source root', () => {
  const files = [
    projectFile('main', 'store', "import '@/core/storage/portable-file'"),
    projectFile('renderer', 'view', "import '@/development/account-store'"),
    projectFile('preload', 'client', "import '../../../storybook/story-links'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ kind }) => kind),
    ['legacy-root', 'legacy-root', 'legacy-root'],
  )
})

test('refuses a domain facet importing an application composition root', () => {
  const files = [projectFile('main', 'bridge', "import '../../../main'")]

  assert.deepEqual(
    domainFacetViolations(files).map(({ kind }) => kind),
    ['composition-root'],
  )
})

test('refuses a harness adapter importing Sessions main code', () => {
  const files = [
    {
      path: 'apps/desktop/src/harnesses/claude/drive/session-drive-adapter.ts',
      source: "import '@/domains/sessions/main/drive/drive'",
    },
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [['harness', 'main']],
  )
})

test('refuses a Sessions renderer importing a harness adapter', () => {
  const files = [
    {
      path: 'apps/desktop/src/domains/sessions/renderer/view.tsx',
      source: "import '@/harnesses/codex/drive/session-drive-adapter'",
    },
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [['renderer', 'harness']],
  )
})

test('allows each domain facet to use only its matching platform facet', () => {
  const files = [
    projectFile('contract', 'shared', "import '@/shared/messages'"),
    projectFile('main', 'ipc', "import '@/platform/main/ipc'"),
    projectFile('preload', 'ipc', "import '@/platform/preload/ipc'"),
    projectFile('renderer', 'shell', "import '@/platform/renderer/components/button'"),
    projectFile('renderer', 'appearance', "import '@/platform/shared/appearance'"),
  ]

  assert.deepEqual(domainFacetViolations(files), [])
})

test('refuses a domain facet importing another platform runtime', () => {
  const files = [
    projectFile('contract', 'window', "import '@/platform/main/window'"),
    projectFile('main', 'client', "import '@/platform/preload/ipc'"),
    projectFile('preload', 'registration', "import '@/platform/main/ipc'"),
    projectFile('renderer', 'menu', "import '@/platform/main/menu'"),
  ]

  assert.deepEqual(
    domainFacetViolations(files).map(({ sourceFacet, targetFacet }) => [sourceFacet, targetFacet]),
    [
      ['contract', 'main'],
      ['main', 'preload'],
      ['preload', 'main'],
      ['renderer', 'main'],
    ],
  )
})
