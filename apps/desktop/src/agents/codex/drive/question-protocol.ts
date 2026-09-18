import assert from 'node:assert/strict'
import type {
  Question,
  QuestionAnswer,
  QuestionOption,
} from '../../../domains/sessions/contract/question'
import type { RequestID, WireMessage } from './protocol'
import { protocolRecord, protocolString } from './protocol'

// A pending `item/tool/requestUserInput` server request (EXPERIMENTAL, grounded against codex-cli
// 0.147.0's generated schema behind `features.default_mode_request_user_input`, #1841). Codex asks
// one JSON-RPC request per Turn; this adapter holds it open — never auto-refused — until a
// decision answers it or the Turn ends.
export type PendingCodexQuestion = {
  threadId: string
  turnId: string
  itemId: string
  requestId: RequestID
  // Each question's own `id`, positional with `questions`, so a decision's shared-shape answers
  // can be rekeyed back into Codex's id-keyed response without leaking that vocabulary upward.
  answerIds: string[]
  questions: Question[]
  // Why this pending question cannot be answered through the shared form (a `isSecret` question
  // among them); null when every question here has an honest answer in the shared Question shape.
  unsupported: string | null
}

function readOption(value: unknown): QuestionOption {
  const option = protocolRecord(value, 'request_user_input option')
  return {
    label: protocolString(option.label, 'request_user_input option label'),
    description: protocolString(option.description, 'request_user_input option description'),
  }
}

function readQuestion(value: unknown): { id: string; question: Question; isSecret: boolean } {
  const question = protocolRecord(value, 'request_user_input question')
  const options = question.options
  assert(
    options === null || Array.isArray(options),
    'request_user_input options must be an array or null',
  )
  return {
    id: protocolString(question.id, 'request_user_input question ID'),
    question: {
      question: protocolString(question.question, 'request_user_input question text'),
      header: protocolString(question.header, 'request_user_input question header'),
      multiSelect: false,
      options: options === null ? [] : options.map(readOption),
    },
    isSecret: question.isSecret === true,
  }
}

// Rekeys the shared, index-based QuestionAnswer shape back into Codex's own
// `ToolRequestUserInputResponse` shape, id-keyed per question. An `options` answer names an
// option by its 1-based position; a `text` answer is Codex's own free-text row, regardless of
// which row position the shared UI assigned it.
export function codexAnswersFor(
  pending: PendingCodexQuestion,
  answers: QuestionAnswer[],
): { answers: Record<string, { answers: string[] }> } {
  const result: Record<string, { answers: string[] }> = {}
  pending.answerIds.forEach((id, index) => {
    const answer = answers[index]
    const question = pending.questions[index]
    if (answer === undefined || question === undefined) return
    result[id] =
      answer.kind === 'text'
        ? { answers: [answer.text] }
        : {
            answers: answer.indices
              .map((position) => question.options[position - 1]?.label)
              .filter((label): label is string => label !== undefined),
          }
  })
  return { answers: result }
}

export function readRequestUserInput(message: WireMessage): PendingCodexQuestion | undefined {
  if (!('method' in message) || message.method !== 'item/tool/requestUserInput') return undefined
  assert(message.id !== undefined, 'request_user_input is missing its request ID')
  const params = message.params
  assert(Array.isArray(params.questions), 'request_user_input is missing its questions')
  const read = params.questions.map(readQuestion)
  const secret = read.find((entry) => entry.isSecret)
  return {
    threadId: protocolString(params.threadId, 'request_user_input thread ID'),
    turnId: protocolString(params.turnId, 'request_user_input Turn ID'),
    itemId: protocolString(params.itemId, 'request_user_input item ID'),
    requestId: message.id,
    answerIds: read.map((entry) => entry.id),
    questions: read.map((entry) => entry.question),
    unsupported:
      secret === undefined
        ? null
        : 'This question asks for a secret value, which Argo cannot show or submit.',
  }
}
