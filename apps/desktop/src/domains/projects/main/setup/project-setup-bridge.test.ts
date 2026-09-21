import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acceptedPlanFixture, planFixture } from '@/domains/projects/contract/setup-plan.fixture'
import {
  projectSetupBridge as bridgeFor,
  projectSetupCommand as command,
  settleProjectSetup as settle,
} from './project-setup-bridge.fixture'
import type { ProjectSetupEffects } from './project-setup-effects'

test('continues the public Project setup journey in one planning Session', async () => {
  const continuations: Array<{ prompt: string; sessionId: string } | undefined> = []
  let completedProject: string | null = null
  const plan = planFixture()
  const effects: ProjectSetupEffects = {
    preflight: async () => true,
    plan: async ({ continuation, onProgress, onStarted }) => {
      continuations.push(continuation)
      onProgress([{ stepId: 'inspect-project', status: 'running', message: 'Inspecting Project.' }])
      if (!continuation) {
        onStarted('planning-session')
        return {
          kind: 'questions',
          questions: [{ id: 'package-manager', prompt: 'Which manager?' }],
        }
      }
      return { kind: 'plan', plan }
    },
    apply: async ({ onStarted }) => {
      onStarted('application-session')
      return { finalDiff: 'diff --git a/.argo/settings.json b/.argo/settings.json' }
    },
    complete: (projectId) => {
      completedProject = projectId
    },
  }
  const bridge = bridgeFor(effects)
  command(bridge, { type: 'choose-agent', harness: 'claude' }, 0)
  await settle()
  const questions = bridge.actorSnapshot('project-1')
  assert.equal(questions.screen, 'questions')
  assert.equal(questions.attempt?.planningSessionId, 'planning-session')

  command(
    bridge,
    { type: 'answer-questions', answers: [{ id: 'package-manager', answer: 'Bun' }] },
    questions.revision,
  )
  await settle()
  const review = bridge.actorSnapshot('project-1')
  assert.equal(review.screen, 'reviewing-plan')
  assert.deepEqual(
    continuations.map((continuation) => continuation?.sessionId),
    [undefined, 'planning-session'],
  )
  assert.match(continuations[1]?.prompt ?? '', /package-manager: Bun/)

  command(bridge, { type: 'accept-plan', acceptedPlan: acceptedPlanFixture(plan) }, review.revision)
  await settle()
  const diff = bridge.actorSnapshot('project-1')
  assert.equal(diff.screen, 'reviewing-diff')
  assert.equal(diff.attempt?.planningSessionId, 'planning-session')
  assert.equal(diff.attempt?.applicationSessionId, 'application-session')

  command(bridge, { type: 'approve-final-diff' }, diff.revision)
  await settle()
  assert.equal(bridge.actorSnapshot('project-1').screen, 'ready')
  assert.equal(completedProject, 'project-1')
})
