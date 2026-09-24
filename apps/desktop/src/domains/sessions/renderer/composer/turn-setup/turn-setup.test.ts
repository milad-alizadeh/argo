import { expect, test } from 'bun:test'
import {
  claudeChoices,
  codexChoices,
} from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
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

test('keeps a valid Model and uses its own Effort when a remembered Effort disappears', () => {
  const choices = claudeChoices({
    supportedPermissionModes: ['manual'],
    data: [
      {
        value: 'opening',
        displayName: 'Opening',
        description: '',
        supportedEffortLevels: ['medium'],
      },
      {
        value: 'retained',
        displayName: 'Retained',
        description: '',
        supportedEffortLevels: ['high'],
      },
    ],
  })
  if (choices === null) throw new Error('The test catalog has no choices.')
  const identity = { kind: 'draft', projectId: 'project-1' } as const
  expect(choices.opening.effort).toBe('medium')
  expect(
    resolvedTurnSetup(choices, {
      identity,
      chosen: new Map(),
      rows: [],
      remembered: { model: 'retained', effort: 'retired' },
    }),
  ).toEqual({ model: 'retained', effort: 'high', mode: 'manual' })
  expect(
    setupFromReading(choices, {
      model: 'retained',
      effort: 'retired',
      mode: 'manual',
    }),
  ).toEqual({ model: 'retained', effort: 'high', mode: 'manual' })
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
