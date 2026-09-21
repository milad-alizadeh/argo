import path from 'node:path'
import { z } from 'zod'
import type { ProjectSetupRecord } from '@/domains/projects/main/setup/project-setup-registry'
import { projectSetupStore } from '@/domains/projects/main/setup/project-setup-sqlite-store'
import { identifierSchema } from '@/shared/validation'
import { createSetupWorktreePromotion } from './project-store-promotion'
import {
  migrateSetupCheckpoints,
  readSetupCheckpoint,
  type SetupCheckpoint,
} from './setup-checkpoint-store'

export type { ProjectSetupRecord } from '@/domains/projects/main/setup/project-setup-registry'
export type { SetupCheckpoint } from './setup-checkpoint-store'

export type ProjectRegistration = {
  id: string
  path: string
  commonDirectory: string
}

export type ProjectRegistry = {
  projects: ProjectRegistration[]
  selectedId: string | null
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
  insertProject: (project: ProjectRegistration) => void
  selectProject: (projectId: string) => void
  updateProjectPath: (projectId: string, projectPath: string) => void
  promoteSetupWorktree: (projectId: string, worktreePath: string) => void
  readSetupCheckpoint: (projectId: string) => SetupCheckpoint | null
  writeSetupCheckpoint: (checkpoint: SetupCheckpoint) => void
  readProjectSetup: (projectId: string) => ProjectSetupRecord | null
  writeProjectSetup: (record: ProjectSetupRecord) => void
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
  configuration_source TEXT NOT NULL,
  document_revision TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS project_setup_actor (
  project_id TEXT PRIMARY KEY REFERENCES project(id),
  checkpoint_version INTEGER NOT NULL CHECK (checkpoint_version = 1),
  machine_version INTEGER NOT NULL CHECK (machine_version > 0),
  revision INTEGER NOT NULL CHECK (revision >= 0),
  persisted_snapshot TEXT NOT NULL,
  receipts TEXT NOT NULL,
  saved_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS project_setup_effect (
  project_id TEXT PRIMARY KEY REFERENCES project(id),
  intent_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  saved_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS project_setup_recovery (
  project_id TEXT PRIMARY KEY REFERENCES project(id),
  raw_record TEXT NOT NULL,
  reason TEXT NOT NULL,
  saved_at TEXT NOT NULL
) STRICT;
`

const projectRowSchema = z.strictObject({
  id: identifierSchema,
  path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  common_directory: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
})
const selectedRowSchema = z.strictObject({ project_id: identifierSchema.nullable() })
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

export function createProjectStore(
  database: ProjectDatabase,
  afterWrite: () => void = () => {},
): ProjectStore {
  database.exec(PROJECT_SCHEMA)
  migrateSetupCheckpoints(database)
  const insert = database.prepare(
    'INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)',
  )
  const select = database.prepare(
    'INSERT INTO project_selection (singleton, project_id) VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET project_id = excluded.project_id',
  )
  const writeCheckpoint = database.prepare(
    'INSERT INTO project_setup_checkpoint (project_id, worktree_path, phase, configuration_source, document_revision) VALUES (?, ?, ?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET worktree_path = excluded.worktree_path, phase = excluded.phase, configuration_source = excluded.configuration_source, document_revision = excluded.document_revision',
  )
  const updatePath = database.prepare('UPDATE project SET path = ? WHERE id = ?')
  const promoteSetupWorktree = createSetupWorktreePromotion({ afterWrite, database, updatePath })
  return {
    read: () => readRegistry(database),

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
        afterWrite()
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    },

    insertProject: (project) => {
      insert.run(project.id, project.path, project.commonDirectory)
      afterWrite()
    },

    selectProject: (projectId) => {
      select.run(projectId)
      afterWrite()
    },

    updateProjectPath: (projectId, projectPath) => {
      updatePath.run(projectPath, projectId)
      afterWrite()
    },

    promoteSetupWorktree,

    readSetupCheckpoint: (projectId) => readSetupCheckpoint(database, projectId),

    writeSetupCheckpoint: ({
      projectId,
      worktreePath,
      phase,
      configurationSource,
      documentRevision,
    }) => {
      writeCheckpoint.run(projectId, worktreePath, phase, configurationSource, documentRevision)
      afterWrite()
    },

    ...projectSetupStore(database, afterWrite),

    close: () => database.close(),
  }
}

function readRegistry(database: ProjectDatabase): ProjectRegistry {
  const registered = projects(database)
  const selected = selectedId(database)
  return {
    projects: registered,
    selectedId: registered.some((project) => project.id === selected) ? selected : null,
  }
}
