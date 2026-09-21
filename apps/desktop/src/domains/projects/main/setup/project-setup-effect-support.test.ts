import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createProgressReporter } from './project-setup-effect-support'

test('reports only the durable fields from an agent progress event', () => {
  const reported: Array<Array<{ stepId: string; status: 'running'; message: string }>> = []
  const reportProgress = createProgressReporter((progress) => reported.push(progress))
  const event = {
    stepId: 'inspect-repository',
    status: 'running' as const,
    message: 'Inspecting the repository',
    revision: 17,
  }

  reportProgress(event)

  assert.deepEqual(reported, [
    [
      {
        stepId: 'inspect-repository',
        status: 'running',
        message: 'Inspecting the repository',
      },
    ],
  ])
})
