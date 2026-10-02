// The install and the removal every Harness's hooks share, run over its storage.
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { type TestContext, test } from 'node:test'
import {
  installStatusHooks,
  removeStatusHooks,
  type StatusHookEvent,
} from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import { type HookHarness, recordedHookEvents } from './status-hooks'

// A Harness's hooks over storage that starts with the user's own hooks table, or with none.
type HookStorage = (
  context: TestContext,
  userHooks: boolean,
) => Promise<{ hooks: ExternalSessionHooks; read: () => Promise<Record<string, unknown[]>> }>

// Counts the writes the hooks make.
function counted(hooks: ExternalSessionHooks) {
  const counter = { writes: 0 }
  const open: ExternalSessionHooks['open'] = async () => {
    const opened = await hooks.open()
    return {
      table: opened.table,
      write: (changes) => {
        counter.writes += 1
        return opened.write(changes)
      },
    }
  }
  return { hooks: { ...hooks, open }, counter }
}

// A path with a space and a quote, as the shell must take it whole.
const SOCKET = "/Users/me/Library/Application Support/Argo's/hooks.sock"

// The install and the removal every Harness's hooks share, over its storage.
export function testStatusHookInstall(harness: HookHarness, storage: HookStorage): void {
  const events = recordedHookEvents(harness)
  const argoGroup = (hooks: ExternalSessionHooks) =>
    hooks.group(
      `curl -s -m 1 --unix-socket '/Users/me/Library/Application Support/Argo'\\''s/hooks.sock' --data-binary @- http://localhost/h/${harness} || true`,
    )

  test(`a ${harness} install into no hooks adds one group per event the fixture records, naming the socket`, async (context) => {
    const { hooks, read } = await storage(context, false)
    await installStatusHooks(harness, hooks, SOCKET)
    const table = await read()
    assert.deepEqual(Object.keys(table).sort(), [...events].sort())
    for (const event of events) assert.deepEqual(table[event], [argoGroup(hooks)])
  })

  test(`a ${harness} install keeps the user's hooks in place, and a second one writes nothing`, async (context) => {
    const { hooks, read } = await storage(context, true)
    const user = await read()
    await installStatusHooks(harness, hooks, SOCKET)
    const table = await read()
    for (const [event, groups] of Object.entries(user))
      assert.deepEqual(table[event], [...groups, argoGroup(hooks)])
    const { hooks: again, counter } = counted(hooks)
    await installStatusHooks(harness, again, SOCKET)
    assert.equal(counter.writes, 0)
  })

  test(`the ${harness} removal deletes exactly the groups Argo wrote`, async (context) => {
    const { hooks, read } = await storage(context, true)
    const user = await read()
    await installStatusHooks(harness, hooks, SOCKET)
    await removeStatusHooks(harness, hooks, SOCKET)
    assert.deepEqual(await read(), user)
  })

  testOrphanedGroups(harness, storage, argoGroup)
}

const socketGroup = (harness: HookHarness, hooks: ExternalSessionHooks, socket: string) =>
  hooks.group(
    `curl -s -m 1 --unix-socket '${socket}' --data-binary @- http://localhost/h/${harness} || true`,
  )
const userGroup = (hooks: ExternalSessionHooks) => hooks.group('say done')
// One event's groups, written through the adapter; Stop is an event every adapter installs.
const EVENT: StatusHookEvent = 'Stop'
async function seedStop(hooks: ExternalSessionHooks, groups: unknown[]) {
  const { write } = await hooks.open()
  await write(new Map([[EVENT, groups]]))
}
// A stopped Argo keeps its app data folder; an orphan's folder is gone.
async function folders(context: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'argo-installs-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'stopped'))
  return {
    stopped: path.join(root, 'stopped', 'hooks.sock'),
    orphan: path.join(root, 'gone', 'hooks.sock'),
    other: path.join(root, 'also-gone', 'hooks.sock'),
  }
}

// The groups of other Argo launches: none moves, orphans go only from the end.
function testOrphanedGroups(
  harness: HookHarness,
  storage: HookStorage,
  argoGroup: (hooks: ExternalSessionHooks) => unknown,
): void {
  test(`a ${harness} install takes an orphan's place before a user group, so no group moves`, async (context) => {
    const { hooks, read } = await storage(context, false)
    const { orphan, stopped } = await folders(context)
    const before = [
      socketGroup(harness, hooks, orphan),
      userGroup(hooks),
      socketGroup(harness, hooks, stopped),
    ]
    await seedStop(hooks, before)
    await installStatusHooks(harness, hooks, SOCKET)
    assert.deepEqual((await read())[EVENT], [argoGroup(hooks), ...before.slice(1)])
  })

  test(`a ${harness} install keeps a stopped Argo whose folder is there, and drops trailing orphans`, async (context) => {
    const { hooks, read } = await storage(context, false)
    const { orphan, other, stopped } = await folders(context)
    const kept = [userGroup(hooks), socketGroup(harness, hooks, stopped), argoGroup(hooks)]
    await seedStop(hooks, [
      ...kept,
      socketGroup(harness, hooks, orphan),
      socketGroup(harness, hooks, other),
    ])
    await installStatusHooks(harness, hooks, SOCKET)
    assert.deepEqual((await read())[EVENT], kept)
  })

  test(`a ${harness} install drops the port group of earlier builds wherever it is`, async (context) => {
    const { hooks, read } = await storage(context, false)
    const port = hooks.group(
      `curl -s -m 1 --data-binary @- http://127.0.0.1:4321/h/${harness}/${EVENT} || true`,
    )
    await seedStop(hooks, [argoGroup(hooks), port, userGroup(hooks)])
    await installStatusHooks(harness, hooks, SOCKET)
    assert.deepEqual((await read())[EVENT], [argoGroup(hooks), userGroup(hooks)])
    await seedStop(hooks, [port, userGroup(hooks)])
    await installStatusHooks(harness, hooks, SOCKET)
    assert.deepEqual((await read())[EVENT], [argoGroup(hooks), userGroup(hooks)])
  })

  test(`a ${harness} install with its own group in place keeps an orphan before a kept group and writes nothing`, async (context) => {
    const { hooks, read } = await storage(context, false)
    const { orphan } = await folders(context)
    await installStatusHooks(harness, hooks, SOCKET)
    const steady = [socketGroup(harness, hooks, orphan), userGroup(hooks), argoGroup(hooks)]
    await seedStop(hooks, steady)
    const { hooks: again, counter } = counted(hooks)
    await installStatusHooks(harness, again, SOCKET)
    assert.equal(counter.writes, 0)
    assert.deepEqual((await read())[EVENT], steady)
  })
}
