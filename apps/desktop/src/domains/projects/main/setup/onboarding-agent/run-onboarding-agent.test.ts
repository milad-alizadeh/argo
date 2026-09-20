import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type OnboardingAgentDriver, runOnboardingAgent } from './run-onboarding-agent'

function fakeDriver(script: string[]): OnboardingAgentDriver {
  let step = 0
  return {
    start: () => 'session-1',
    liveMessages: () => {
      const text = script[Math.min(step, script.length - 1)] ?? ''
      step += 1
      return [{ id: 'message-1', text }]
    },
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => false,
  }
}

test('returns the fenced JSON once the marker line appears', async () => {
  const outcome = await runOnboardingAgent(
    fakeDriver(['Looking around...', 'Almost done...', 'ARGO_SETUP_PLAN\n```json\n{"a":1}\n```']),
    { cwd: '/repo', prompt: 'plan it', mode: 'plan', marker: 'ARGO_SETUP_PLAN', pollIntervalMs: 1 },
  )
  assert.equal(outcome.outcome, 'completed')
  assert.equal(outcome.outcome === 'completed' && outcome.payload, '{"a":1}')
})

test('reports each distinct progress text', async () => {
  const seen: string[] = []
  await runOnboardingAgent(fakeDriver(['step one', 'step one', 'ARGO_DONE\n```json\n{}\n```']), {
    cwd: '/repo',
    prompt: 'plan it',
    mode: 'plan',
    marker: 'ARGO_DONE',
    pollIntervalMs: 1,
    onProgress: (text) => seen.push(text),
  })
  assert.deepEqual(seen, ['step one', 'ARGO_DONE\n```json\n{}\n```'])
})

test('times out and interrupts the Session when the marker never appears', async () => {
  let interrupted: string | null = null
  const driver: OnboardingAgentDriver = {
    start: () => 'session-2',
    liveMessages: () => [{ id: 'message-1', text: 'still thinking' }],
    interrupt: (sessionId: string) => {
      interrupted = sessionId
    },
    pendingPermission: () => null,
    decidePermission: () => false,
  }
  const outcome = await runOnboardingAgent(driver, {
    cwd: '/repo',
    prompt: 'plan it',
    mode: 'plan',
    marker: 'ARGO_DONE',
    pollIntervalMs: 1,
    timeoutMs: 5,
  })
  assert.equal(outcome.outcome, 'timed-out')
  assert.equal(interrupted, 'session-2')
})

test('auto-approves a pending permission with no human to answer it', async () => {
  const decisions: Array<{ sessionId: string; permissionId: string; decision: string }> = []
  let permissionPending = true
  const driver: OnboardingAgentDriver = {
    start: () => 'session-3',
    liveMessages: () =>
      permissionPending
        ? [{ id: 'message-1', text: 'still thinking' }]
        : [{ id: 'message-1', text: 'ARGO_DONE\n```json\n{}\n```' }],
    interrupt: () => {},
    pendingPermission: (sessionId: string) =>
      permissionPending ? { id: 'permission-1', sessionId, toolName: 'Bash', input: {} } : null,
    decidePermission: (sessionId: string, permissionId: string, decision: string) => {
      decisions.push({ sessionId, permissionId, decision })
      permissionPending = false
      return true
    },
  }
  const outcome = await runOnboardingAgent(driver, {
    cwd: '/repo',
    prompt: 'plan it',
    mode: 'plan',
    marker: 'ARGO_DONE',
    pollIntervalMs: 1,
  })
  assert.equal(outcome.outcome, 'completed')
  assert.deepEqual(decisions, [
    { sessionId: 'session-3', permissionId: 'permission-1', decision: 'allowSimilar' },
  ])
})
