import assert from 'node:assert/strict'
import type { Page } from '@playwright/test'
import { test } from './session-proof-run'

async function defaultCodexModel(page: Page) {
  await page.waitForFunction(
    async () => (await window.argo.readCodexModelCatalog()) !== null,
    null,
    {
      timeout: 15_000,
    },
  )
  const catalog = await page.evaluate(() => window.argo.readCodexModelCatalog())
  const model = catalog?.data.find(({ hidden }) => !hidden)
  assert.ok(model, 'Codex model catalog has a visible model')
  return { model: model.model, effort: model.defaultReasoningEffort }
}

async function startCodexFromRoot(
  page: Page,
  options: {
    setup: Awaited<ReturnType<typeof defaultCodexModel>>
    prompt: string
    root: 'project' | 'workspace'
  },
) {
  return page.evaluate(async ({ setup, prompt, root }) => {
    const projects = await window.argo.listProjects()
    if (projects.type !== 'project.listed' || projects.selectedId === null) return projects
    const project = projects.projects.find(({ id }) => id === projects.selectedId)
    if (project === undefined) return { type: 'project-missing' }
    const cwd =
      root === 'project'
        ? project.path
        : await window.argo.listProjectWorkspaces({ projectId: project.id }).then((reply) => {
            if (reply.type !== 'project.workspace.listed') return null
            return reply.workspaces.find(({ kind }) => kind === 'main')?.path ?? null
          })
    if (cwd === null) return { type: root === 'project' ? 'project-missing' : 'workspace-missing' }
    return window.argo.startSession({
      harness: 'codex',
      cwd,
      prompt,
      setup: { ...setup, mode: 'workspace-write' },
    })
  }, options)
}

// Every case here spawns a real Codex app-server child process on top of the packaged app's own
// 30s launch budget (playwright.config.ts), so the suite's general 60s timeout leaves little
// margin; a busy CI runner pushed the app-server handshake past it (#2653 follow-up).
test.beforeEach(() => {
  test.setTimeout(120_000)
})

test('starts a managed Codex Session through app-server', async ({ session }) => {
  await defaultCodexModel(session.page())
  const outcome = await session.page().evaluate(() =>
    window.argo.executeManagedSessionCommand({
      type: 'session.start',
      harness: 'codex',
      prompt: 'Start through the managed bridge.',
      workspace: { kind: 'main' },
    }),
  )

  assert.equal(outcome.kind, 'accepted', JSON.stringify(outcome))
})

test('starts Codex through the existing composer command boundary', async ({ session }) => {
  const setup = await defaultCodexModel(session.page())
  const reply = await startCodexFromRoot(session.page(), {
    setup,
    prompt: 'Start through the composer boundary.',
    root: 'workspace',
  })

  assert.equal(reply.type, 'session.started', JSON.stringify(reply))
})

test('starts Codex from the selected Project root when no Workspace is chosen', async ({
  session,
}) => {
  const setup = await defaultCodexModel(session.page())
  const reply = await startCodexFromRoot(session.page(), {
    setup,
    prompt: 'Start from the selected Project root.',
    root: 'project',
  })

  assert.equal(reply.type, 'session.started', JSON.stringify(reply))
})
