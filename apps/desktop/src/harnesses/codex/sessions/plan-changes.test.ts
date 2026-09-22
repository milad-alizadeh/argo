import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionPlan } from '@/domains/sessions/contract/model'
import {
  nestedPlanCall,
  planCall,
  planOf,
  SESSION_ID,
  TIMESTAMP,
  updatePlan,
} from './plan-call-fixtures'

const cases: { claim: string; records: unknown[]; plan: SessionPlan | null }[] = [
  {
    claim: 'reads the newest Plan the agent wrote whole',
    records: [
      ...updatePlan('call-1', [
        { step: 'Inspect the sync', status: 'in_progress' },
        { step: 'Update the backend', status: 'pending' },
      ]),
      ...updatePlan(
        'call-2',
        [
          { step: 'Inspect the sync', status: 'completed' },
          { step: 'Update the backend', status: 'in_progress' },
          { step: 'Update the frontend', status: 'pending' },
        ],
        'Backend first, then the hooks.',
      ),
    ],
    plan: {
      state: 'available',
      entries: [
        { content: 'Inspect the sync', position: 0, status: 'completed' },
        { content: 'Update the backend', position: 1, status: 'in_progress' },
        { content: 'Update the frontend', position: 2, status: 'pending' },
      ],
    },
  },
  {
    claim: 'drops a step the newest Plan no longer names',
    records: [
      ...updatePlan('call-1', [
        { step: 'Inspect the sync', status: 'completed' },
        { step: 'Update the backend', status: 'pending' },
      ]),
      ...updatePlan('call-2', [{ step: 'Inspect the sync', status: 'completed' }]),
    ],
    plan: {
      state: 'available',
      entries: [{ content: 'Inspect the sync', position: 0, status: 'completed' }],
    },
  },
  {
    claim: 'marks the Plan unreadable when a step has no status',
    records: updatePlan('call-1', [{ step: 'Inspect the sync' }]),
    plan: { state: 'malformed' },
  },
  {
    claim: "holds no Plan for plan mode's written proposal",
    records: [
      {
        timestamp: TIMESTAMP,
        type: 'event_msg',
        payload: {
          type: 'item_completed',
          thread_id: SESSION_ID,
          item: { type: 'Plan', id: 'turn-1-plan', text: '# Separate the icons' },
        },
      },
    ],
    plan: null,
  },
  {
    claim: 'marks the Plan unreadable when its arguments are not JSON',
    records: planCall('call-1', '{"plan":['),
    plan: { state: 'malformed' },
  },
  {
    claim: 'reads generated object keys without changing matching text inside a step',
    records: nestedPlanCall(
      'const r = await tools.update_plan({ plan: [{ step: "Review { plan: value }", status: "in_progress" }] });\ntext(r);',
    ),
    plan: {
      state: 'available',
      entries: [{ content: 'Review { plan: value }', position: 0, status: 'in_progress' }],
    },
  },
  {
    claim: 'reads a Plan the script builds first and passes by name',
    records: nestedPlanCall(
      'const plan = [{"step":"Inspect [a]","status":"completed"},{"step":"Fix","status":"in_progress"}]; const r = await tools.update_plan({explanation:"Why, plan}",plan});text(r);',
    ),
    plan: {
      state: 'available',
      entries: [
        { content: 'Inspect [a]', position: 0, status: 'completed' },
        { content: 'Fix', position: 1, status: 'in_progress' },
      ],
    },
  },
]

for (const { claim, records, plan } of cases) {
  test(claim, async (context) => {
    assert.deepEqual(await planOf(context, records), plan)
  })
}
