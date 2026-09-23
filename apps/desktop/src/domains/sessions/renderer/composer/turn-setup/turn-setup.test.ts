import { expect, test } from 'bun:test'
import type { ModelInfo } from '@anthropic-ai/claude-agent-sdk'
import { claudeTurnSetupSchemaFor } from '@/domains/sessions/contract/claude-turn-setup'
import { codexTurnSetupSchemaFor } from '@/domains/sessions/contract/codex-turn-setup'
import {
  CLAUDE_EFFORTS,
  CLAUDE_MODES,
  claudeTurnSetupSchema,
} from '@/domains/sessions/contract/ipc/contract'
import { ClaudeModelCatalogCache } from '@/harnesses/claude/agent-sdk/model-catalog'
import { CodexModelCatalogCache } from '@/harnesses/codex/drive/protocol/model-catalog'
import { claudeModelCatalogFixture } from '../../../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import {
  CLAUDE_TURN_SETUP as CLAUDE_FALLBACK_TURN_SETUP,
  claudeTurnSetup,
} from './claude-turn-setup'
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
const CLAUDE_TURN_SETUP = claudeTurnSetup({
  data: (
    [
      ['fable', 'Fable 5.1', 'Deepest reasoning for long, open-ended work'],
      ['opus', 'Opus 5', 'Most capable for architecture and hard problems'],
      ['sonnet', 'Sonnet 5', 'Balanced for daily coding and review'],
      ['haiku', 'Haiku 4.5', 'Fast for small changes and quick answers'],
    ] as const
  ).map(([value, displayName, description]) => ({
    value,
    resolvedModel: `claude-${value}-5`,
    displayName,
    description,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  })),
})

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
  const fallback = claudeTurnSetup(null)
  expect(fallback.source).toBe('fallback')
  expect(fallback.models.map(({ value }) => value)).toEqual(['sonnet'])
  expect(fallback.models[0]?.efforts).toEqual(['medium'])
  expect(claudeTurnSetupSchema.safeParse(fallback.opening).success).toBe(true)
  expect(
    claudeTurnSetupSchemaFor(null).safeParse({ ...fallback.opening, effort: 'high' }).success,
  ).toBe(false)
  expect(CLAUDE_FALLBACK_TURN_SETUP.source).toBe('fallback')
  expect(CLAUDE_EFFORTS).toContain(fallback.opening.effort)
  expect(CLAUDE_MODES).toContain(fallback.opening.mode)
})

test('uses the safe fallback when the live catalog has no model with a supported effort', () => {
  const catalog = {
    data: [
      {
        value: 'sonnet-live',
        resolvedModel: 'claude-sonnet-live',
        displayName: 'Sonnet Live',
        description: '',
        supportedEffortLevels: [],
      },
    ],
  }
  const choices = claudeTurnSetup(catalog)
  expect(choices.source).toBe('fallback')
  expect(choices.opening).toEqual({ model: 'sonnet', effort: 'medium', mode: 'manual' })
  expect(claudeTurnSetupSchemaFor(catalog).safeParse(choices.opening).success).toBe(true)
})

test('uses the live Claude catalog for composer choices and setup validation', () => {
  const catalog = claudeModelCatalogFixture()
  const choices = claudeTurnSetup(catalog)
  expect(choices.models.map(({ value }) => value)).toEqual(['sonnet-live'])
  expect(choices.models[0]?.efforts).toEqual(['low', 'high'])
  expect(choices.opening).toEqual({ model: 'sonnet-live', effort: 'low', mode: 'manual' })
  const schema = claudeTurnSetupSchemaFor(catalog)
  expect(schema.safeParse({ model: 'sonnet-live', effort: 'high', mode: 'manual' }).success).toBe(
    true,
  )
  expect(schema.safeParse({ model: 'sonnet-live', effort: 'max', mode: 'manual' }).success).toBe(
    false,
  )
})

test('a mockable SDK model query reaches Claude model and effort choices', async () => {
  const cache = new ClaudeModelCatalogCache()
  const catalog = await cache.get(
    { executablePath: '/claude', version: '2.1.1' },
    async (): Promise<readonly ModelInfo[]> => [
      {
        value: 'sonnet-query',
        displayName: 'Sonnet Query',
        description: 'Queried from the SDK',
        supportedEffortLevels: ['low', 'high'],
      },
    ],
  )
  const choices = claudeTurnSetup(catalog)
  expect(choices.models.map(({ value }) => value)).toEqual(['sonnet-query'])
  expect(choices.models[0]?.efforts).toEqual(['low', 'high'])
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

test('offers no Codex setup while the live model catalog is unavailable', () => {
  expect(codexTurnSetup(null)).toBe(null)
  expect(
    codexTurnSetupSchemaFor(null).safeParse({
      model: 'unverified-model',
      effort: 'unverified-effort',
      mode: 'workspace-write',
    }).success,
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
