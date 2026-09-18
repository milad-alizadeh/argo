import assert from 'node:assert/strict'
import { test } from 'node:test'
import { managedRow } from '@/domains/sessions/main/managed-row'
import {
  CREATED_THREAD,
  codexHome,
  DELEGATED_REQUEST,
  rosterTitles,
  THREADS_SCHEMA,
  writeStateStore,
} from './thread-title-fixtures'

const CODEX_NAME = 'Implement Geist desktop typography contract'

function driven(title?: { text: string; source: 'custom' }) {
  return managedRow(CREATED_THREAD, {
    cli: 'codex',
    compactionPercentage: null,
    compactionStartedAt: null,
    compactionTokens: null,
    cwd: '/projects/argo',
    status: 'running',
    setup: { model: null, effort: null, mode: null },
    prompt: DELEGATED_REQUEST,
    startedAt: '2026-09-15T06:44:50.000Z',
    title,
  })
}

// The Session the Roster showed by its opening prompt for as long as it ran (#2256): Argo spawned
// it, so its held row outranked the name Codex had already written to its own state.
test('a Codex Session Argo drives takes the name Codex Desktop gave it', async (context) => {
  const { transcripts, state } = await codexHome(context)
  writeStateStore(state, THREADS_SCHEMA, [[CREATED_THREAD, CODEX_NAME]])

  assert.deepEqual(await rosterTitles(transcripts, state, [driven()]), {
    [CREATED_THREAD]: { text: CODEX_NAME, source: 'summarised' },
  })
})

test('a rename Argo holds outranks the name Codex Desktop gave the Session', async (context) => {
  const { transcripts, state } = await codexHome(context)
  writeStateStore(state, THREADS_SCHEMA, [[CREATED_THREAD, CODEX_NAME]])
  const renamed = { text: 'Renamed in Argo', source: 'custom' } as const

  assert.deepEqual(await rosterTitles(transcripts, state, [driven(renamed)]), {
    [CREATED_THREAD]: renamed,
  })
})

test('a Codex Session Argo drives keeps its opening prompt while Codex has not named it', async (context) => {
  const { transcripts, state } = await codexHome(context)
  writeStateStore(state, THREADS_SCHEMA, [[CREATED_THREAD, null]])

  assert.deepEqual(await rosterTitles(transcripts, state, [driven()]), {
    [CREATED_THREAD]: { text: DELEGATED_REQUEST, source: 'first-prompt' },
  })
})
