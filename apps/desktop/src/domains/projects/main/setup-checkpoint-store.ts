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
}

const checkpointRowSchema = z.strictObject({
  project_id: identifierSchema,
  worktree_path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  phase: setupPhaseSchema,
  configuration_source: z.string(),
  document_revision: z.string(),
})

export function readSetupCheckpoint(
  database: ProjectDatabase,
  projectId: string,
): SetupCheckpoint | null {
  const row = database
    .prepare(
      'SELECT project_id, worktree_path, phase, configuration_source, document_revision FROM project_setup_checkpoint WHERE project_id = ?',
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
  }
}
