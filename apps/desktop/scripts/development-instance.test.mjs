import { describe, expect, test } from 'bun:test'
import path from 'node:path'
import { developmentInstance, developmentReadyRecord } from '../src/development/instance.ts'

const directory = path.join(path.sep, 'tmp', 'argo-desktop-dev', 'ticket-2173')
const environment = {
  ARGO_DESKTOP_INSTANCE_DIRECTORY: directory,
  ARGO_DESKTOP_INSTANCE_ID: 'ticket-2173-a1b2c3d4',
  ARGO_DESKTOP_LAUNCHER_PID: '42',
  ARGO_DESKTOP_CONTROL_FILE: path.join(directory, 'control.sock'),
  ARGO_DESKTOP_CONTROL_TOKEN: 'control-token',
  ARGO_DESKTOP_DEV_PORT: '45173',
  ARGO_DESKTOP_WINDOW_TITLE: 'Argo dev · ticket-2173 · :45173',
  ARGO_DESKTOP_WORKTREE: path.join(path.sep, 'worktrees', 'ticket-2173'),
}

describe('development instances', () => {
  test('keeps the development state inside its instance directory', () => {
    expect(developmentInstance(environment)).toMatchObject({
      directory,
      controlFile: path.join(directory, 'control.sock'),
      controlToken: 'control-token',
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

  test('reports the process, worktree, and state that the app actually uses', () => {
    const instance = developmentInstance(environment)
    if (!instance) throw new Error('development instance was not created')

    expect(developmentReadyRecord(instance, 17)).toMatchObject({
      id: environment.ARGO_DESKTOP_INSTANCE_ID,
      launcherPid: 42,
      port: 45173,
      state: 'ready',
      title: environment.ARGO_DESKTOP_WINDOW_TITLE,
      userData: path.join(directory, 'user-data'),
      windowId: 17,
      worktree: environment.ARGO_DESKTOP_WORKTREE,
    })
  })
})
