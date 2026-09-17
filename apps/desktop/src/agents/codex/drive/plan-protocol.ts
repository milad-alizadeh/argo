import assert from 'node:assert/strict'

import type { SessionPlan } from '../../../core/sessions/models'
import { protocolRecord, protocolString, type WireMessage } from './protocol'

// `turn/plan/updated` maps Codex's `inProgress` wire spelling to the shared Session vocabulary (CONTEXT.md L3 · Plan).
export function readUpdatedPlan(message: WireMessage): SessionPlan | undefined {
  if (!('method' in message) || message.method !== 'turn/plan/updated') return undefined
  const entries = message.params.plan
  assert(Array.isArray(entries), 'Updated Plan entries must be an array')
  protocolString(message.params.turnId, 'Updated Plan Turn ID')
  return {
    state: 'available',
    entries: entries.map((entry, position) => {
      const planEntry = protocolRecord(entry, 'Updated Plan entry')
      const content = protocolString(planEntry.step, 'Updated Plan step').trim()
      assert(content.length > 0, 'Updated Plan step must not be empty')
      switch (protocolString(planEntry.status, 'Updated Plan status')) {
        case 'pending':
          return { content, position, status: 'pending' }
        case 'inProgress':
          return { content, position, status: 'in_progress' }
        case 'completed':
          return { content, position, status: 'completed' }
        default:
          return assert.fail('Invalid Updated Plan status')
      }
    }),
  }
}
