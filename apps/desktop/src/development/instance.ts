import path from 'node:path'
import { z } from 'zod'

const INSTANCE_DIRECTORY_ENV = 'ARGO_DESKTOP_INSTANCE_DIRECTORY'
const INSTANCE_ID_ENV = 'ARGO_DESKTOP_INSTANCE_ID'
const LAUNCHER_PID_ENV = 'ARGO_DESKTOP_LAUNCHER_PID'
const CONTROL_FILE_ENV = 'ARGO_DESKTOP_CONTROL_FILE'
const CONTROL_TOKEN_ENV = 'ARGO_DESKTOP_CONTROL_TOKEN'
const PORT_ENV = 'ARGO_DESKTOP_DEV_PORT'
const DEBUG_PORT_ENV = 'ARGO_DESKTOP_DEBUG_PORT'
const WINDOW_TITLE_ENV = 'ARGO_DESKTOP_WINDOW_TITLE'
const WORKTREE_ENV = 'ARGO_DESKTOP_WORKTREE'
const BUILD_LABEL_ENV = 'ARGO_DESKTOP_BUILD_LABEL'
const IDENTITY_ARGUMENT_PREFIX = '--argo-desktop-development-identity='

export type DevelopmentIdentity = {
  id: string
  label: string
  title: string
  worktree: string
}

const developmentIdentitySchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  title: z.string().min(1),
  worktree: z.string().min(1),
})

export type DevelopmentInstance = {
  controlFile: string
  controlTokenFile: string
  controlToken: string
  debugPort: number
  directory: string
  id: string
  label: string
  launcherPid: number
  port: number
  title: string
  userData: string
  readyFile: string
  worktree: string
}

type Environment = Record<string, string | undefined>

function required(environment: Environment, name: string): string {
  const value = environment[name]
  if (!value) throw new Error(`Development launch needs ${name}. Start it with bun run dev.`)
  return value
}

function absolute(value: string, name: string): string {
  if (!path.isAbsolute(value)) throw new Error(`${name} must be an absolute path.`)
  return value
}

function integer(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer.`)
  return parsed
}

function listeningPort(environment: Environment, name: string): number {
  const parsed = integer(required(environment, name), name)
  if (parsed < 1024 || parsed > 65_535) throw new Error(`${name} must be between 1024 and 65535.`)
  return parsed
}

export function developmentInstance(
  environment: Environment = process.env,
): DevelopmentInstance | null {
  const directory = environment[INSTANCE_DIRECTORY_ENV]
  const id = environment[INSTANCE_ID_ENV]
  const launcherPid = environment[LAUNCHER_PID_ENV]
  const controlFile = environment[CONTROL_FILE_ENV]
  const controlToken = environment[CONTROL_TOKEN_ENV]
  const port = environment[PORT_ENV]
  const debugPort = environment[DEBUG_PORT_ENV]
  const title = environment[WINDOW_TITLE_ENV]
  const worktree = environment[WORKTREE_ENV]
  const label = environment[BUILD_LABEL_ENV]
  const values = [
    directory,
    id,
    launcherPid,
    controlFile,
    controlToken,
    port,
    debugPort,
    title,
    worktree,
    label,
  ]

  if (values.every((value) => value === undefined)) return null

  const parsedPort = listeningPort(environment, PORT_ENV)

  const parsedLauncherPid = integer(required(environment, LAUNCHER_PID_ENV), LAUNCHER_PID_ENV)
  if (parsedLauncherPid < 1) throw new Error(`${LAUNCHER_PID_ENV} must be positive.`)
  const parsedDebugPort = listeningPort(environment, DEBUG_PORT_ENV)

  return {
    controlFile: absolute(required(environment, CONTROL_FILE_ENV), CONTROL_FILE_ENV),
    controlTokenFile: path.join(required(environment, INSTANCE_DIRECTORY_ENV), 'control-token'),
    controlToken: required(environment, CONTROL_TOKEN_ENV),
    debugPort: parsedDebugPort,
    directory: absolute(required(environment, INSTANCE_DIRECTORY_ENV), INSTANCE_DIRECTORY_ENV),
    id: required(environment, INSTANCE_ID_ENV),
    label: required(environment, BUILD_LABEL_ENV),
    launcherPid: parsedLauncherPid,
    port: parsedPort,
    title: required(environment, WINDOW_TITLE_ENV),
    userData: path.join(required(environment, INSTANCE_DIRECTORY_ENV), 'user-data'),
    readyFile: path.join(required(environment, INSTANCE_DIRECTORY_ENV), 'ready.json'),
    worktree: absolute(required(environment, WORKTREE_ENV), WORKTREE_ENV),
  }
}

export function developmentIdentity(
  environment: Environment = process.env,
): DevelopmentIdentity | null {
  const id = environment[INSTANCE_ID_ENV]
  const label = environment[BUILD_LABEL_ENV]
  const title = environment[WINDOW_TITLE_ENV]
  const worktree = environment[WORKTREE_ENV]
  if (!id || !label || !title || !worktree) return null
  return { id, label, title, worktree: absolute(worktree, WORKTREE_ENV) }
}

export function developmentIdentityArgument(identity: DevelopmentIdentity): string {
  return `${IDENTITY_ARGUMENT_PREFIX}${JSON.stringify(identity)}`
}

export function developmentIdentityFromArguments(
  arguments_: readonly string[],
): DevelopmentIdentity | null {
  const argument = arguments_.find((value) => value.startsWith(IDENTITY_ARGUMENT_PREFIX))
  if (!argument) return null

  try {
    const value: unknown = JSON.parse(argument.slice(IDENTITY_ARGUMENT_PREFIX.length))
    const parsed = developmentIdentitySchema.safeParse(value)
    if (!parsed.success) return null
    return { ...parsed.data, worktree: absolute(parsed.data.worktree, WORKTREE_ENV) }
  } catch {
    return null
  }
}

export function developmentReadyRecord(instance: DevelopmentInstance, windowId: number) {
  return {
    version: 1,
    state: 'ready' as const,
    id: instance.id,
    label: instance.label,
    processId: process.pid,
    launcherPid: instance.launcherPid,
    port: instance.port,
    debugPort: instance.debugPort,
    title: instance.title,
    worktree: instance.worktree,
    userData: instance.userData,
    windowId,
  }
}
