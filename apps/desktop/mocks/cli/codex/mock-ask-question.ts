// The `item/tool/requestUserInput` half of mock-codex-app-server.ts, split out to keep that
// file's line count under the repo's cap.
import { appendFileSync } from 'node:fs'

const pendingAsks = new Map<number, { threadId: unknown; turnId: string }>()
let askRequestCounter = 0

export function askQuestion(
  send: (message: Record<string, unknown>) => void,
  turn: { threadId: unknown; turnId: string; text: string },
) {
  const { threadId, turnId, text } = turn
  send({
    method: 'thread/status/changed',
    params: { threadId, status: { type: 'active', activeFlags: ['waitingOnUserInput'] } },
  })
  askRequestCounter += 1
  pendingAsks.set(askRequestCounter, { threadId, turnId })
  send({
    id: askRequestCounter,
    method: 'item/tool/requestUserInput',
    params: {
      threadId,
      turnId,
      itemId: `ask-item-${askRequestCounter}`,
      isBlocking: false,
      autoResolutionMs: null,
      questions: [
        {
          id: 'color',
          header: 'Color',
          question: 'Which color do you like?',
          isOther: true,
          isSecret: text.includes('ASK_SECRET'),
          options: [
            { label: 'Red', description: 'Choose red.' },
            { label: 'Blue', description: 'Choose blue.' },
          ],
        },
      ],
    },
  })
}

export function handleAskReply(
  message: { id?: unknown; result?: unknown },
  echoFile: string | undefined,
  completeTurn: (threadId: unknown, turnId: string, text: string) => void,
) {
  // A reply to this fixture's own `item/tool/requestUserInput` request: complete the Turn it was
  // blocking, echoing the answer so a test can assert on exactly what the client sent back.
  if (typeof message.id !== 'number' || !pendingAsks.has(message.id)) return false
  const pending = pendingAsks.get(message.id)
  pendingAsks.delete(message.id)
  if (echoFile) appendFileSync(echoFile, `${JSON.stringify(message.result)}\n`)
  if (pending) completeTurn(pending.threadId, pending.turnId, 'Answered.')
  return true
}
