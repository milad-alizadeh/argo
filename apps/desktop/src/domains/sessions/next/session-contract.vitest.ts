import { expect, test } from 'vitest'
import {
  agentSchema,
  capabilitiesFor,
  HARNESSES,
  sessionCommandSchema,
  sessionIdentitySchema,
  sessionProjectionSchema,
  workspaceForAgent,
} from '@/domains/sessions/next/contract/session-contract'

test('keeps native Session IDs separate by Harness', () => {
  const claude = sessionIdentitySchema.parse({ harness: 'claude', nativeId: 'shared' })
  const codex = sessionIdentitySchema.parse({ harness: 'codex', nativeId: 'shared' })

  expect(claude).not.toEqual(codex)
})

test('inherits a Workspace reference from a parent Agent', () => {
  const root = agentSchema.parse({
    id: 'root',
    parentId: null,
    workspace: { id: 'workspace-1' },
  })
  const child = agentSchema.parse({ id: 'child', parentId: 'root', workspace: null })

  expect(workspaceForAgent(child, [root, child])).toEqual({ id: 'workspace-1' })
})

test('keeps Workspace identity stable when its branch changes', () => {
  const session = { harness: 'claude', nativeId: 'native-1' }
  const before = sessionProjectionSchema.parse({
    session,
    posture: 'managed',
    sourceHealth: 'ready',
    revision: 1,
    workspace: { id: 'workspace-1' },
  })
  const after = sessionProjectionSchema.parse({
    session,
    posture: 'managed',
    sourceHealth: 'ready',
    revision: 2,
    workspace: { id: 'workspace-1' },
  })

  expect(before.workspace).toEqual(after.workspace)
})

test('rejects malformed product commands at the Session boundary', () => {
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.send',
      session: { harness: 'claude', nativeId: '' },
      prompt: 'Continue the work.',
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.send',
      session: { harness: 'claude', nativeId: 'native-1' },
      prompt: '   ',
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.start',
      harness: 'unknown',
      prompt: 'Start.',
      workspace: { kind: 'main' },
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.start',
      harness: 'claude',
      prompt: 'Start.',
      workspace: { kind: 'new', baseRef: '' },
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.start',
      harness: 'claude',
      prompt: 'Start.',
      workspace: { kind: 'existing', workspaceId: 'workspace-1', worktree: true },
    }).success,
  ).toBe(false)
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.interrupt',
      session: { harness: 'codex', nativeId: 'native-1' },
      unexpected: true,
    }).success,
  ).toBe(false)
  expect(
    sessionProjectionSchema.safeParse({
      session: { harness: 'claude', nativeId: 'native-1' },
      posture: 'managed',
      sourceHealth: 'unknown',
      revision: -1,
      workspace: { id: 'workspace-1', branch: 'main' },
    }).success,
  ).toBe(false)
})

test.each([
  { kind: 'main' },
  { kind: 'existing', workspaceId: 'workspace-1' },
  { kind: 'new', baseRef: 'origin/main' },
])('accepts a valid Workspace selection: %o', (workspace) => {
  expect(
    sessionCommandSchema.safeParse({
      type: 'session.start',
      harness: 'claude',
      prompt: 'Start.',
      workspace,
    }).success,
  ).toBe(true)
})

test('maps every capability for every supported Harness', () => {
  expect(
    Object.fromEntries(HARNESSES.map((harness) => [harness, capabilitiesFor(harness)])),
  ).toEqual({
    claude: { start: true, send: true, interrupt: true },
    codex: { start: true, send: true, interrupt: true },
  })
})
