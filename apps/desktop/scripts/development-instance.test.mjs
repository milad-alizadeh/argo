import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import {
  developmentIdentity,
  developmentIdentityArgument,
  developmentIdentityFromArguments,
  developmentInstance,
  developmentReadyRecord,
} from '../src/development/instance.ts'

const directory = path.join(path.sep, 'tmp', 'argo-desktop-dev', 'ticket-2173')
const environment = {
  ARGO_DESKTOP_INSTANCE_DIRECTORY: directory,
  ARGO_DESKTOP_INSTANCE_ID: 'ticket-2173-a1b2c3d4',
  ARGO_DESKTOP_BUILD_LABEL: '#2173',
  ARGO_DESKTOP_LAUNCHER_PID: '42',
  ARGO_DESKTOP_CONTROL_FILE: path.join(directory, 'control.sock'),
  ARGO_DESKTOP_CONTROL_TOKEN: 'control-token',
  ARGO_DESKTOP_DEBUG_PORT: '45174',
  ARGO_DESKTOP_DEV_PORT: '45173',
  ARGO_DESKTOP_WINDOW_TITLE: 'Argo dev · ticket-2173 · :45173',
  ARGO_DESKTOP_WORKTREE: path.join(path.sep, 'worktrees', 'ticket-2173'),
}

describe('development instances', () => {
  test('keeps the development state inside its instance directory', () => {
    expect(developmentInstance(environment)).toMatchObject({
      directory,
      controlFile: path.join(directory, 'control.sock'),
      controlTokenFile: path.join(directory, 'control-token'),
      controlToken: 'control-token',
      debugPort: 45174,
      label: '#2173',
      port: 45173,
      readyFile: path.join(directory, 'ready.json'),
      userData: path.join(directory, 'user-data'),
      worktree: environment.ARGO_DESKTOP_WORKTREE,
    })
  })

  test('refuses an incomplete development environment', () => {
    expect(() => developmentInstance({ ARGO_DESKTOP_DEV_PORT: '45173' })).toThrow(
      'Development launch needs ARGO_DESKTOP_LAUNCHER_PID.',
    )
  })

  test('exposes only the non-secret renderer identity', () => {
    expect(developmentIdentity(environment)).toEqual({
      id: environment.ARGO_DESKTOP_INSTANCE_ID,
      label: '#2173',
      title: environment.ARGO_DESKTOP_WINDOW_TITLE,
      worktree: environment.ARGO_DESKTOP_WORKTREE,
    })
    expect(developmentIdentity({ ARGO_DESKTOP_INSTANCE_ID: 'partial' })).toBeNull()
  })

  test('refuses a debugging port outside the unprivileged range', () => {
    expect(() => developmentInstance({ ...environment, ARGO_DESKTOP_DEBUG_PORT: '80' })).toThrow(
      'ARGO_DESKTOP_DEBUG_PORT must be between 1024 and 65535.',
    )
  })

  test('reports the process, worktree, and state that the app actually uses', () => {
    const instance = developmentInstance(environment)
    if (!instance) throw new Error('development instance was not created')

    expect(developmentReadyRecord(instance, 17)).toMatchObject({
      id: environment.ARGO_DESKTOP_INSTANCE_ID,
      label: '#2173',
      launcherPid: 42,
      port: 45173,
      debugPort: 45174,
      state: 'ready',
      title: environment.ARGO_DESKTOP_WINDOW_TITLE,
      userData: path.join(directory, 'user-data'),
      windowId: 17,
      worktree: environment.ARGO_DESKTOP_WORKTREE,
    })
  })
})

describe('development identity argument', () => {
  test('passes the renderer identity through the Electron argument boundary', () => {
    const identity = developmentIdentity(environment)
    if (!identity) throw new Error('development identity was not created')

    expect(
      developmentIdentityFromArguments(['electron', developmentIdentityArgument(identity)]),
    ).toEqual(identity)
    expect(developmentIdentityFromArguments(['electron'])).toBeNull()
    expect(
      developmentIdentityFromArguments([
        'electron',
        '--argo-desktop-development-identity={"id":"instance"}',
      ]),
    ).toBeNull()
  })
})
