import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { databaseMigrationsFolder, openDatabase } from './database'

const WORKTREE_MIGRATION = '20261001215510_session_worktree'
const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((folder) => rm(folder, { recursive: true })))
})

// A database at the migration before the worktree move, with one folder of each old kind.
async function databaseBeforeMove() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-worktree-migration-'))
  temporary.push(root)
  const earlier = path.join(root, 'migrations')
  await cp(databaseMigrationsFolder(), earlier, {
    recursive: true,
    filter: (source) => !source.includes(WORKTREE_MIGRATION),
  })
  const userData = path.join(root, 'user-data')
  const client = openDatabase(userData, { migrationsFolder: earlier }).$client
  client.exec(`
    INSERT INTO project (id, path, common_directory, last_workspace_choice)
      VALUES ('project-1', '/repo', '/repo/.git', 'workspace-imported');
    INSERT INTO workspace (id, project_id, kind, display_name, path) VALUES
      ('workspace-main', 'project-1', 'main', 'Main checkout', '/repo'),
      ('workspace-imported', 'project-1', 'imported', 'feature', '/feature'),
      ('workspace-managed', 'project-1', 'managed', 'session-abc', '/worktrees/abc');
    INSERT INTO session (argo_id, harness, native_id, project_id, workspace_id, cwd) VALUES
      ('session-main', 'claude', 'native-main', 'project-1', 'workspace-main', '/repo'),
      ('session-imported', 'codex', 'native-imported', 'project-1', 'workspace-imported', '/feature'),
      ('session-managed', 'claude', 'native-managed', 'project-1', 'workspace-managed', '/worktrees/abc');
    INSERT INTO session_archive (session_id) VALUES ('session-managed');
    INSERT INTO session_subagent (session_id, subagent_id, state) VALUES ('session-main', 'agent-1', 'completed');
    INSERT INTO session_command (command_id, session_id, status) VALUES ('command-1', 'session-imported', 'completed');
    INSERT INTO composer_draft (id, project_id, workspace_id, harness, model, effort, mode)
      VALUES ('draft-project', 'project-1', 'workspace-managed', 'codex', 'model', 'medium', 'mode');
    INSERT INTO composer_draft (id, session_id, model, effort, mode)
      VALUES ('draft-session', 'session-imported', 'model', 'medium', 'mode');
  `)
  client.close()
  return userData
}

test('moves each Session folder onto the Session and keeps every row that names a Session', async () => {
  const userData = await databaseBeforeMove()
  const client = openDatabase(userData, { migrationsFolder: databaseMigrationsFolder() }).$client
  try {
    expect(
      client
        .prepare(
          'SELECT argo_id, cwd, worktree_path, worktree_branch, worktree_owned FROM session ORDER BY argo_id',
        )
        .all(),
    ).toEqual([
      {
        argo_id: 'session-imported',
        cwd: '/feature',
        worktree_path: '/feature',
        worktree_branch: null,
        worktree_owned: 0,
      },
      {
        argo_id: 'session-main',
        cwd: '/repo',
        worktree_path: null,
        worktree_branch: null,
        worktree_owned: null,
      },
      {
        argo_id: 'session-managed',
        cwd: '/worktrees/abc',
        worktree_path: '/worktrees/abc',
        worktree_branch: 'argo/session-abc',
        worktree_owned: 1,
      },
    ])
    expect(client.prepare('SELECT session_id FROM session_archive').all()).toEqual([
      { session_id: 'session-managed' },
    ])
    expect(client.prepare('SELECT session_id FROM session_subagent').all()).toEqual([
      { session_id: 'session-main' },
    ])
    expect(client.prepare('SELECT session_id FROM session_command').all()).toEqual([
      { session_id: 'session-imported' },
    ])
    expect(
      client.prepare('SELECT id, worktree_choice FROM composer_draft ORDER BY id').all(),
    ).toEqual([
      { id: 'draft-project', worktree_choice: 'new' },
      { id: 'draft-session', worktree_choice: null },
    ])
    expect(client.prepare('SELECT last_worktree_choice FROM project').all()).toEqual([
      { last_worktree_choice: '/feature' },
    ])
    expect(
      client.prepare("SELECT name FROM sqlite_master WHERE name = 'workspace'").all(),
    ).toEqual([])
  } finally {
    client.close()
  }
})
