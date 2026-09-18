import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createGrantStore } from '../domains/accounts/main/grants'
import { readAccounts, writeAccounts } from '../domains/accounts/main/registry'
import {
  DEVELOPMENT_APPLICATION_NAME,
  developmentStoreDirectories,
} from '../platform/main/development/account-store'
import {
  type DevelopmentInstance,
  developmentInstance,
} from '../platform/main/development/instance'
import { sharedDatabasePath } from '../platform/main/storage/shared-database'

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

test('a packaged app keeps its data in its own application data', () => {
  const userData = path.join(APP_DATA, 'Argo')
  assert.deepEqual(developmentStoreDirectories({ userData, appData: APP_DATA, instance: null }), {
    accountData: userData,
    projectData: userData,
  })
})

function worktreeStores(appData: string) {
  const firstInstance = launched('/Users/developer/argo')
  const secondInstance = launched('/Users/developer/argo/.claude/worktrees/ticket-2367')
  const first = developmentStoreDirectories({
    userData: firstInstance.userData,
    appData,
    instance: firstInstance,
  })
  const second = developmentStoreDirectories({
    userData: secondInstance.userData,
    appData,
    instance: secondInstance,
  })
  return { first, firstInstance, second, secondInstance }
}

function testCipher() {
  return {
    available: () => true,
    encrypt: (text: string) => Buffer.from(text.split('').reverse().join('')),
    decrypt: (text: Buffer) => text.toString().split('').reverse().join(''),
  }
}

function grantsFor(store: ReturnType<typeof developmentStoreDirectories>) {
  return createGrantStore(path.join(store.accountData, 'portable-v1', 'grants.json'), testCipher())
}

async function persistFirstLaunch(first: ReturnType<typeof developmentStoreDirectories>) {
  const accountsPath = path.join(first.accountData, 'portable-v1', 'accounts.json')
  const grants = grantsFor(first)
  assert.equal(
    await writeAccounts(accountsPath, {
      accounts: [
        {
          id: 'github:583231',
          provider: 'github',
          providerAccountId: '583231',
          login: 'octocat',
          workspace: null,
          scopes: ['repo'],
          state: 'connected',
        },
      ],
      noticeDismissed: true,
      other: {},
    }),
    true,
  )
  assert.equal(
    await grants.save('github:583231', {
      accessToken: 'development-token',
      scopes: ['repo'],
      renewal: null,
    }),
    true,
  )
  return grants
}

async function assertSecondLaunch(second: ReturnType<typeof developmentStoreDirectories>) {
  assert.deepEqual(
    await readAccounts(path.join(second.accountData, 'portable-v1', 'accounts.json')),
    {
      ok: true,
      registry: {
        accounts: [
          {
            id: 'github:583231',
            provider: 'github',
            providerAccountId: '583231',
            login: 'octocat',
            workspace: null,
            scopes: ['repo'],
            state: 'connected',
          },
        ],
        noticeDismissed: true,
        other: {},
      },
    },
  )
  assert.deepEqual(await grantsFor(second).read('github:583231'), {
    ok: true,
    grant: { accessToken: 'development-token', scopes: ['repo'], renewal: null },
  })
}

test('a second worktree reads the Account grant and selected Project from the first', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-development-store-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const stores = worktreeStores(path.join(root, 'Application Support'))
  assert.notEqual(stores.firstInstance.userData, stores.secondInstance.userData)
  assert.deepEqual(stores.first, stores.second)
  assert.equal(
    sharedDatabasePath(stores.first.projectData),
    sharedDatabasePath(stores.second.projectData),
  )
  assert.equal(DEVELOPMENT_APPLICATION_NAME, 'Argo Development')
  await persistFirstLaunch(stores.first)
  await assertSecondLaunch(stores.second)
})
