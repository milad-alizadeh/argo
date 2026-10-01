// The install, the port change and the removal every Harness's hooks share, run over its storage.
import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import {
  installedStatusHookPort,
  installStatusHooks,
  removeStatusHooks,
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

// The install, the port change and the removal every Harness's hooks share, over its storage.
export function testStatusHookInstall(harness: HookHarness, storage: HookStorage): void {
  const events = recordedHookEvents(harness)
  const argoGroup = (hooks: ExternalSessionHooks, port: number, event: string) =>
    hooks.group(
      `curl -s -m 1 --data-binary @- http://127.0.0.1:${port}/h/${harness}/${event} || true`,
    )

  test(`a ${harness} install into no hooks adds one group per event the fixture records, naming the port`, async (context) => {
    const { hooks, read } = await storage(context, false)
    await installStatusHooks(harness, hooks, 4321)
    const table = await read()
    assert.deepEqual(Object.keys(table).sort(), [...events].sort())
    for (const event of events) assert.deepEqual(table[event], [argoGroup(hooks, 4321, event)])
    assert.equal(await installedStatusHookPort(harness, hooks), 4321)
  })

  test(`a ${harness} install keeps the user's hooks in place, and a second one writes nothing`, async (context) => {
    const { hooks, read } = await storage(context, true)
    const user = await read()
    await installStatusHooks(harness, hooks, 4321)
    const table = await read()
    for (const [event, groups] of Object.entries(user))
      assert.deepEqual(table[event], [...groups, argoGroup(hooks, 4321, event)])
    const { hooks: again, counter } = counted(hooks)
    await installStatusHooks(harness, again, 4321)
    assert.equal(counter.writes, 0)
  })

  test(`a new ${harness} port rewrites only Argo's groups, where they stand`, async (context) => {
    const { hooks, read } = await storage(context, true)
    const user = await read()
    await installStatusHooks(harness, hooks, 4321)
    await installStatusHooks(harness, hooks, 5555)
    const table = await read()
    for (const [event, groups] of Object.entries(user))
      assert.deepEqual(table[event], [...groups, argoGroup(hooks, 5555, event)])
    assert.equal(await installedStatusHookPort(harness, hooks), 5555)
  })

  test(`the ${harness} removal deletes exactly the groups Argo wrote`, async (context) => {
    const { hooks, read } = await storage(context, true)
    const user = await read()
    await installStatusHooks(harness, hooks, 4321)
    await removeStatusHooks(harness, hooks)
    assert.deepEqual(await read(), user)
    assert.equal(await installedStatusHookPort(harness, hooks), null)
  })
}
