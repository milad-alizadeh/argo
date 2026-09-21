import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptedPlanFixture, planFixture } from '@/domains/projects/contract/setup-plan.fixture'
import { createProjectSetupActor } from './project-setup-actor'
import { setupScreenOf } from './project-setup-screen-of'

test('keeps manual setup and deferred setup as reactivatable resting paths', () => {
  const actor = createProjectSetupActor()
  actor.start()

  actor.send({ type: 'CHOOSE_MANUAL' })
  assert.equal(setupScreenOf(actor), 'manual')

  actor.send({ type: 'SAVE_MANUAL', source: '{"version":1}' })
  assert.equal(setupScreenOf(actor), 'ready')

  actor.send({ type: 'START_REPAIR_OR_UPGRADE' })
  actor.send({ type: 'DEFER' })
  assert.equal(setupScreenOf(actor), 'deferred')

  actor.send({ type: 'RESUME_SETUP' })
  assert.equal(setupScreenOf(actor), 'choosing-method')
})

test('restores the exact durable manual screen and source', () => {
  const first = createProjectSetupActor()
  first.start()
  first.send({ type: 'CHOOSE_MANUAL' })
  const restored = createProjectSetupActor(first.getPersistedSnapshot())
  restored.start()

  assert.equal(setupScreenOf(restored), 'manual')
  assert.equal(restored.getSnapshot().context.manualSource, '')
})

test('keeps one agent Attempt across planning questions, review, and application', () => {
  const plan = planFixture()
  const actor = reviewingPlanActor(plan, true)
  assert.equal(setupScreenOf(actor), 'reviewing-plan')

  actor.send({
    type: 'ACCEPT_PLAN',
    acceptedPlan: acceptedPlanFixture(plan),
  })
  actor.send({ type: 'APPLICATION_SESSION_STARTED', sessionId: 'application-session' })
  actor.send({
    type: 'APPLICATION_COMPLETED',
    finalDiff: 'diff --git a/.argo/settings.json b/.argo/settings.json',
    progress: [{ stepId: 'verify-desktop', status: 'passed', message: 'Verified desktop.' }],
  })

  assert.equal(setupScreenOf(actor), 'reviewing-diff')
  assert.equal(actor.getSnapshot().context.attemptNumber, 1)
  assert.equal(actor.getSnapshot().context.planningSessionId, 'planning-session')
  assert.equal(actor.getSnapshot().context.applicationSessionId, 'application-session')
})

test('keeps an interrupted Attempt recoverable and starts a monotonic replacement Attempt', () => {
  const actor = createProjectSetupActor()
  actor.start()
  actor.send({ type: 'CHOOSE_AGENT', harness: 'claude' })
  actor.send({ type: 'PREFLIGHT_PASSED' })
  actor.send({ type: 'EFFECT_INTENT_SAVED', effect: 'planning' })
  actor.send({
    type: 'PERMISSION_REQUESTED',
    permissionId: 'permission-1',
    description: 'Read files.',
  })
  actor.send({ type: 'EFFECT_INTERRUPTED', reason: 'The Session stopped.' })

  assert.equal(setupScreenOf(actor), 'interrupted')
  assert.equal(actor.getSnapshot().context.pendingApproval, null)
  actor.send({ type: 'RESTART_ATTEMPT' })
  assert.equal(setupScreenOf(actor), 'choosing-method')
  actor.send({ type: 'CHOOSE_AGENT', harness: 'claude' })
  assert.equal(actor.getSnapshot().context.attemptNumber, 2)
  assert.deepEqual(
    actor.getSnapshot().context.attemptEvidence.map(({ number }) => number),
    [1, 2],
  )
})

test('keeps rejection in the same Attempt and guards final approval behind promotion', () => {
  const plan = planFixture()
  const actor = reviewingPlanActor(plan)
  actor.send({ type: 'ACCEPT_PLAN', acceptedPlan: acceptedPlanFixture(plan) })
  actor.send({ type: 'APPLICATION_COMPLETED', finalDiff: 'diff', progress: [] })
  actor.send({ type: 'REJECT_FINAL_DIFF' })
  assert.equal(setupScreenOf(actor), 'reviewing-plan')
  assert.equal(actor.getSnapshot().context.attemptNumber, 1)

  actor.send({ type: 'ACCEPT_PLAN', acceptedPlan: acceptedPlanFixture(plan) })
  actor.send({ type: 'APPLICATION_COMPLETED', finalDiff: 'diff', progress: [] })
  actor.send({ type: 'APPROVE_FINAL_DIFF' })
  assert.equal(setupScreenOf(actor), 'finalizing')
  actor.send({ type: 'FINALIZATION_COMPLETED' })
  assert.equal(setupScreenOf(actor), 'ready')
})

function reviewingPlanActor(plan: ReturnType<typeof planFixture>, asksQuestions = false) {
  const actor = createProjectSetupActor()
  actor.start()
  actor.send({ type: 'CHOOSE_AGENT', harness: 'claude' })
  actor.send({ type: 'PREFLIGHT_PASSED' })
  if (asksQuestions) {
    actor.send({ type: 'PLANNING_SESSION_STARTED', sessionId: 'planning-session' })
    actor.send({
      type: 'QUESTIONS_RECEIVED',
      questions: [{ id: 'question-1', prompt: 'Which package manager should Argo use?' }],
    })
    assert.equal(setupScreenOf(actor), 'questions')
    actor.send({ type: 'ANSWERS_SENT' })
  }
  actor.send({ type: 'PLAN_VALIDATED', plan })
  return actor
}
