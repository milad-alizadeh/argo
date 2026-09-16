import { appendFile } from 'node:fs/promises'

import { fixturePath, proofCwd } from '../../../mocks/sessions/mock-transcript-files'

type Link = { uuid: string; parentUuid: string }

function taskCall(cwd: string, link: Link, call: { id: string; name: string; input: object }) {
  return {
    ...link,
    cwd,
    type: 'assistant',
    timestamp: '2026-08-30T10:06:00.000Z',
    message: {
      role: 'assistant',
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', ...call }],
    },
  }
}

// A current CLI adds the step with TaskCreate, whose result names its id, then starts it.
export async function updatePlan(transcripts) {
  const cwd = proofCwd(transcripts, 'proj')
  const records = [
    taskCall(
      cwd,
      { uuid: 'pw-a-plan-create', parentUuid: 'pw-a-5' },
      {
        id: 'task-create-live',
        name: 'TaskCreate',
        input: { subject: 'Ship the Session Plan', description: 'Draw it from Tasks' },
      },
    ),
    {
      cwd,
      parentUuid: 'pw-a-plan-create',
      type: 'user',
      timestamp: '2026-08-30T10:06:01.000Z',
      uuid: 'pw-u-plan-created',
      toolUseResult: { task: { id: '1', subject: 'Ship the Session Plan' } },
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'task-create-live',
            content: 'Task #1 created successfully: Ship the Session Plan',
          },
        ],
      },
    },
    taskCall(
      cwd,
      { uuid: 'pw-a-plan-start', parentUuid: 'pw-u-plan-created' },
      {
        id: 'task-update-live',
        name: 'TaskUpdate',
        input: { taskId: '1', status: 'in_progress' },
      },
    ),
  ]
  await appendFile(
    fixturePath(transcripts, 'plannedWork'),
    records.map((record) => `${JSON.stringify(record)}\n`).join(''),
  )
}
