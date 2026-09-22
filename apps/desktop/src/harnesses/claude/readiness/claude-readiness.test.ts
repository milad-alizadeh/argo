import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claudeReadiness } from './claude-readiness'

const found = () => '/usr/local/bin/claude'
const missing = () => null

test('Claude: no executable on the login PATH reads missing', async () => {
  const readiness = await claudeReadiness({
    findExecutable: missing,
    runStatus: () => {
      throw new Error('never called')
    },
  })
  assert.deepEqual(readiness, { harness: 'claude', state: 'missing', detail: null })
})

test('Claude: loggedIn false reads signed-out', async () => {
  const readiness = await claudeReadiness({
    findExecutable: found,
    runStatus: async () => ({ stdout: JSON.stringify({ loggedIn: false }) }),
  })
  assert.deepEqual(readiness, { harness: 'claude', state: 'signed-out', detail: null })
})

test('Claude: an inherited ANTHROPIC_API_KEY reads signed-out, never ready', async () => {
  const readiness = await claudeReadiness({
    findExecutable: found,
    runStatus: async () => ({
      stdout: JSON.stringify({
        loggedIn: true,
        apiProvider: 'firstParty',
        apiKeySource: 'ANTHROPIC_API_KEY',
        subscriptionType: null,
      }),
    }),
  })
  assert.deepEqual(readiness, { harness: 'claude', state: 'signed-out', detail: 'api-key' })
})

test('Claude: an org gateway apiProvider reads policy-blocked', async () => {
  const readiness = await claudeReadiness({
    findExecutable: found,
    runStatus: async () => ({
      stdout: JSON.stringify({ loggedIn: true, apiProvider: 'bedrock', subscriptionType: null }),
    }),
  })
  assert.deepEqual(readiness, { harness: 'claude', state: 'policy-blocked', detail: 'bedrock' })
})

test('Claude: a firstParty subscription reads ready', async () => {
  const readiness = await claudeReadiness({
    findExecutable: found,
    runStatus: async () => ({
      stdout: JSON.stringify({
        loggedIn: true,
        apiProvider: 'firstParty',
        subscriptionType: 'team',
      }),
    }),
  })
  assert.deepEqual(readiness, { harness: 'claude', state: 'ready', detail: null })
})

test('Claude: unparseable status output reads signed-out rather than throwing', async () => {
  const readiness = await claudeReadiness({
    findExecutable: found,
    runStatus: async () => ({ stdout: 'not json' }),
  })
  assert.deepEqual(readiness, { harness: 'claude', state: 'signed-out', detail: null })
})
