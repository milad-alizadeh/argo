import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import {
  accountStoreDirectory,
  developmentStoreDirectories,
  projectStoreDirectory,
} from './account-store'
import { type DevelopmentInstance, developmentInstance } from './instance'

const APP_DATA = '/Users/developer/Library/Application Support'

function launched(worktree: string): DevelopmentInstance {
  const directory = `/tmp/argo-desktop-dev/${path.basename(worktree)}`
  const instance = developmentInstance({
    ARGO_DESKTOP_INSTANCE_DIRECTORY: directory,
    ARGO_DESKTOP_INSTANCE_ID: path.basename(worktree),
    ARGO_DESKTOP_LAUNCHER_PID: '4242',
    ARGO_DESKTOP_CONTROL_FILE: path.join(directory, 'control.sock'),
    ARGO_DESKTOP_CONTROL_TOKEN: 'token',
    ARGO_DESKTOP_DEV_PORT: '41000',
    ARGO_DESKTOP_DEBUG_PORT: '41001',
    ARGO_DESKTOP_WINDOW_TITLE: 'Argo dev',
    ARGO_DESKTOP_WORKTREE: worktree,
    ARGO_DESKTOP_BUILD_LABEL: '#2304',
  })
  assert.ok(instance)
  return instance
}

test('a packaged app keeps its Accounts in its own application data', () => {
  const userData = path.join(APP_DATA, 'Argo')
  assert.equal(accountStoreDirectory({ userData, appData: APP_DATA, instance: null }), userData)
})

test('two development worktrees read one Account store', () => {
  const first = launched('/Users/developer/argo')
  const second = launched('/Users/developer/argo/.claude/worktrees/ticket-2304')
  assert.notEqual(first.userData, second.userData)
  assert.equal(
    accountStoreDirectory({ userData: first.userData, appData: APP_DATA, instance: first }),
    accountStoreDirectory({ userData: second.userData, appData: APP_DATA, instance: second }),
  )
})

test('two development worktrees read one Project store', () => {
  const first = launched('/Users/developer/argo')
  const second = launched('/Users/developer/argo/.claude/worktrees/ticket-2367')
  assert.equal(
    projectStoreDirectory({ userData: first.userData, appData: APP_DATA, instance: first }),
    projectStoreDirectory({ userData: second.userData, appData: APP_DATA, instance: second }),
  )
})

test('a development launch selects both shared stores together', () => {
  const instance = launched('/Users/developer/argo/.claude/worktrees/ticket-2367')
  assert.deepEqual(
    developmentStoreDirectories({ userData: instance.userData, appData: APP_DATA, instance }),
    {
      accountData: path.join(APP_DATA, 'Argo Development'),
      projectData: path.join(APP_DATA, 'Argo Development'),
    },
  )
})

test('the shared development Account store outlives a reboot that empties the instance directory', () => {
  const instance = launched('/Users/developer/argo')
  const store = accountStoreDirectory({ userData: instance.userData, appData: APP_DATA, instance })
  assert.ok(store.startsWith(`${APP_DATA}${path.sep}`))
  assert.ok(!store.startsWith(`${instance.directory}${path.sep}`))
})

test('a development app is refused an Account store outside an absolute application data path', () => {
  const instance = launched('/Users/developer/argo')
  assert.throws(() =>
    accountStoreDirectory({
      userData: instance.userData,
      appData: 'Application Support',
      instance,
    }),
  )
})
