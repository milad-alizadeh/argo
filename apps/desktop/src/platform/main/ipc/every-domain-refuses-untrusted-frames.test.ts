// A regression the generic echo domain in shared/ipc/ipc.test.ts cannot catch: every real domain's
// `attachXBridge` actually wires `registerDomainHandlers` in, rather than a handler reachable by
// some other path. Appearance is the one bridge that touches `nativeTheme`, so it is the one
// domain here that needs Electron stood in, exactly as appearance.test.ts does; the stand-in
// is registered before the dynamic imports below, since a static import would resolve the real
// `electron` package first.
import { mock } from 'bun:test'
import { electronStandIn } from '@/platform/main/test-doubles/electron-stand-in'

mock.module('electron', () => electronStandIn)

const [
  { mkdtemp, rm },
  os,
  path,
  { test },
  assert,
  { createMockIpcWindow, RENDERER_URL },
  { GITHUB_ENDPOINTS },
  { accountProviders, ticketSources },
  { createAccountAccess },
  { createConnectionPort },
  { attachAccountBridge },
  { ACCOUNT_OPERATIONS },
  { attachHarnessSignInBridge },
  { HARNESS_SIGN_IN_OPERATIONS },
  { createHarnessReadinessRegistrations },
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
  import('../../../../mocks/contract/mock-ipc-window'),
  import('@/providers/github/endpoints'),
  import('@/providers/composition'),
  import('@/domains/accounts/main/access'),
  import('@/domains/connections/main/port'),
  import('@/domains/accounts/main/bridge'),
  import('@/domains/accounts/contract/operations'),
  import('@/domains/harness-signin/main/bridge'),
  import('@/domains/harness-signin/contract/operations'),
  import('@/harnesses/composition/registered-harness-readiness'),
  import('@/domains/tickets/main/bridge'),
  import('@/domains/tickets/contract/operations'),
  import('@/domains/projects/main/bridge'),
  import('@/domains/projects/contract/operations'),
  import('@/domains/sessions/main/composition/bridge'),
  import('@/domains/sessions/contract/ipc/operations'),
  import('@/platform/main/appearance'),
  import('@/platform/contract/appearance'),
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

function accountAndTicketMocks(userData: string, rendererURL: string) {
  const access = createAccountAccess({
    userData,
    accountData: userData,
    endpoints: { github: GITHUB_ENDPOINTS, linear: null },
    providers: accountProviders,
    cipher: { available: () => false, encrypt: () => Buffer.alloc(0), decrypt: () => '' },
    openExternal: async () => undefined,
  })

  const accountMock = createMockIpcWindow()
  attachAccountBridge(accountMock.window, { access, rendererURL })

  const ticketMock = createMockIpcWindow()
  attachTicketBridge(ticketMock.window, {
    access,
    connections: createConnectionPort({
      path: access.paths.connections,
      exclusive: access.exclusive,
    }),
    rendererURL,
    sources: ticketSources,
  })

  return { accountMock, ticketMock }
}

async function domains(userData: string) {
  const rendererURL = RENDERER_URL
  const projectMock = createMockIpcWindow()
  Object.assign(projectMock.window, { once: () => undefined })
  attachProjectBridge(projectMock.window, {
    projects: neverCalled(),
    rendererURL,
    onboardingDriver: neverCalled(),
  })

  const sessionMock = createMockIpcWindow()
  attachSessionBridge(sessionMock.window, { ...neverCalled<SessionContext>(), rendererURL })

  const { accountMock, ticketMock } = accountAndTicketMocks(userData, rendererURL)

  const harnessSignInMock = createMockIpcWindow()
  attachHarnessSignInBridge(harnessSignInMock.window, {
    registrations: createHarnessReadinessRegistrations({ proofEnabled: false }),
    rendererURL,
  })

  const appearanceMock = createMockIpcWindow()
  attachAppearanceBridge(appearanceMock.window, { userData, rendererURL })

  const descriptors = [
    ['project', projectMock, PROJECT_OPERATIONS, 'project.error'],
    ['session', sessionMock, SESSION_OPERATIONS, 'session.error'],
    ['account', accountMock, ACCOUNT_OPERATIONS, 'account.error'],
    ['harness-sign-in', harnessSignInMock, HARNESS_SIGN_IN_OPERATIONS, 'harness-sign-in.error'],
    ['ticket', ticketMock, TICKET_OPERATIONS, 'ticket.error'],
    ['appearance', appearanceMock, APPEARANCE_OPERATIONS, 'appearance.error'],
  ] as const
  return descriptors.map(([name, mock, operations, errorType]) => ({
    name,
    mock,
    operations,
    errorType,
  }))
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
