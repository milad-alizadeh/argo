import { expect, test } from 'bun:test'
import { claudeModelCatalogFixture } from '../../../test-fixtures/sessions/claude-model-catalog.fixture'
import { claudeHarnessInfo, claudeModelCatalogSchema, permissionModesFromHelp } from './catalog'

test('reads permission modes from the installed Claude CLI help', () => {
  expect(
    permissionModesFromHelp(
      '  --permission-mode <mode> Permission mode to use for the session (choices: "acceptEdits", "auto", "manual")\n  --permission-prompts <target>',
    ),
  ).toEqual(['acceptEdits', 'auto', 'manual'])
})

test('keeps a new permission mode advertised by Claude CLI help', () => {
  expect(
    permissionModesFromHelp(
      '  --permission-mode <mode> Permission mode (choices: "workspaceAudit")\n  --permission-prompts <target>',
    ),
  ).toEqual(['workspaceAudit'])
})

test('reports no permission modes when Claude CLI help does not advertise them', () => {
  expect(permissionModesFromHelp('Usage: claude [options]')).toEqual([])
})

test('rejects an unrecognized Claude catalog response', () => {
  expect(claudeModelCatalogSchema.safeParse({ data: [{ value: 'unknown-shape' }] }).success).toBe(
    false,
  )
  const info = claudeHarnessInfo({
    data: [{ value: 'unknown-shape' }],
    supportedPermissionModes: ['manual'],
  })
  expect(info).toMatchObject({
    harness: 'claude',
    availability: 'unavailable',
    reason: 'invalid-response',
  })
  if (info.availability === 'unavailable') expect(info.detail).toContain('displayName')
})

test('normalizes Claude defaults and model-specific permission modes at the Harness boundary', () => {
  const info = claudeHarnessInfo(claudeModelCatalogFixture())
  expect(info.availability).toBe('available')
  if (info.availability !== 'available') throw new Error('Claude fixture should be available.')
  expect(info.defaultModelId).toBe('sonnet-live')
  expect(info.models[0]?.efforts).toEqual(['low', 'high'])
  expect(info.models[0]?.supportedModes).toEqual([
    'manual',
    'acceptEdits',
    'plan',
    'dontAsk',
    'bypassPermissions',
  ])
})
