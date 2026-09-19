import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fixtureRoot } from '@/agents/claude/integration/session-fixtures'
import { claudePendingQuestion } from '@/agents/claude/sessions/pending-question'

test('reads the tool call id of a question still waiting on a person', async (context) => {
  const root = await fixtureRoot(context, ['askPending'])

  assert.deepEqual(await claudePendingQuestion(root, 'askPending'), { id: 'w-call-ask' })
})

test('reads nothing pending once the question is answered', async (context) => {
  const root = await fixtureRoot(context, ['askAnswered'])

  assert.equal(await claudePendingQuestion(root, 'askAnswered'), null)
})

test('reads nothing pending once the Turn has carried on past the question', async (context) => {
  const root = await fixtureRoot(context, ['askOffered'])

  assert.equal(await claudePendingQuestion(root, 'askOffered'), null)
})

test('reads nothing for a Session with no transcript', async (context) => {
  const root = await fixtureRoot(context, ['askPending'])

  assert.equal(await claudePendingQuestion(root, 'gone'), null)
})
