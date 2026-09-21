import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SetupPlan } from '@/domains/projects/contract/setup-plan'
import { acceptedPlanFixture, planFixture } from '@/domains/projects/contract/setup-plan.fixture'
import {
  projectSetupBridge as bridgeFor,
  projectSetupCommand as command,
  effectsForPlan,
  settleProjectSetup as settle,
} from './project-setup-bridge.fixture'

test('does not expose ready until the approved final diff has been promoted', async () => {
  let finishPromotion: (() => void) | undefined
  const promotion = new Promise<void>((resolve) => {
    finishPromotion = resolve
  })
  const plan = planFixture()
  const effects = effectsForPlan(plan, {
    complete: async () => promotion,
  })
  const bridge = bridgeFor(effects)
  await startApplication(bridge, plan)
  const diff = bridge.actorSnapshot('project-1')
  command(bridge, { type: 'approve-final-diff' }, diff.revision)
  assert.equal(bridge.actorSnapshot('project-1').screen, 'finalizing')
  finishPromotion?.()
  await settle()
  assert.equal(bridge.actorSnapshot('project-1').screen, 'ready')
})

test('reconciles and resumes the same application Session after an interruption', async () => {
  const applicationSessions: Array<string | undefined> = []
  const reconciledSessions: string[] = []
  let runs = 0
  const plan = planFixture()
  const effects = effectsForPlan(plan, {
    reconcile: async ({ sessionId }) => {
      reconciledSessions.push(sessionId)
      return { kind: 'current' }
    },
    apply: async ({ onStarted, sessionId }) => {
      applicationSessions.push(sessionId)
      runs += 1
      if (runs === 1) {
        onStarted('application-session')
        throw new Error('connection lost')
      }
      return { finalDiff: 'diff --git a/.argo/settings.json b/.argo/settings.json' }
    },
  })
  const bridge = bridgeFor(effects)
  await startApplication(bridge, plan)
  const interrupted = bridge.actorSnapshot('project-1')
  assert.equal(interrupted.screen, 'interrupted')
  command(bridge, { type: 'resume-application' }, interrupted.revision)
  await settle()
  assert.deepEqual(applicationSessions, [undefined, 'application-session'])
  assert.deepEqual(reconciledSessions, ['application-session'])
  assert.equal(bridge.actorSnapshot('project-1').screen, 'reviewing-diff')
})

test('keeps the Attempt interrupted when recorded application work cannot reconcile', async () => {
  const plan = planFixture()
  const effects = effectsForPlan(plan, {
    apply: async ({ onStarted }) => {
      onStarted('application-session')
      throw new Error('connection lost')
    },
    reconcile: async () => ({ kind: 'drifted', reason: 'Source changed: package.json' }),
  })
  const bridge = bridgeFor(effects)
  await startApplication(bridge, plan)
  const interrupted = bridge.actorSnapshot('project-1')
  command(bridge, { type: 'resume-application' }, interrupted.revision)
  await settle()
  const recovered = bridge.actorSnapshot('project-1')
  assert.equal(recovered.screen, 'interrupted')
  assert.equal(recovered.recoveryMessage, 'Source changed: package.json')
})

test('waits for the driver to confirm cancellation before interrupting an application Attempt', async () => {
  let confirmStop: (() => void) | undefined
  const stopped = new Promise<void>((resolve) => {
    confirmStop = resolve
  })
  const plan = planFixture()
  const effects = effectsForPlan(plan, {
    apply: async ({ onStarted }) => {
      onStarted('application-session')
      return new Promise(() => undefined)
    },
    cancel: async ({ effect, sessionId }) => {
      assert.equal(effect, 'application')
      assert.equal(sessionId, 'application-session')
      await stopped
    },
  })
  const bridge = bridgeFor(effects)
  await startApplication(bridge, plan)
  const applying = bridge.actorSnapshot('project-1')
  assert.equal(applying.screen, 'applying')
  command(bridge, { type: 'cancel-setup' }, applying.revision)
  assert.equal(bridge.actorSnapshot('project-1').screen, 'cancelling')
  confirmStop?.()
  await settle()
  assert.equal(bridge.actorSnapshot('project-1').screen, 'interrupted')
})

async function startApplication(
  bridge: ReturnType<typeof bridgeFor>,
  plan: SetupPlan,
): Promise<void> {
  command(bridge, { type: 'choose-agent', harness: 'claude' }, 0)
  await settle()
  const review = bridge.actorSnapshot('project-1')
  command(bridge, { type: 'accept-plan', acceptedPlan: acceptedPlanFixture(plan) }, review.revision)
  await settle()
}
