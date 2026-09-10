import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stitchChains } from '../../sessions/chains.ts'
import { fixtureFiles } from './session-fixtures'

async function chainsOf(names) {
  return stitchChains(await fixtureFiles(names))
}

test('stitches a resume onto the file whose leaf it names', async () => {
  const chains = await chainsOf(['resumeChild', 'resumeParent'])
  assert.equal(chains.length, 1)
  assert.equal(chains[0].id, 'resumeParent')
  assert.deepEqual(chains[0].retiredIds, ['resumeChild'])
  assert.deepEqual(
    chains[0].files.map((file) => file.sessionId),
    ['resumeParent', 'resumeChild'],
  )
})

// A relocation writes no shared uuid: the child's first `last-prompt` names a leaf in its own
// file, so the origin `session_id` is the only key left.
test('stitches a relocated half onto its origin through session_id', async () => {
  const chains = await chainsOf(['worktreeRelocated', 'worktreeOrigin'])
  assert.equal(chains.length, 1)
  assert.equal(chains[0].id, 'worktreeOrigin')
  assert.deepEqual(chains[0].retiredIds, ['worktreeRelocated'])
})

test('leaves an unrelated file as its own Session', async () => {
  const chains = await chainsOf(['externalBasic', 'resumeParent', 'resumeChild'])
  assert.deepEqual(chains.map((chain) => chain.id).sort(), ['externalBasic', 'resumeParent'])
})

// A resume whose predecessor was not read is not evidence of a Session Argo cannot see: the file
// stands as its own chain rather than joining a root that is not there.
test('keeps a resume whose predecessor was not read', async () => {
  const chains = await chainsOf(['resumeChild'])
  assert.equal(chains.length, 1)
  assert.equal(chains[0].id, 'resumeChild')
  assert.deepEqual(chains[0].retiredIds, [])
})

// The Roster reads the most recent files only, so a long chain can arrive without its beginning.
// The resumed half is then a Session standing under a retired id with a partial history, and the
// row says so rather than reading as an origin it is not.
test('says so when the file a chain resumed is not in the set read', async () => {
  const [chain] = await chainsOf(['resumeChild'])
  assert.equal(chain.id, 'resumeChild')
  assert.equal(chain.originUnread, true)
})

test('a chain that reaches its own origin is not partial', async () => {
  const [chain] = await chainsOf(['resumeChild', 'resumeParent'])
  assert.equal(chain.originUnread, false)
})
