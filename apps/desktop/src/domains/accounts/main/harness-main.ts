import { createMockIpcWindow, RENDERER_URL } from '../../../../mocks/contract/mock-ipc-window'
import type { MockGitHub } from '../../../../mocks/providers/github/mock-github'
import type { MockLinear } from '../../../../mocks/providers/linear/mock-linear'
import { proofEndpoints } from '../../../providers/github/endpoints'
import { linearProofEndpoints } from '../../../providers/linear/endpoints'
import { createDomainClient } from '../../../shared/ipc/client'
import { ticketError } from '../../tickets/contract/contract'
import { TICKET_OPERATIONS } from '../../tickets/contract/operations'
import { attachTicketBridge } from '../../tickets/main/bridge'
import { accountError } from '../contract/contract'
import { ACCOUNT_OPERATIONS } from '../contract/operations'
import { createAccountAccess } from './access'
import { attachAccountBridge } from './bridge'
import type { Cipher } from './grants'
import type { AccountDispatchClient, TicketDispatchClient } from './harness-dispatch'

const unreachable = (provider: string): never => {
  throw new Error(`The mock ${provider} is not on a loopback origin`)
}

export function accessEndpoints(github: MockGitHub, linear: MockLinear) {
  return {
    github: proofEndpoints(github.origin) ?? unreachable('GitHub'),
    linear: linearProofEndpoints(linear.origin),
  }
}

// A restart is a fresh main process over the same `userData`: nothing survives but the files.
export function bootMain(options: {
  userData: string
  accountData: string
  endpoints: ReturnType<typeof accessEndpoints>
  cipher: Cipher
  openExternal: (url: string) => Promise<void>
  projects: ReturnType<typeof import('./harness-fixtures').projectStore>
}) {
  const { userData, accountData, endpoints, cipher, openExternal, projects } = options
  const access = createAccountAccess({
    userData,
    accountData,
    connectionData: accountData,
    endpoints,
    cipher,
    openExternal,
    projects,
  })
  const ticketWindow = createMockIpcWindow()
  attachTicketBridge(ticketWindow.window, { access, rendererURL: RENDERER_URL })
  const tickets: TicketDispatchClient = createDomainClient(
    TICKET_OPERATIONS,
    (channel, ticketRequest) => ticketWindow.trustedInvoke(channel, ticketRequest),
    ticketError,
  )
  const accountWindow = createMockIpcWindow()
  const accounts = attachAccountBridge(accountWindow.window, { access, rendererURL: RENDERER_URL })
  const accountClient: AccountDispatchClient = createDomainClient(
    ACCOUNT_OPERATIONS,
    (channel, accountRequest) => accountWindow.trustedInvoke(channel, accountRequest),
    accountError,
  )
  return { access, accounts, accountClient, accountInvoke: accountWindow.trustedInvoke, tickets }
}
