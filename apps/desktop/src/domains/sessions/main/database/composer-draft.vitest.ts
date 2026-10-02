import { eq } from 'drizzle-orm'
import { expect, onTestFinished, test } from 'vitest'
import { composerDraft } from '@/database/composer-draft/schema'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import { insertComposerDraft, readComposerDraft } from './composer-draft'

const content = {
  prompt: '',
  attachments: [],
  ticketContext: [],
  turnConfiguration: { model: 'gpt-6', effort: 'high', mode: 'workspace-write' },
}

test('stores a new worktree and its start in typed columns the database checks', () => {
  const database = migratedDatabase()
  onTestFinished(() => database.$client.close())
  insertProject(database, 'project-1')
  const target = {
    type: 'project' as const,
    projectId: 'project-1',
    worktree: { type: 'new' as const, from: 'main' },
    harness: 'codex' as const,
  }
  insertComposerDraft(database, { id: 'draft-1', target, ...content })
  expect(database.select().from(composerDraft).get()).toMatchObject({
    worktree: 'new',
    worktreeFromBranch: 'main',
  })
  expect(readComposerDraft(database, 'draft-1')?.target).toEqual(target)
  // The CHECK constraint a write breaks, from the SQLite error under drizzle's own.
  const brokenCheck = (values: Partial<typeof composerDraft.$inferInsert>) => {
    try {
      database.update(composerDraft).set(values).where(eq(composerDraft.id, 'draft-1')).run()
      return null
    } catch (error) {
      return String((error as Error).cause).match(/CHECK constraint failed: (\w+)/)?.[1]
    }
  }
  expect(brokenCheck({ worktree: 'main' })).toBe('composer_draft_worktree_from')
  expect(brokenCheck({ worktreeFromBranch: '-x' })).toBe('composer_draft_worktree_from_branch')
  expect(brokenCheck({ worktree: null })).toBe('composer_draft_new_session_fields')
})
