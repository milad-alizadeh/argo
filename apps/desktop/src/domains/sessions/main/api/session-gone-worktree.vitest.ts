import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { project } from '@/database/project/schema'
import { IDS, insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'

const GONE = '/nowhere/worktrees/session-1'
const worktree = { worktreePath: GONE, worktreeBranch: 'argo/session-1', worktreeBase: 'main' }

test('opening a Session whose worktree is gone moves it to the main checkout at once', async () => {
  const { database, leaveGoneWorktree, details, changes } = sessionListCaller()
  insertSession(database, { id: IDS[0], cwd: GONE, ...worktree })
  const announced = await changes()
  try {
    expect(await leaveGoneWorktree({ sessionId: IDS[0] })).toEqual({ worktreeGone: GONE })
    expect(await details({ sessionId: IDS[0] })).toMatchObject({
      cwd: '/repo/project-1',
      worktree: null,
    })
    await expect.poll(() => announced.received).toEqual([{ sessionIds: [IDS[0]] }])
    // The worktree is already cleared, so a second open has nothing to tell.
    expect(await leaveGoneWorktree({ sessionId: IDS[0] })).toEqual({ worktreeGone: null })
  } finally {
    announced.stop()
    database.$client.close()
  }
})

test('a Session whose worktree folder is there keeps it', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-present-worktree-'))
  const { database, leaveGoneWorktree, details } = sessionListCaller()
  insertSession(database, { id: IDS[0], cwd: folder, ...worktree, worktreePath: folder })
  try {
    expect(await leaveGoneWorktree({ sessionId: IDS[0] })).toEqual({ worktreeGone: null })
    expect(await details({ sessionId: IDS[0] })).toMatchObject({
      cwd: folder,
      worktree: { path: folder },
    })
  } finally {
    database.$client.close()
    await rm(folder, { recursive: true, force: true })
  }
})

// A Send then refuses it with its own reason, so opening it changes and tells nothing.
test('a Session with no Project keeps its gone worktree on open', async () => {
  const { database, leaveGoneWorktree, details } = sessionListCaller()
  insertSession(database, { id: IDS[0], cwd: GONE, ...worktree })
  database.delete(project).run()
  try {
    expect(await leaveGoneWorktree({ sessionId: IDS[0] })).toEqual({ worktreeGone: null })
    expect(await details({ sessionId: IDS[0] })).toMatchObject({ worktree: { path: GONE } })
  } finally {
    database.$client.close()
  }
})
