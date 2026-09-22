import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SessionService } from '../../../src/domains/sessions/next/main/session-service.ts'
import { createCodexSessionAdapter } from '../../../src/harnesses/codex/drive/session/codex-session-adapter.ts'
import { writeMockCodex } from './mock-codex-driver.ts'

function sessionService(released: string[] = []): SessionService {
  return {
    acquire: () => ({ posture: 'managed' }),
    renew: () => ({ posture: 'managed' }),
    release: (session) => released.push(session.nativeId),
  }
}

export function createAdapter(executable: string, released?: string[]) {
  return createCodexSessionAdapter({
    findExecutable: () => executable,
    sessionService: sessionService(released),
    waitForWorkspaceReady: async () => {},
    now: () => new Date(),
    resolveWorkspace: async () => ({ workspaceId: 'workspace-1', cwd: process.cwd() }),
  })
}

export async function createMockAdapter(released?: string[]) {
  const executable = await writeMockCodex(
    await mkdtemp(path.join(os.tmpdir(), 'argo-codex-adapter-')),
  )
  return createAdapter(executable, released)
}

export async function mockCodexExecutable() {
  return writeMockCodex(await mkdtemp(path.join(os.tmpdir(), 'argo-codex-adapter-')))
}

export async function waitFor(check: () => boolean) {
  const deadline = Date.now() + 1_000
  while (!check()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for managed Session lifecycle')
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}
