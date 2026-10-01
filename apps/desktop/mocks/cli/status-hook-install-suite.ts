// The install and the removal every Harness's hooks share, run over its storage.
import assert from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { installStatusHooks, removeStatusHooks } from '@/harnesses/host/status-hooks'
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
}
