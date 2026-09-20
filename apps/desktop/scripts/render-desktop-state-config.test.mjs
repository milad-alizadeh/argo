import assert from 'node:assert/strict'
import test from 'node:test'
import { renderStateConfig } from './render-desktop-state-config.mjs'

test('uses the onboarding root for Project onboarding stories', () => {
  assert.deepEqual(renderStateConfig('projects-project-onboarding--project-setup'), {
    outputName: 'project-onboarding.png',
    selector: '[data-component="ProjectOnboarding"]',
  })
})
