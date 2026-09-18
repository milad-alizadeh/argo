import assert from 'node:assert/strict'
import { test } from 'node:test'
import { availableProviders } from '../../domains/accounts/main/providers'
import { GITHUB_ENDPOINTS } from '../github/endpoints'
import { LINEAR_REDIRECT_PORT, linearEndpoints } from './endpoints'

// Registering the OAuth App at Linear is a person's act, and until they do it the client id is
// empty. This is the whole of what their registration turns on.
test('a registered Linear client id is all that offers a Linear sign-in beside GitHub', () => {
  const without = { github: GITHUB_ENDPOINTS, linear: linearEndpoints('') }
  assert.deepEqual(availableProviders(without), ['github'])
  const registered = { github: GITHUB_ENDPOINTS, linear: linearEndpoints('argo-desktop') }
  assert.deepEqual(availableProviders(registered), ['github', 'linear'])
  assert.equal(registered.linear?.redirectPort, LINEAR_REDIRECT_PORT)
})
