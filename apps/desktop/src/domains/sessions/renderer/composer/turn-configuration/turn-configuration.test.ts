import { expect, test } from 'bun:test'
import { claudeChoices } from '../../../../../../test-fixtures/sessions/harness-catalog.fixture'
import {
  configurationFromReading,
  initialTurnConfiguration,
  supportedConfiguration,
} from './turn-configuration'

const CLAUDE_TURN_CONFIGURATION = claudeChoices({
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
if (CLAUDE_TURN_CONFIGURATION === null)
  throw new Error('The Claude test catalog has no usable model.')

test('reads a Turn configuration off the Harness words its transcript wrote', () => {
  expect(
    configurationFromReading(CLAUDE_TURN_CONFIGURATION, {
      model: 'claude-sonnet-5',
      effort: 'xhigh',
      mode: 'default',
    }),
  ).toEqual({ model: 'sonnet', effort: 'xhigh', mode: 'manual' })
})

test('keeps a stable model alias for historical resolved IDs', () => {
  expect(
    configurationFromReading(CLAUDE_TURN_CONFIGURATION, {
      model: 'claude-sonnet-4-5',
      effort: 'high',
      mode: 'manual',
    }),
  ).toEqual({ model: 'sonnet', effort: 'high', mode: 'manual' })
})

test('keeps the opening choice for what the transcript has not stated or Argo does not offer', () => {
  expect(
    configurationFromReading(CLAUDE_TURN_CONFIGURATION, {
      model: 'claude-mythos-1',
      effort: null,
      mode: null,
    }),
  ).toEqual(CLAUDE_TURN_CONFIGURATION.opening)
})

test('keeps each restored choice Argo still offers and replaces the rest', () => {
  expect(
    supportedConfiguration(
      CLAUDE_TURN_CONFIGURATION,
      { model: 'claude-mythos-1', effort: 'xhigh', mode: 'yolo' },
      { model: 'sonnet', effort: 'low', mode: 'plan' },
    ),
  ).toEqual({ model: 'sonnet', effort: 'xhigh', mode: 'plan' })
})

test('starts a new draft from the catalog opening Turn configuration', () => {
  const identity = { kind: 'draft', projectId: 'project-1' } as const
  expect(
    initialTurnConfiguration(CLAUDE_TURN_CONFIGURATION, {
      identity,
      rows: [],
    }),
  ).toEqual(CLAUDE_TURN_CONFIGURATION.opening)
})

test('starts a Session draft from its persisted roster configuration', () => {
  const identity = { kind: 'session', sessionId: 'session-1' } as const
  const rows = [
    {
      id: 'session-1',
      turnConfiguration: { model: 'claude-opus-5', effort: 'max', mode: 'bypassPermissions' },
    },
  ]
  expect(
    initialTurnConfiguration(CLAUDE_TURN_CONFIGURATION, {
      identity,
      rows,
    }),
  ).toEqual({ model: 'opus', effort: 'max', mode: 'bypassPermissions' })
  expect(
    initialTurnConfiguration(CLAUDE_TURN_CONFIGURATION, {
      identity,
      rows: [],
    }),
  ).toEqual(CLAUDE_TURN_CONFIGURATION.opening)
})
