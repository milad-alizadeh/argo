import path from 'node:path'
import { z } from 'zod'
import { identifierSchema } from '@/shared/validation'
import type { ProjectDatabase } from './sqlite-store'

const setupPhaseSchema = z.enum(['editing', 'validating', 'ready', 'failed', 'cancelled'])
type SetupPhase = z.infer<typeof setupPhaseSchema>

export type SetupCheckpoint = {
  projectId: string
  worktreePath: string
  phase: SetupPhase
  configurationSource: string
  documentRevision: string
  sessionId?: string | null
}

const checkpointRowSchema = z.strictObject({
  project_id: identifierSchema,
  worktree_path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  phase: setupPhaseSchema,
  configuration_source: z.string(),
  document_revision: z.string(),
  session_id: identifierSchema.nullable(),
})

export function readSetupCheckpoint(
  database: ProjectDatabase,
  projectId: string,
): SetupCheckpoint | null {
  const row = database
    .prepare(
      'SELECT project_id, worktree_path, phase, configuration_source, document_revision, session_id FROM project_setup_checkpoint WHERE project_id = ?',
    )
    .get(projectId)
  if (row === undefined || row === null) return null
  const parsed = checkpointRowSchema.parse(row)
  return {
    projectId: parsed.project_id,
    worktreePath: parsed.worktree_path,
    phase: parsed.phase,
    configurationSource: parsed.configuration_source,
    documentRevision: parsed.document_revision,
    sessionId: parsed.session_id,
  }
}

export function migrateSetupCheckpoints(database: ProjectDatabase) {
  for (const column of ['configuration_source', 'document_revision']) {
    try {
      database.exec(
        `ALTER TABLE project_setup_checkpoint ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`,
      )
    } catch {
      // A new database creates each column in the table definition.
    }
  }
  try {
    database.exec('ALTER TABLE project_setup_checkpoint ADD COLUMN session_id TEXT')
  } catch {
    // A new database creates the column in the table definition.
  }
}
