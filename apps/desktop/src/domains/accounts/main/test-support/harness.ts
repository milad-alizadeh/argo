// The Account and Ticket channels exactly as the renderer reaches them, over real files and the
// mock providers, for tests. Only the providers and Electron's `safeStorage` are stood in for.
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import type { Cipher } from '@/domains/accounts/main/grants'
import { dispatchAccount, dispatchTicket } from '@/domains/accounts/main/harness-dispatch'
import { PROJECT_ID, projectStore } from '@/domains/accounts/main/harness-fixtures'
import { accessEndpoints, bootMain } from '@/domains/accounts/main/harness-main'
import { type MockGitHub, startMockGitHub } from '../../../../mocks/providers/github/mock-github'
import { type MockLinear, startMockLinear } from '../../../../mocks/providers/linear/mock-linear'

export { LIST, OCTOCAT, PROJECT_ID } from '@/domains/accounts/main/harness-fixtures'

// Reversible and never the plaintext, so a test can look for the token in every byte written.
export function testCipher(): Cipher & { enabled: boolean } {
  const cipher = {
    enabled: true,
    available: () => cipher.enabled,
    encrypt: (text: string) => Buffer.from(`sealed:${[...text].reverse().join('')}`),
    decrypt: (data: Buffer) => [...data.toString().replace(/^sealed:/, '')].reverse().join(''),
  }
  return cipher
}

export type Harness = Awaited<ReturnType<typeof harness>>

// One cockpit's own application data, holding the one Project its Tickets are read for.
async function makeUserData(context: TestContext): Promise<string> {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-accounts-'))
  context.after(() => rm(userData, { recursive: true, force: true }))
  return userData
}

export async function harness(context: TestContext) {
  const github: MockGitHub = await startMockGitHub()
  const linear: MockLinear = await startMockLinear()
  const userData = await makeUserData(context)
  const projects = projectStore(PROJECT_ID)
  context.after(async () => {
    await github.close()
    await linear.close()
  })
  const endpoints = accessEndpoints(github, linear)
  const cipher = testCipher()
  const opened: string[] = []
  // The person's browser: Linear's consent page is followed, as a signed-in person would.
  const openExternal = async (url: string) => {
    opened.push(url)
    if (new URL(url).origin === linear.origin) void fetch(url).catch(() => undefined)
  }
  // The Account store is this cockpit's own until a test points a second cockpit at it.
  const accountData = userData
  let main = bootMain({ userData, accountData, endpoints, cipher, openExternal, projects })
  // Every reply that crossed to the renderer, in order.
  const replies: unknown[] = []
  const record = (reply: unknown) => {
    replies.push(reply)
    return reply as Record<string, unknown>
  }
  return {
    github,
    linear,
    userData,
    cipher,
    opened,
    replies,
    // The main process's own Account access, for a race no channel can stage.
    access: () => main.access,
    // The raw channel, for a request the typed client could never construct.
    rawAccount: (channel: string, request: unknown) => main.accountInvoke(channel, request),
    account: async (type: string, fields: Record<string, string> = {}) =>
      record(await dispatchAccount(main.accountClient, type, fields)),
    ticket: async (type: string, fields: Record<string, unknown> = {}) =>
      record(await dispatchTicket(main.tickets, type, fields)),
    restart: () => {
      main.accounts.signIn.dispose()
      main = bootMain({ userData, accountData, endpoints, cipher, openExternal, projects })
    },
    // A second cockpit over the shared development stores, with its own ephemeral application data.
    otherCockpit: async (projectId: string) => {
      const otherUserData = await makeUserData(context)
      const other = bootMain({
        userData: otherUserData,
        accountData,
        endpoints,
        cipher,
        openExternal,
        projects: projectStore(projectId),
      })
      context.after(() => other.accounts.signIn.dispose())
      return {
        account: (type: string, fields: Record<string, string> = {}) =>
          dispatchAccount(other.accountClient, type, fields) as Promise<Record<string, unknown>>,
        ticket: (type: string, fields: Record<string, unknown> = {}) =>
          dispatchTicket(other.tickets, type, fields) as Promise<Record<string, unknown>>,
      }
    },
  }
}

// Connect whoever the provider's mock signs in next, through the steps the renderer takes.
export async function connect(cockpit: Harness, provider: 'github' | 'linear' = 'github') {
  const challenge = await cockpit.account('account.connect', { provider })
  if (challenge.type !== 'account.challenge') return challenge
  await cockpit.account('account.verify')
  return cockpit.account('account.await')
}
