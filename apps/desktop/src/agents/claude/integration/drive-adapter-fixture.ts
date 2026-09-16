import type { createClaudeDriveAdapter } from '../drive/session-drive-adapter.ts'

export const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'

type DriverOptions = Parameters<typeof createClaudeDriveAdapter>[0]

export function mockDriver(overrides: Partial<DriverOptions> = {}) {
  return {
    start: () => sessionId,
    compact: async () => {},
    send: async () => {},
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => true,
    isLockedElsewhere: () => false,
    ...overrides,
  } as DriverOptions
}
