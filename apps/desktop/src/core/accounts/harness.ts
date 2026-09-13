// The Account and Ticket channels exactly as the renderer reaches them, over real files and the
// fake providers, for tests. Only the providers and Electron's `safeStorage` are stood in for.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { proofEndpoints } from '../../providers/github/endpoints'
import { type FakeGitHub, startFakeGitHub } from '../../providers/github/fake-driver/fake-github'
import { linearProofEndpoints } from '../../providers/linear/endpoints'
import { type FakeLinear, startFakeLinear } from '../../providers/linear/fake-driver/fake-linear'
import { routeTicketRequest } from '../tickets/bridge'
import { createAccountAccess } from './access'
import { createAccountContext, routeAccountRequest } from './bridge'
import type { Cipher } from './grants'

export const PROJECT_ID = 'project-1'
export const OCTOCAT = { id: 583231, login: 'octocat' }
// The first page of the open backlog, unsearched.
export const LIST = { query: '', cursor: null }

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

const unreachable = (provider: string): never => {
  throw new Error(`The fake ${provider} is not on a loopback origin`)
}

export async function harness(context: TestContext) {
  const github: FakeGitHub = await startFakeGitHub()
  const linear: FakeLinear = await startFakeLinear()
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-accounts-'))
  context.after(async () => {
    await github.close()
    await linear.close()
    await rm(userData, { recursive: true, force: true })
  })
  await mkdir(path.join(userData, 'portable-v1'))
  const projects = [{ id: PROJECT_ID, path: '/tmp/argo-demo' }]
  const document = { version: 1, projects, selectedId: PROJECT_ID }
  await writeFile(path.join(userData, 'portable-v1', 'projects.json'), JSON.stringify(document))
  const endpoints = {
    github: proofEndpoints(github.origin) ?? unreachable('GitHub'),
    linear: linearProofEndpoints(linear.origin),
  }
  const cipher = testCipher()
  const opened: string[] = []
  // The person's browser: Linear's consent page is followed, as a signed-in person would.
  const openExternal = async (url: string) => {
    opened.push(url)
    if (new URL(url).origin === linear.origin) void fetch(url).catch(() => undefined)
  }
  // A restart is a fresh main process over the same `userData`: nothing survives but the files.
  const boot = () => {
    const access = createAccountAccess({ userData, endpoints, cipher, openExternal })
    return { access, accounts: createAccountContext(access) }
  }
  let main = boot()
  // Every reply that crossed to the renderer, in order.
  const replies: unknown[] = []
  let serial = 0
  const request = (type: string, fields: Record<string, string> = {}) => {
    serial += 1
    return { version: 1, type, requestId: `request-${serial}`, ...fields }
  }
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
    account: async (type: string, fields?: Record<string, string>) =>
      record(await routeAccountRequest(request(type, fields), main.accounts)),
    ticket: async (type: string, fields?: Record<string, unknown>) =>
      record(
        await routeTicketRequest(request(type, { projectId: PROJECT_ID, ...fields }), main.access),
      ),
    restart: () => {
      main.accounts.signIn.dispose()
      main = boot()
    },
  }
}

// Connect whoever the provider's fake signs in next, through the steps the renderer takes.
export async function connect(cockpit: Harness, provider: 'github' | 'linear' = 'github') {
  const challenge = await cockpit.account('account.connect', { provider })
  if (challenge.type !== 'account.challenge') return challenge
  await cockpit.account('account.verify')
  return cockpit.account('account.await')
}
