import { appendFile } from 'node:fs/promises'

import { fixturePath } from './session-fixture-files'

export async function updatePlan(transcripts) {
  await appendFile(
    fixturePath(transcripts, 'plannedWork'),
    `${JSON.stringify({
      type: 'assistant',
      cwd: '/Users/x/proj',
      timestamp: '2026-08-30T10:06:00.000Z',
      uuid: 'pw-a-plan-live',
      parentUuid: 'pw-a-5',
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'todo-live',
            name: 'TodoWrite',
            input: {
              todos: [
                { content: 'Read the rail', status: 'completed' },
                { content: 'Ship the Session Plan', status: 'in_progress' },
              ],
            },
          },
        ],
      },
    })}\n`,
  )
}
