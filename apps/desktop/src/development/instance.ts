import path from 'node:path'

const INSTANCE_DIRECTORY_ENV = 'ARGO_DESKTOP_INSTANCE_DIRECTORY'
const INSTANCE_ID_ENV = 'ARGO_DESKTOP_INSTANCE_ID'
const LAUNCHER_PID_ENV = 'ARGO_DESKTOP_LAUNCHER_PID'
const CONTROL_FILE_ENV = 'ARGO_DESKTOP_CONTROL_FILE'
const CONTROL_TOKEN_ENV = 'ARGO_DESKTOP_CONTROL_TOKEN'
const PORT_ENV = 'ARGO_DESKTOP_DEV_PORT'
const WINDOW_TITLE_ENV = 'ARGO_DESKTOP_WINDOW_TITLE'
const WORKTREE_ENV = 'ARGO_DESKTOP_WORKTREE'

export type DevelopmentInstance = {
  controlFile: string
  controlToken: string
  directory: string
  id: string
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

export function developmentInstance(
  environment: Environment = process.env,
): DevelopmentInstance | null {
  const directory = environment[INSTANCE_DIRECTORY_ENV]
  const id = environment[INSTANCE_ID_ENV]
  const launcherPid = environment[LAUNCHER_PID_ENV]
  const controlFile = environment[CONTROL_FILE_ENV]
  const controlToken = environment[CONTROL_TOKEN_ENV]
  const port = environment[PORT_ENV]
  const title = environment[WINDOW_TITLE_ENV]
  const worktree = environment[WORKTREE_ENV]
  const values = [directory, id, launcherPid, controlFile, controlToken, port, title, worktree]

  if (values.every((value) => value === undefined)) return null

  const parsedPort = integer(required(environment, PORT_ENV), PORT_ENV)
  if (parsedPort < 1024 || parsedPort > 65_535)
    throw new Error(`${PORT_ENV} must be between 1024 and 65535.`)

  const parsedLauncherPid = integer(required(environment, LAUNCHER_PID_ENV), LAUNCHER_PID_ENV)
  if (parsedLauncherPid < 1) throw new Error(`${LAUNCHER_PID_ENV} must be positive.`)

  return {
    controlFile: absolute(required(environment, CONTROL_FILE_ENV), CONTROL_FILE_ENV),
    controlToken: required(environment, CONTROL_TOKEN_ENV),
    directory: absolute(required(environment, INSTANCE_DIRECTORY_ENV), INSTANCE_DIRECTORY_ENV),
    id: required(environment, INSTANCE_ID_ENV),
    launcherPid: parsedLauncherPid,
    port: parsedPort,
    title: required(environment, WINDOW_TITLE_ENV),
    userData: path.join(required(environment, INSTANCE_DIRECTORY_ENV), 'user-data'),
    readyFile: path.join(required(environment, INSTANCE_DIRECTORY_ENV), 'ready.json'),
    worktree: absolute(required(environment, WORKTREE_ENV), WORKTREE_ENV),
  }
}

export function developmentReadyRecord(instance: DevelopmentInstance, windowId: number) {
  return {
    version: 1,
    state: 'ready' as const,
    id: instance.id,
    processId: process.pid,
    launcherPid: instance.launcherPid,
    port: instance.port,
    title: instance.title,
    worktree: instance.worktree,
    userData: instance.userData,
    windowId,
  }
}
