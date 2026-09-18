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
`

const projectRowSchema = z.strictObject({
  id: identifierSchema,
  path: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
  common_directory: z.string().refine((value) => path.isAbsolute(value) && !value.includes('\0')),
})
const selectedRowSchema = z.strictObject({ project_id: identifierSchema.nullable() })

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

export function createProjectStore(database: ProjectDatabase): ProjectStore {
  database.exec(PROJECT_SCHEMA)
  const insert = database.prepare(
    'INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)',
  )
  const select = database.prepare(
    'INSERT INTO project_selection (singleton, project_id) VALUES (1, ?) ON CONFLICT(singleton) DO UPDATE SET project_id = excluded.project_id',
  )

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

    close: () => database.close(),
  }
}

import path from 'node:path'
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
