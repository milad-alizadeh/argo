import { expect, test } from 'bun:test'
import { claudeModelCatalogSchema } from '@/harnesses/claude/catalog'
import { claudeTurnSetupSchemaFor } from '@/domains/sessions/contract/claude-turn-setup'
import { codexTurnSetupSchemaFor } from '@/domains/sessions/contract/codex-turn-setup'
import { claudeTurnSetupSchema } from '@/domains/sessions/contract/ipc/contract'
import { claudeModelCatalogFixture } from '../../../../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { codexModelCatalogFixture } from '../../../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { claudeChoices, codexChoices } from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
import {
  refusalOf,
  resolvedTurnSetup,
  setupFromReading,
  supportedSetup,
  turnSettled,
} from './turn-setup'

const requested = { model: 'opus', effort: 'max', mode: 'bypassPermissions' }
const CLAUDE_TURN_SETUP = claudeChoices({
  supportedPermissionModes: [
    'manual',
    'acceptEdits',
    'plan',
    'auto',
    'dontAsk',
    'bypassPermissions',
  ],
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
if (CLAUDE_TURN_SETUP === null) throw new Error('The Claude test catalog has no usable model.')

test('reads a Session setup off the Harness words its transcript wrote', () => {
  expect(
    setupFromReading(CLAUDE_TURN_SETUP, {
      model: 'claude-sonnet-5',
      effort: 'xhigh',
      mode: 'default',
    }),
  ).toEqual({ model: 'sonnet', effort: 'xhigh', mode: 'manual' })
})

test('keeps a stable model alias for historical resolved IDs', () => {
  expect(
    setupFromReading(CLAUDE_TURN_SETUP, {
      model: 'claude-sonnet-4-5',
      effort: 'high',
      mode: 'manual',
    }),
  ).toEqual({ model: 'sonnet', effort: 'high', mode: 'manual' })
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

test('offers no Claude setup before a live model catalog is available', () => {
  expect(claudeChoices(null)).toBe(null)
  expect(claudeTurnSetupSchema.safeParse(undefined).success).toBe(false)
  expect(claudeTurnSetupSchemaFor(null).safeParse(undefined).success).toBe(true)
  expect(
    claudeTurnSetupSchemaFor(null).safeParse({ model: 'sonnet', effort: 'medium', mode: 'manual' })
      .success,
  ).toBe(false)
  expect(CLAUDE_TURN_SETUP.modes.map(({ value }) => value)).toContain('manual')
})

test('offers no Claude setup when the live catalog has no model with a supported effort', () => {
  const catalog = {
    supportedPermissionModes: ['manual'],
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
  expect(claudeChoices(catalog)).toBe(null)
  expect(
    claudeTurnSetupSchemaFor(catalog).safeParse({
      model: 'sonnet',
      effort: 'medium',
      mode: 'manual',
    }).success,
  ).toBe(false)
})

test('uses the live Claude catalog for composer choices and setup validation', () => {
  const catalog = claudeModelCatalogFixture()
  const choices = claudeChoices(catalog)
  if (choices === null) throw new Error('The mock Claude catalog has no usable model.')
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

test('accepts effort values supplied by the Claude model catalog', () => {
  const parsed = claudeModelCatalogSchema.safeParse({
    supportedPermissionModes: ['manual'],
    data: [
      {
        value: 'sonnet-live',
        displayName: 'Sonnet Live',
        description: '',
        supportedEffortLevels: ['ultra'],
      },
    ],
  })
  expect(parsed.success).toBe(true)
  if (!parsed.success) throw new Error('The Claude model catalog rejected its advertised effort.')
  const choices = claudeChoices(parsed.data)
  if (choices === null) throw new Error('The Claude catalog has no usable model.')
  expect(choices.models[0]?.efforts).toEqual(['ultra'])
  expect(
    claudeTurnSetupSchemaFor(parsed.data).safeParse({
      model: 'sonnet-live',
      effort: 'ultra',
      mode: 'manual',
    }).success,
  ).toBe(true)
  expect(choices.modes.map(({ value }) => value)).toEqual(['manual'])
})

test('accepts permission modes supplied by the Claude CLI', () => {
  const catalog = {
    supportedPermissionModes: ['workspaceAudit'],
    data: [
      {
        value: 'sonnet-live',
        displayName: 'Sonnet Live',
        description: '',
        supportedEffortLevels: ['ultra'],
      },
    ],
  }
  const choices = claudeChoices(catalog)
  if (choices === null) throw new Error('The Claude catalog has no usable choices.')
  expect(choices.modes.map(({ value }) => value)).toEqual(['workspaceAudit'])
  expect(
    claudeTurnSetupSchemaFor(catalog).safeParse({
      model: 'sonnet-live',
      effort: 'ultra',
      mode: 'workspaceAudit',
    }).success,
  ).toBe(true)
})

test('advertised models and efforts become the Codex composer choices and schema rules', () => {
  const catalog = codexModelCatalogFixture()
  const choices = codexChoices(catalog)
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
  expect(codexChoices(null)).toBe(null)
  expect(
    codexTurnSetupSchemaFor(null).safeParse({
      model: 'unverified-model',
      effort: 'unverified-effort',
      mode: 'workspace-write',
    }).success,
  ).toBe(false)
})

test('replaces an explicit model and effort removed by a live catalog refresh', () => {
  const identity = { kind: 'draft', projectId: 'project-1' } as const
  const choices = codexChoices({
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
