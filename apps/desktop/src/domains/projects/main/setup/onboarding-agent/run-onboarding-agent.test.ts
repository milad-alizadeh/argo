import assert from 'node:assert/strict'
import { test } from 'node:test'
import { type OnboardingAgentDriver, runOnboardingAgent } from './run-onboarding-agent'

function fakeDriver(script: string[]): OnboardingAgentDriver {
  let step = 0
  return {
    start: () => 'session-1',
    send: async () => {},
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

test('continues an existing planning Session instead of starting another one', async () => {
  let starts = 0
  const sent: string[] = []
  const driver: OnboardingAgentDriver = {
    start: () => {
      starts += 1
      return 'new-session'
    },
    send: async (sessionId, turn) => {
      sent.push(`${sessionId}:${turn.prompt}`)
    },
    liveMessages: () => [{ id: 'message-2', text: 'ARGO_DONE\n```json\n{}\n```' }],
    interrupt: () => {},
    pendingPermission: () => null,
    decidePermission: () => false,
  }
  const outcome = await runOnboardingAgent(driver, {
    cwd: '/repo',
    prompt: 'Use these answers.',
    mode: 'plan',
    marker: 'ARGO_DONE',
    pollIntervalMs: 1,
    sessionId: 'planning-session',
  })
  assert.equal(outcome.outcome, 'completed')
  assert.equal(starts, 0)
  assert.deepEqual(sent, ['planning-session:Use these answers.'])
})

test('times out and interrupts the Session when the marker never appears', async () => {
  let interrupted: string | null = null
  const driver: OnboardingAgentDriver = {
    start: () => 'session-2',
    send: async () => {},
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

test('reports a pending permission for the Project setup screen to decide', async () => {
  const permissions: Array<{ id: string; description: string }> = []
  let reads = 0
  const driver: OnboardingAgentDriver = {
    start: () => 'session-3',
    send: async () => {},
    liveMessages: () => {
      reads += 1
      return [
        {
          id: 'message-1',
          text: reads < 2 ? 'still thinking' : 'ARGO_DONE\n```json\n{}\n```',
        },
      ]
    },
    interrupt: () => {},
    pendingPermission: () => ({
      id: 'permission-1',
      input: { command: 'git status' },
      toolName: 'Bash',
    }),
    decidePermission: () => false,
  }
  const outcome = await runOnboardingAgent(driver, {
    cwd: '/repo',
    prompt: 'plan it',
    mode: 'plan',
    marker: 'ARGO_DONE',
    pollIntervalMs: 1,
    onPermission: (permission) => permissions.push(permission),
  })
  assert.equal(outcome.outcome, 'completed')
  assert.deepEqual(permissions, [
    { id: 'permission-1', description: 'Bash {"command":"git status"}' },
  ])
})
