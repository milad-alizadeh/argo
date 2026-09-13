import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { isAccountChallengeReply, isAccountConnectReply, isAccountListReply } from './contract'
import { connect, harness, OCTOCAT } from './harness'

// Every token the fake GitHub hands out starts with this.
const TOKEN = 'token-octocat-'

test('no reply on the Account or Ticket channel carries a token, and each one parses', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  cockpit.github.addRepository({
    fullName: 'octo/hello',
    visibleTo: [OCTOCAT.id],
    issues: [{ number: 1, title: 'One' }],
  })
  await cockpit.account('account.list')
  await connect(cockpit)
  await cockpit.ticket('ticket.bind', { accountId: 'github:583231', scope: 'octo/hello' })
  await cockpit.ticket('ticket.binding')
  await cockpit.ticket('ticket.list')
  cockpit.github.revoke('octocat')
  await cockpit.ticket('ticket.list')
  await cockpit.account('account.list')
  await cockpit.account('account.disconnect', { accountId: 'github:583231' })
  assert.ok(cockpit.replies.length >= 9)
  for (const reply of cockpit.replies) {
    assert.ok(!JSON.stringify(reply).includes(TOKEN), JSON.stringify(reply))
    assert.ok(!/accessToken|refreshToken|deviceCode|device_code/.test(JSON.stringify(reply)))
  }
  const accountReplies = cockpit.replies.filter((reply) =>
    String((reply as { type: string }).type).startsWith('account.'),
  )
  for (const reply of accountReplies) {
    const parses = [isAccountListReply, isAccountChallengeReply, isAccountConnectReply]
    assert.ok(
      parses.some((parse) => parse(reply)),
      JSON.stringify(reply),
    )
  }
})

test('the token is written only as ciphertext, and only to the grant file', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  await connect(cockpit)
  const directory = path.join(cockpit.userData, 'portable-v1')
  const files = (await readdir(directory)).sort()
  assert.deepEqual(files, ['accounts.json', 'grants.json', 'projects.json'])
  for (const file of files) {
    assert.ok(!(await readFile(path.join(directory, file), 'utf8')).includes(TOKEN), file)
  }
})

test('a grant the cipher can no longer open reads as needing a reconnect', async (context) => {
  const cockpit = await harness(context)
  cockpit.github.signIn(OCTOCAT)
  cockpit.github.addRepository({ fullName: 'octo/hello', visibleTo: [OCTOCAT.id], issues: [] })
  await connect(cockpit)
  await cockpit.ticket('ticket.bind', { accountId: 'github:583231', scope: 'octo/hello' })
  cockpit.cipher.enabled = false
  assert.equal((await cockpit.ticket('ticket.list')).code, 'grant-unreadable')
  const accounts = (await cockpit.account('account.list')).accounts as { state: string }[]
  assert.equal(accounts[0]?.state, 'unreadable')
  const binding = (await cockpit.ticket('ticket.binding')).binding as { state: string }
  assert.equal(binding.state, 'account-unreadable')
})
