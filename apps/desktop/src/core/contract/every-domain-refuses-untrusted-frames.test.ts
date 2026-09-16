// A regression the generic echo domain in domain.test.ts cannot catch: that every real domain's
// `attachXBridge` actually wires `registerDomainHandlers` in, rather than a handler reachable by
// some other path. Appearance is the one bridge that touches `nativeTheme`, so it is the one
// domain here that needs Electron stood in, exactly as appearance/bridge.test.ts does; the stand-in
// is registered before the dynamic imports below, since a static import would resolve the real
// `electron` package first.
import { mock } from 'bun:test'
import { electronStandIn } from './electron-stand-in'

mock.module('electron', () => electronStandIn)

const [
  { mkdtemp, rm },
  os,
  path,
  { test },
  assert,
  { createMockIpcWindow, RENDERER_URL },
  { GITHUB_ENDPOINTS },
  { createAccountAccess },
  { attachAccountBridge },
  { ACCOUNT_OPERATIONS },
  { attachTicketBridge },
  { TICKET_OPERATIONS },
  { attachProjectBridge },
  { PROJECT_OPERATIONS },
  { attachSessionBridge },
  { SESSION_OPERATIONS },
  { attachAppearanceBridge },
  { APPEARANCE_OPERATIONS },
] = await Promise.all([
  import('node:fs/promises'),
  import('node:os').then((module) => module.default),
  import('node:path').then((module) => module.default),
  import('node:test'),
  import('node:assert/strict').then((module) => module.default),
  import('../../../mocks/contract/mock-ipc-window'),
  import('../../providers/github/endpoints'),
  import('../accounts/access'),
  import('../accounts/bridge'),
  import('../accounts/operations'),
  import('../tickets/bridge'),
  import('../tickets/operations'),
  import('../projects/bridge'),
  import('../projects/operations'),
  import('../sessions/bridge'),
  import('../sessions/operations'),
  import('../appearance/bridge'),
  import('../appearance/appearance'),
])

type SessionContext = Parameters<typeof attachSessionBridge>[1]

// Handlers never run under an untrusted frame, so a fixture only has to satisfy the type: any
// call into it is itself a test failure worth seeing crash loudly.
function neverCalled<T>(): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('a handler ran for a request an untrusted frame should never reach')
      },
    },
  ) as T
}

async function domains(userData: string) {
  const rendererURL = RENDERER_URL
  const projectMock = createMockIpcWindow()
  attachProjectBridge(projectMock.window, { userData, rendererURL })

  const sessionMock = createMockIpcWindow()
  attachSessionBridge(sessionMock.window, { ...neverCalled<SessionContext>(), rendererURL })

  const access = createAccountAccess({
    userData,
    accountData: userData,
    endpoints: { github: GITHUB_ENDPOINTS, linear: null },
    cipher: { available: () => false, encrypt: () => Buffer.alloc(0), decrypt: () => '' },
    openExternal: async () => undefined,
  })

  const accountMock = createMockIpcWindow()
  attachAccountBridge(accountMock.window, { access, rendererURL })

  const ticketMock = createMockIpcWindow()
  attachTicketBridge(ticketMock.window, { access, rendererURL })

  const appearanceMock = createMockIpcWindow()
  attachAppearanceBridge(appearanceMock.window, { userData, rendererURL })

  return [
    {
      name: 'project',
      mock: projectMock,
      operations: PROJECT_OPERATIONS,
      errorType: 'project.error',
    },
    {
      name: 'session',
      mock: sessionMock,
      operations: SESSION_OPERATIONS,
      errorType: 'session.error',
    },
    {
      name: 'account',
      mock: accountMock,
      operations: ACCOUNT_OPERATIONS,
      errorType: 'account.error',
    },
    { name: 'ticket', mock: ticketMock, operations: TICKET_OPERATIONS, errorType: 'ticket.error' },
    {
      name: 'appearance',
      mock: appearanceMock,
      operations: APPEARANCE_OPERATIONS,
      errorType: 'appearance.error',
    },
  ] as const
}

test('every operation of every domain refuses an untrusted frame', async (context) => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-every-domain-'))
  context.after(() => rm(userData, { recursive: true, force: true }))

  for (const domain of await domains(userData)) {
    for (const [key, operation] of Object.entries<{ channel: string; name: string }>(
      domain.operations,
    )) {
      const reply = (await domain.mock.untrustedInvoke(operation.channel, {
        version: 1,
        type: operation.name,
        requestId: `${domain.name}-${key}`,
      })) as { type: string; code: string }
      assert.equal(
        reply.type,
        domain.errorType,
        `${domain.name}.${key} should answer with its own error type`,
      )
      assert.equal(
        reply.code,
        'access-denied',
        `${domain.name}.${key} should refuse an untrusted frame`,
      )
    }
  }
})
