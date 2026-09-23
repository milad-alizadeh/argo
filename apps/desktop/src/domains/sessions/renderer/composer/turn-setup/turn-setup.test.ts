import { expect, test } from 'bun:test'
import { codexModelCatalogFixture } from '@/domains/sessions/contract/codex-model-catalog.test-fixture'
import { codexTurnSetupSchemaFor } from '@/domains/sessions/contract/codex-turn-setup'
import {
  CLAUDE_EFFORTS,
  CLAUDE_MODELS,
  CLAUDE_MODES,
  claudeTurnSetupSchema,
} from '@/domains/sessions/contract/ipc/contract'
import { CodexModelCatalogCache } from '@/harnesses/codex/drive/protocol/model-catalog'
import { CLAUDE_TURN_SETUP } from './claude-turn-setup'
import { codexTurnSetup } from './codex-turn-setup'
import {
  refusalOf,
  resolvedTurnSetup,
  setupFromReading,
  supportedSetup,
  turnSettled,
} from './turn-setup'

const recordedCodexCatalog: unknown = await Bun.file(
  new URL(
    '../../../../../../mocks/cli/codex/fixtures/model-list-codex-0.147.0.json',
    import.meta.url,
  ),
).json()

const requested = { model: 'opus', effort: 'max', mode: 'bypassPermissions' }

test('reads a Session setup off the Harness words its transcript wrote', () => {
  expect(
    setupFromReading(CLAUDE_TURN_SETUP, {
      model: 'claude-sonnet-5',
      effort: 'xhigh',
      mode: 'default',
    }),
  ).toEqual({ model: 'sonnet', effort: 'xhigh', mode: 'manual' })
})

test('keeps the opening choice for what the transcript has not stated or Argo does not offer', () => {
  expect(
    setupFromReading(CLAUDE_TURN_SETUP, { model: 'claude-mythos-1', effort: null, mode: null }),
  ).toEqual(CLAUDE_TURN_SETUP.opening)
})

test('accepts a Turn whose reading matches every choice', () => {
  expect(
    refusalOf(CLAUDE_TURN_SETUP, requested, {
      model: 'claude-opus-5',
      effort: 'max',
      mode: 'bypassPermissions',
    }),
  ).toBe(null)
})

test('reverts each refused choice to what Claude used and says so', () => {
  expect(
    refusalOf(CLAUDE_TURN_SETUP, requested, {
      model: 'claude-opus-5',
      effort: 'high',
      mode: 'default',
    }),
  ).toEqual({
    setup: { model: 'opus', effort: 'high', mode: 'manual' },
    message: 'Claude used High, not Max. Claude used Manual, not Bypass.',
  })
})

test('names a model Argo does not offer verbatim and keeps the choice it cannot show', () => {
  expect(
    refusalOf(CLAUDE_TURN_SETUP, requested, {
      model: 'claude-mythos-1',
      effort: null,
      mode: 'bypassPermissions',
    }),
  ).toEqual({ setup: requested, message: 'Claude used claude-mythos-1, not Opus 5.' })
})

test('offers exactly the Models, Efforts and Modes the Claude contract accepts', () => {
  const values = (choices: { value: string }[]) => choices.map(({ value }) => value).sort()
  expect(values(CLAUDE_TURN_SETUP.models)).toEqual([...CLAUDE_MODELS].sort())
  expect(values(CLAUDE_TURN_SETUP.efforts)).toEqual([...CLAUDE_EFFORTS].sort())
  expect(values(CLAUDE_TURN_SETUP.modes)).toEqual([...CLAUDE_MODES].sort())
  expect(claudeTurnSetupSchema.safeParse(CLAUDE_TURN_SETUP.opening).success).toBe(true)
})

test('advertised models and efforts become the Codex composer choices and schema rules', () => {
  const catalog = codexModelCatalogFixture()
  const choices = codexTurnSetup(catalog)
  expect(choices.models.map(({ value }) => value)).toEqual(['gpt-live'])
  expect(choices.models[0]?.efforts).toEqual(['focused'])
  expect(choices.opening).toEqual({
    model: 'gpt-live',
    effort: 'focused',
    mode: 'workspace-write',
  })
  const schema = codexTurnSetupSchemaFor(catalog)
  expect(
    schema.safeParse({ model: 'gpt-live', effort: 'focused', mode: 'workspace-write' }).success,
  ).toBe(true)
  expect(
    schema.safeParse({ model: 'gpt-live', effort: 'high', mode: 'workspace-write' }).success,
  ).toBe(false)
})

test('a mocked app-server catalog request reaches the composer choices', async () => {
  const cache = new CodexModelCatalogCache()
  const catalog = await cache.get(
    { executablePath: '/codex', version: 'codex-cli 0.147.0' },
    async (_params, decode) => decode(recordedCodexCatalog),
  )
  const choices = codexTurnSetup(catalog)
  expect(choices.models.map(({ value }) => value)).toEqual([
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'gpt-5.5',
    'gpt-5.2',
  ])
  expect(choices.models.find(({ value }) => value === 'gpt-5.6-luna')?.efforts).toEqual([
    'low',
    'medium',
    'high',
    'xhigh',
    'max',
  ])
})

test('replaces an explicit model and effort removed by a live catalog refresh', () => {
  const identity = { kind: 'draft', projectId: 'project-1' } as const
  const choices = codexTurnSetup({
    data: [
      {
        id: 'gpt-current',
        model: 'gpt-current',
        displayName: 'Current model',
        description: '',
        defaultReasoningEffort: 'low',
        isDefault: true,
        hidden: false,
        supportedReasoningEfforts: [{ reasoningEffort: 'low', description: 'Low' }],
      },
    ],
    nextCursor: null,
  })
  const next = resolvedTurnSetup(choices, {
    identity,
    chosen: new Map([
      ['new:project-1', { model: 'retired-model', effort: 'max', mode: 'workspace-write' }],
    ]),
    rows: [],
    remembered: {},
  })
  expect(next).toEqual(choices.opening)
})

test('keeps each restored choice Argo still offers and replaces the rest', () => {
  expect(
    supportedSetup(
      CLAUDE_TURN_SETUP,
      { model: 'claude-mythos-1', effort: 'xhigh', mode: 'yolo' },
      { model: 'sonnet', effort: 'low', mode: 'plan' },
    ),
  ).toEqual({ model: 'sonnet', effort: 'xhigh', mode: 'plan' })
})

test('resolves a draft to an explicit choice, then the remembered Model and Effort, then the opening setup', () => {
  const identity = { kind: 'draft', projectId: 'project-1' } as const
  expect(
    resolvedTurnSetup(CLAUDE_TURN_SETUP, { identity, chosen: new Map(), rows: [], remembered: {} }),
  ).toEqual(CLAUDE_TURN_SETUP.opening)
  expect(
    resolvedTurnSetup(CLAUDE_TURN_SETUP, {
      identity,
      chosen: new Map(),
      rows: [],
      remembered: { model: 'sonnet', effort: 'xhigh' },
    }),
  ).toEqual({ ...CLAUDE_TURN_SETUP.opening, model: 'sonnet', effort: 'xhigh' })
  const chosen = new Map([['new:project-1', requested]])
  expect(
    resolvedTurnSetup(CLAUDE_TURN_SETUP, { identity, chosen, rows: [], remembered: {} }),
  ).toEqual(requested)
})

test('carries a draft choice into the Session it started, and reads the roster once it has none', () => {
  const chosen = new Map([['new:project-1', requested]])
  const identity = { kind: 'session', sessionId: 'session-1' } as const
  const rows = [
    {
      id: 'session-1',
      setup: { model: 'claude-opus-5', effort: 'max', mode: 'bypassPermissions' },
    },
  ]
  // The draft's own choice is keyed to the draft, so a fresh Session starts from the roster.
  expect(resolvedTurnSetup(CLAUDE_TURN_SETUP, { identity, chosen, rows, remembered: {} })).toEqual(
    requested,
  )
  expect(
    resolvedTurnSetup(CLAUDE_TURN_SETUP, { identity, chosen, rows: [], remembered: {} }),
  ).toEqual(CLAUDE_TURN_SETUP.opening)
})

test('judges a Turn once it has started after the send and either replied or stopped', () => {
  const since = '2026-09-13T10:00:00.000Z'
  const later = '2026-09-13T10:01:00.000Z'
  const replied = { model: 'claude-opus-5', effort: 'high', mode: 'default' }
  const unanswered = { model: null, effort: null, mode: 'default' }
  const cases = [
    { turnStartedAt: since, status: 'idle', setup: replied, settled: false },
    { turnStartedAt: null, status: 'idle', setup: replied, settled: false },
    { turnStartedAt: later, status: 'running', setup: unanswered, settled: false },
    { turnStartedAt: later, status: 'running', setup: replied, settled: true },
    { turnStartedAt: later, status: 'idle', setup: unanswered, settled: true },
  ] as const
  for (const { settled, ...row } of cases) expect(turnSettled(row, since)).toBe(settled)
})
