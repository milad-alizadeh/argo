// A development app shares its Account store with every other worktree's, and keeps everything
// else to itself (#2304). Each cockpit here is one app: its own application data, one store.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { connect, harness, OCTOCAT } from './harness'

test('an Account connected in one cockpit is listed by another over the same Account store', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  const other = await cockpit.otherCockpit('project-2')
  const listed = await other.account('account.list')
  assert.deepEqual(
    (listed.accounts as { id: string; state: string }[]).map(({ id, state }) => [id, state]),
    [['github:583231', 'connected']],
  )
})

test('a cockpit sharing the Account store keeps its own Projects and Connections', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  cockpit.github.addRepository({ fullName: 'Octo/Hello', visibleTo: [OCTOCAT.id], issues: [] })
  await connect(cockpit)
  await cockpit.ticket('ticket.connect', { accountId: 'github:583231', scope: 'octo/hello' })
  const other = await cockpit.otherCockpit('project-2')
  const listed = await other.account('account.list')
  assert.deepEqual((listed.accounts as { connections: unknown[] }[])[0]?.connections, [])
  const read = await other.ticket('ticket.connection', { projectId: 'project-2' })
  assert.equal(read.connection, null)
  const here = await cockpit.account('account.list')
  assert.equal((here.accounts as { connections: unknown[] }[])[0]?.connections.length, 1)
})
