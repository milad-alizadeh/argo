import { ipcMain } from 'electron'
import {
  type CommandResult,
  GIT_FACTS_CHANNEL,
  GIT_OPERATION_CHANNEL,
  GIT_OPERATIONS,
  type GitFacts,
  type GitOperation,
  type GitRequest,
} from '../shared'
import { readGitFacts, runGitOperation } from './git'
import type { Hub } from './hub'
import { projectFolder } from './projectFolder'

// The Electron-coupled seam over the git module (ADR-0004: main runs git). Both handlers only
// dispatch: validate the payload, resolve the Project's folder, call one unit. Which rows the
// menu offers and which it refuses is derived on the renderer's side from the facts.
export function wireGit(hub: Hub): void {
  ipcMain.handle(GIT_FACTS_CHANNEL, (_event, payload: unknown): Promise<GitFacts | null> => {
    const folder = isProjectId(payload) ? projectFolder(hub.getState(), payload) : null
    return folder === null ? Promise.resolve(null) : readGitFacts(folder)
  })

  ipcMain.handle(GIT_OPERATION_CHANNEL, (_event, payload: unknown): Promise<CommandResult> => {
    if (!isGitRequest(payload)) return refuse('malformed git request')

    const folder = projectFolder(hub.getState(), payload.projectId)
    if (folder === null) return refuse('unknown project')
    return runGitOperation(folder, payload)
  })
}

const refuse = (detail: string): Promise<CommandResult> => Promise.resolve({ ok: false, detail })

function isProjectId(value: unknown): value is string {
  return typeof value === 'string'
}

function isGitRequest(value: unknown): value is GitRequest {
  if (typeof value !== 'object' || value === null) return false
  if (!('projectId' in value) || typeof value.projectId !== 'string') return false
  if (!('operation' in value) || !isGitOperation(value.operation)) return false
  if (!('ref' in value)) return true
  return value.ref === undefined || typeof value.ref === 'string'
}

function isGitOperation(value: unknown): value is GitOperation {
  return typeof value === 'string' && GIT_OPERATIONS.some((operation) => operation === value)
}
