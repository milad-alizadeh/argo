import type { ClaudeSessionDriver } from '../../../src/harnesses/claude/drive/claude-session-driver.ts'

export const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'

// A Claude driver that starts one Session and does nothing else; a test overrides what it asserts on.
export function mockDriver(overrides: Partial<ClaudeSessionDriver> = {}): ClaudeSessionDriver {
  return {
    start: () => sessionId,
    compact: async () => {},
    beginCompaction: () => {},
    completeCompaction: () => {},
    handoff: async () => {},
    completeHandoffs: () => {},
    send: async () => {},
    interrupt: () => {},
    rename: async (_sessionId, name) => name,
    liveMessages: () => [],
    roster: () => [],
    isLockedElsewhere: () => false,
    pendingPermission: () => null,
    onPermissionsChanged: () => () => {},
    decidePermission: () => true,
    decideQuestion: async () => true,
    close: () => {},
    ...overrides,
  }
}
