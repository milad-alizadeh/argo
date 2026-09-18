export type ProjectRegistration = {
  id: string
  path: string
  commonDirectory: string
}

export type ProjectRegistry = {
  projects: ProjectRegistration[]
  selectedId: string | null
}

export const setupPhaseSchema = z.enum(['editing', 'validating', 'ready', 'failed', 'cancelled'])
export type SetupPhase = z.infer<typeof setupPhaseSchema>

export type SetupCheckpoint = {
  projectId: string
  worktreePath: string
  phase: SetupPhase
  configurationSource: string
}

type Statement = {
  all: (...values: string[]) => unknown[]
  get: (...values: string[]) => unknown
  run: (...values: string[]) => unknown
}

export type ProjectDatabase = {
  exec: (source: string) => void
  prepare: (source: string) => Statement
  close: () => void
}

export type ProjectStore = {
  read: () => ProjectRegistry
  replace: (registry: ProjectRegistry) => void
  updateProjectPath: (projectId: string, projectPath: string) => void
  readSetupCheckpoint: (projectId: string) => SetupCheckpoint | null
  writeSetupCheckpoint: (checkpoint: SetupCheckpoint) => void
  close: () => void
}

const PROJECT_SCHEMA = `
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  common_directory TEXT NOT NULL UNIQUE
) STRICT;
CREATE TABLE IF NOT EXISTS project_selection (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  project_id TEXT REFERENCES project(id)
) STRICT;
CREATE TABLE IF NOT EXISTS project_setup_checkpoint (
  project_id TEXT PRIMARY KEY REFERENCES project(id),
  worktree_path TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('editing', 'validating', 'ready', 'failed', 'cancelled')),
  configuration_source TEXT NOT NULL
) STRICT;
`

const projectRowSchema = z.strictObject({
  id: identifierSchema,
  path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  common_directory: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
})
const selectedRowSchema = z.strictObject({ project_id: identifierSchema.nullable() })
const checkpointRowSchema = z.strictObject({
  project_id: identifierSchema,
  worktree_path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  phase: setupPhaseSchema,
  configuration_source: z.string(),
})

export function isProjectStoreInvalid(error: unknown): boolean {
  return error instanceof z.ZodError
}

function projects(database: ProjectDatabase): ProjectRegistration[] {
  const rows = projectRowSchema
    .array()
    .parse(database.prepare('SELECT id, path, common_directory FROM project ORDER BY rowid').all())
  return rows.map((row) => ({
    id: row.id,
    path: row.path,
    commonDirectory: row.common_directory,
  }))
}

function selectedId(database: ProjectDatabase): string | null {
  const result = database
    .prepare('SELECT project_id FROM project_selection WHERE singleton = 1')
    .get()
  if (result === undefined || result === null) return null
  return selectedRowSchema.parse(result).project_id
}

function checkpoint(database: ProjectDatabase, projectId: string): SetupCheckpoint | null {
  const row = database
    .prepare(
      'SELECT project_id, worktree_path, phase, configuration_source FROM project_setup_checkpoint WHERE project_id = ?',
    )
    .get(projectId)
  if (row === undefined || row === null) return null
  const parsed = checkpointRowSchema.parse(row)
  return {
    projectId: parsed.project_id,
    worktreePath: parsed.worktree_path,
    phase: parsed.phase,
    configurationSource: parsed.configuration_source,
  }
}

export function createProjectStore(database: ProjectDatabase): ProjectStore {
  database.exec(PROJECT_SCHEMA)
  try {
    database.exec(
      "ALTER TABLE project_setup_checkpoint ADD COLUMN configuration_source TEXT NOT NULL DEFAULT ''",
    )
  } catch {
    // A new database creates the column above; an existing one has it after this migration.
  }
  const insert = database.prepare(
    'INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)',
  )
  const select = database.prepare(
    'INSERT INTO project_selection (singleton, project_id) VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET project_id = excluded.project_id',
  )
  const writeCheckpoint = database.prepare(
    'INSERT INTO project_setup_checkpoint (project_id, worktree_path, phase, configuration_source) VALUES (?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET worktree_path = excluded.worktree_path, phase = excluded.phase, configuration_source = excluded.configuration_source',
  )
  const updatePath = database.prepare('UPDATE project SET path = ? WHERE id = ?')

  return {
    read: () => {
      const registered = projects(database)
      const selected = selectedId(database)
      return {
        projects: registered,
        selectedId: registered.some((project) => project.id === selected) ? selected : null,
      }
    },

    replace(registry) {
      database.exec('BEGIN')
      try {
        database.exec('DELETE FROM project_selection')
        database.exec('DELETE FROM project')
        for (const project of registry.projects) {
          insert.run(project.id, project.path, project.commonDirectory)
        }
        if (registry.selectedId !== null) select.run(registry.selectedId)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },

    updateProjectPath: (projectId, projectPath) => {
      updatePath.run(projectPath, projectId)
    },

    readSetupCheckpoint: (projectId) => checkpoint(database, projectId),

    writeSetupCheckpoint: ({ projectId, worktreePath, phase, configurationSource }) => {
      writeCheckpoint.run(projectId, worktreePath, phase, configurationSource)
    },

    close: () => database.close(),
  }
}

import path from 'node:path'
import { z } from 'zod'
import { identifierSchema } from '@/boundary'
