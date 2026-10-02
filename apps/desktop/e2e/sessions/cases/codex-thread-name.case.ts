import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'
import type { Page } from 'playwright-core'
import { mockCodexStateFile } from '../../../mocks/cli/codex/mock-codex-cli'
import { RECORDED_PROMPTS } from '../../../mocks/cli/recorded-prompts'
import { fixtureSessionId } from '../../../mocks/sessions/mock-transcript-files'
import { CODEX_PARENT } from '../../../mocks/sessions/mock-codex-thread-files'
import { refreshSessions } from '../gestures'
import { sessionRows } from '../page-trpc'

const THREAD = fixtureSessionId(CODEX_PARENT)
const NAME = 'Named by Codex Desktop'

// Codex Desktop renames a thread in the store the mock app-server's `thread/list` answers from.
async function renameInCodexDesktop(root: string) {
  const file = mockCodexStateFile(root)
  const threads = JSON.parse(await readFile(file, 'utf8')) as { id: string; name?: string }[]
  const thread = threads.find((candidate) => candidate.id === THREAD)
  assert.ok(thread !== undefined, `The mock Codex store holds no ${CODEX_PARENT} thread.`)
  thread.name = NAME
  await writeFile(file, JSON.stringify(threads))
}

async function sessionListName(page: Page) {
  const rows = await sessionRows(page)
  const named = rows.find(
    (session) => session.name === RECORDED_PROMPTS.codexCommand || session.name === NAME,
  )
  return named?.name ?? null
}

export async function proveCodexThreadName(page: Page, root: string) {
  assert.equal(await sessionListName(page), RECORDED_PROMPTS.codexCommand)
  await renameInCodexDesktop(root)
  // Argo reads the name from the Harness's thread list, which a sync asks for.
  await refreshSessions(page)
  const deadline = Date.now() + 10_000
  let name = await sessionListName(page)
  while (name !== NAME && Date.now() < deadline) {
    await setTimeout(100)
    name = await sessionListName(page)
  }
  assert.equal(name, NAME)
}
