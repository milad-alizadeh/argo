import assert from 'node:assert/strict'
import { test } from './session-proof-run'

// Every case here spawns a real Codex app-server child process on top of the packaged app's own
// 30s launch budget (playwright.config.ts), so the suite's general 60s timeout leaves little
// margin; a busy CI runner pushed the app-server handshake past it (#2653 follow-up).
test.beforeEach(() => {
  test.setTimeout(120_000)
})

test('starts a managed Codex Session through app-server', async ({ session }) => {
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
  const reply = await session.page().evaluate(async () => {
    const projects = await window.argo.listProjects()
    if (projects.type !== 'project.listed' || projects.selectedId === null) return projects
    const workspaces = await window.argo.listProjectWorkspaces({ projectId: projects.selectedId })
    if (workspaces.type !== 'project.workspace.listed') return workspaces
    const workspace = workspaces.workspaces.find(({ kind }) => kind === 'main')
    if (workspace === undefined) return { type: 'workspace-missing' }
    return window.argo.startSession({
      harness: 'codex',
      cwd: workspace.path,
      prompt: 'Start through the composer boundary.',
      setup: { model: 'gpt-5.6-sol', effort: 'low', mode: 'workspace-write' },
    })
  })

  assert.equal(reply.type, 'session.started', JSON.stringify(reply))
})

test('starts Codex from the selected Project root when no Workspace is chosen', async ({
  session,
}) => {
  const reply = await session.page().evaluate(async () => {
    const projects = await window.argo.listProjects()
    if (projects.type !== 'project.listed' || projects.selectedId === null) return projects
    const project = projects.projects.find(({ id }) => id === projects.selectedId)
    if (project === undefined) return { type: 'project-missing' }
    return window.argo.startSession({
      harness: 'codex',
      cwd: project.path,
      prompt: 'Start from the selected Project root.',
      setup: { model: 'gpt-5.6-sol', effort: 'low', mode: 'workspace-write' },
    })
  })

  assert.equal(reply.type, 'session.started', JSON.stringify(reply))
})
