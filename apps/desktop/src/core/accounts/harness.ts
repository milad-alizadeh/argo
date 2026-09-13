// The Account and Ticket channels exactly as the renderer reaches them, over real files and the
// fake GitHub, for tests. Only the provider and Electron's `safeStorage` are stood in for.
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import { proofEndpoints } from '../../providers/github/endpoints'
import { type FakeGitHub, startFakeGitHub } from '../../providers/github/fake-driver/fake-github'
import { routeTicketRequest } from '../tickets/bridge'
import { createAccountAccess } from './access'
import { createAccountContext, routeAccountRequest } from './bridge'
import type { Cipher } from './grants'

export const PROJECT_ID = 'project-1'
export const OCTOCAT = { id: 583231, login: 'octocat' }

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

export async function harness(context: TestContext) {
  const github: FakeGitHub = await startFakeGitHub()
  const userData = await mkdtemp(path.join(os.tmpdir(), 'argo-accounts-'))
  context.after(async () => {
    await github.close()
    await rm(userData, { recursive: true, force: true })
  })
  await mkdir(path.join(userData, 'portable-v1'))
  const projects = [{ id: PROJECT_ID, path: '/tmp/argo-demo' }]
  const document = { version: 1, projects, selectedId: PROJECT_ID }
  await writeFile(path.join(userData, 'portable-v1', 'projects.json'), JSON.stringify(document))
  const endpoints = proofEndpoints(github.origin)
  if (!endpoints) throw new Error('The fake GitHub is not on a loopback origin')
  const cipher = testCipher()
  const opened: string[] = []
  const openExternal = async (url: string) => {
    opened.push(url)
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
    userData,
    cipher,
    opened,
    replies,
    // The main process's own Account access, for a race no channel can stage.
    access: () => main.access,
    account: async (type: string, fields?: Record<string, string>) =>
      record(await routeAccountRequest(request(type, fields), main.accounts)),
    ticket: async (type: string, fields?: Record<string, string>) =>
      record(
        await routeTicketRequest(request(type, { projectId: PROJECT_ID, ...fields }), main.access),
      ),
    restart: () => {
      main.accounts.signIn.dispose()
      main = boot()
    },
  }
}

// Connect whoever the fake GitHub signs in next, through the steps the renderer takes.
export async function connect(cockpit: Harness) {
  const challenge = await cockpit.account('account.connect')
  if (challenge.type !== 'account.challenge') return challenge
  await cockpit.account('account.verify')
  return cockpit.account('account.await')
}
