import assert from 'node:assert/strict'

import { z } from 'zod'
import type { Question, QuestionAnswer, QuestionOption } from '@/domains/sessions/contract/drive'
import type { PlanEntryStatus, SessionPlan, SessionStatus } from '@/domains/sessions/contract/model'
import type { Input } from '../input-items'
import type { ManagedSession } from '../supervision/managed-session'

// The subset of `codex app-server`'s JSON-RPC protocol this adapter drives, grounded in codex-harness
// 0.147.0's generated schema (`codex app-server generate-json-schema`) and the live proof recorded
// in docs/research/2026-09-09-codex-transport.md.
export type RequestID = string | number
export type ThreadConfiguration = { cwd: string }
export type SkillsListRequest = { cwds: string[]; forceReload: boolean }
export type RequestParams = {
  initialize: {
    clientInfo: { name: string; title: string; version: string }
    capabilities: { experimentalApi: boolean; requestAttestation: boolean }
  }
  'skills/list': SkillsListRequest
  'thread/start': ThreadConfiguration
  'thread/resume': ThreadConfiguration & { threadId: string }
  'thread/unsubscribe': { threadId: string }
  'thread/list': { cursor?: string; limit?: number }
  'thread/read': { threadId: string; includeTurns: boolean }
  'thread/turns/list': {
    threadId: string
    cursor?: string
    limit?: number
    itemsView: 'full'
    sortDirection: 'asc'
  }
  'thread/loaded/list': { cursor?: string; limit: number }
  'turn/start': {
    threadId: string
    input: Input[]
    model: string
    effort: string
    approvalPolicy: 'on-request' | 'never'
    sandboxPolicy: { type: 'readOnly' | 'workspaceWrite' | 'dangerFullAccess' }
  }
  'turn/steer': { threadId: string; input: Input[]; expectedTurnId: string }
  'turn/interrupt': { threadId: string; turnId: string }
  'thread/name/set': { threadId: string; name: string }
  'thread/compact/start': { threadId: string }
}
export type WireMessage =
  | { method: string; params: Record<string, unknown>; id?: RequestID }
  | { id: RequestID; result: unknown }
  | { id: RequestID; error: { code: number; message: string } }
export type TurnStatus = 'completed' | 'interrupted' | 'failed' | 'inProgress'
export type Turn = { id: string; status: TurnStatus; error: unknown }

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function protocolRecord(value: unknown, label: string): Record<string, unknown> {
  assert(object(value), `${label} must be an object`)
  return value
}

export function protocolString(value: unknown, label: string): string {
  assert(typeof value === 'string', `${label} must be a string`)
  return value
}

export function readMessage(line: string): WireMessage {
  const parsed: unknown = JSON.parse(line)
  const message = protocolRecord(parsed, 'Protocol envelope')
  let id: RequestID | undefined
  if (Object.hasOwn(message, 'id')) {
    assert(
      typeof message.id === 'string' || typeof message.id === 'number',
      'Invalid protocol request ID',
    )
    id = message.id
  }
  if (Object.hasOwn(message, 'method')) {
    const method = protocolString(message.method, 'Protocol method')
    assert(method.length > 0, 'Invalid protocol method')
    const params = protocolRecord(message.params, 'Protocol notification/request params')
    assert(
      !Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error'),
      'Mixed protocol envelope',
    )
    return { ...message, method, params, id }
  }
  assert(id !== undefined, 'Protocol response is missing its ID')
  const hasResult = Object.hasOwn(message, 'result')
  assert(
    hasResult !== Object.hasOwn(message, 'error'),
    'Response needs exactly one result or error',
  )
  if (hasResult) return { ...message, id, result: message.result }
  const error = protocolRecord(message.error, 'Protocol error')
  assert(
    typeof error.code === 'number' && Number.isInteger(error.code),
    'Protocol error is missing its numeric code',
  )
  return {
    ...message,
    id,
    error: {
      ...error,
      code: error.code,
      message: protocolString(error.message, 'Protocol error message'),
    },
  }
}

export function readThreadId(value: unknown): string {
  const thread = protocolRecord(protocolRecord(value, 'Thread result').thread, 'Thread')
  return protocolString(thread.id, 'Thread ID')
}

export function readTurn(value: unknown): Turn {
  const turn = protocolRecord(value, 'Turn')
  const status = turn.status
  assert(
    status === 'completed' ||
      status === 'interrupted' ||
      status === 'failed' ||
      status === 'inProgress',
    'Invalid Turn status',
  )
  return { id: protocolString(turn.id, 'Turn ID'), status, error: turn.error }
}

export function readStartedTurn(value: unknown): Turn {
  return readTurn(protocolRecord(value, 'Turn start result').turn)
}

export function readSteeredTurn(value: unknown): string {
  return protocolString(protocolRecord(value, 'Turn steer result').turnId, 'Steered Turn ID')
}

export function readInterrupt(value: unknown): void {
  const result = protocolRecord(value, 'Interrupt result')
  assert.equal(Object.keys(result).length, 0, 'Interrupt response must be empty')
}

export function readRename(value: unknown): void {
  protocolRecord(value, 'Thread rename result')
}

export function readUpdatedThreadName(message: WireMessage) {
  if (!('method' in message) || message.method !== 'thread/name/updated') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Updated thread ID'),
    title: protocolString(message.params.threadName, 'Updated thread name'),
  }
}

export type AgentMessageText = { threadId: string; turnId: string; itemId: string; text: string }

export function readCompletedAgentMessage(message: WireMessage): AgentMessageText | undefined {
  if (!('method' in message) || message.method !== 'item/completed') return undefined
  const item = protocolRecord(message.params.item, 'Completed item')
  if (item.type !== 'agentMessage') return undefined
  return {
    threadId: protocolString(message.params.threadId, 'Completed item thread ID'),
    turnId: protocolString(message.params.turnId, 'Completed item Turn ID'),
    itemId: protocolString(item.id, 'Completed item ID'),
    text: protocolString(item.text, 'Completed agent message text'),
  }
}

export function readCompactStart(value: unknown): void {
  const result = protocolRecord(value, 'Compact start result')
  assert.equal(Object.keys(result).length, 0, 'Compact start response must be empty')
}

// `thread/compacted` is deprecated in codex-harness's own schema in favor of a `contextCompaction`
// thread item, so compaction is read the same way as any other item lifecycle notification.
function readCompactionItem(
  message: WireMessage,
  method: 'item/started' | 'item/completed',
): { threadId: string } | undefined {
  if (!('method' in message) || message.method !== method) return undefined
  const item = protocolRecord(message.params.item, `Item in ${method}`)
  if (item.type !== 'contextCompaction') return undefined
  return { threadId: protocolString(message.params.threadId, `Thread ID in ${method}`) }
}

// Live-verified on codex-harness 0.147.0: sent as compaction begins, for `thread/compact/start` and an
// automatic compaction alike.
export function readStartedCompaction(message: WireMessage) {
  return readCompactionItem(message, 'item/started')
}

export function readCompletedCompaction(message: WireMessage) {
  return readCompactionItem(message, 'item/completed')
}

const planUpdateSchema = z.object({
  turnId: z.string(),
  plan: z.array(
    z.object({
      step: z.string().trim().min(1),
      status: z.enum(['pending', 'inProgress', 'completed']),
    }),
  ),
})

const PLAN_STATUS: Record<
  z.infer<typeof planUpdateSchema>['plan'][number]['status'],
  PlanEntryStatus
> = {
  pending: 'pending',
  inProgress: 'in_progress',
  completed: 'completed',
}

// `turn/plan/updated` maps Codex's `inProgress` wire spelling to the shared Session vocabulary (CONTEXT.md L3 · Plan).
export function readUpdatedPlan(message: WireMessage): SessionPlan | undefined {
  if (!('method' in message) || message.method !== 'turn/plan/updated') return undefined
  const update = planUpdateSchema.parse(message.params)
  return {
    state: 'available',
    entries: update.plan.map(({ status, step }, position) => ({
      content: step,
      position,
      status: PLAN_STATUS[status],
    })),
  }
}

export type PendingCodexPermission = {
  id: string
  requestId: RequestID
  sessionId: string
  description: string
  additionalPermissions: Record<string, unknown> | null
}

const APPROVAL_METHODS = new Set([
  'item/commandExecution/requestApproval',
  'item/fileChange/requestApproval',
  'item/permissions/requestApproval',
])

export function readRequestApproval(message: WireMessage): PendingCodexPermission | undefined {
  if (!('method' in message) || message.id === undefined || !APPROVAL_METHODS.has(message.method))
    return undefined
  const sessionId = protocolString(message.params.threadId, 'Approval thread ID')
  const id = protocolString(message.params.itemId, 'Approval item ID')
  const reason = message.params.reason
  return {
    id,
    requestId: message.id,
    sessionId,
    description: typeof reason === 'string' && reason.length > 0 ? reason : message.method,
    additionalPermissions:
      message.method === 'item/permissions/requestApproval'
        ? protocolRecord(message.params.permissions, 'Additional permissions')
        : null,
  }
}

export function codexApprovalDecision(
  permission: PendingCodexPermission,
  decision: 'allow' | 'deny' | 'allowForSession' | 'cancel',
) {
  if (permission.additionalPermissions !== null) {
    return {
      permissions:
        decision === 'allow' || decision === 'allowForSession'
          ? permission.additionalPermissions
          : {},
      scope: decision === 'allowForSession' ? 'session' : 'turn',
    }
  }
  return { decision: decision === 'allow' || decision === 'allowForSession' ? 'accept' : 'decline' }
}

export function decidePendingPermission(
  session: ManagedSession | undefined,
  permissionId: string,
  decision: 'allow' | 'deny' | 'allowForSession' | 'cancel',
) {
  const pending = session?.pendingPermission
  if (!session || !pending || pending.id !== permissionId) return false
  session.channel.respond(pending.requestId, codexApprovalDecision(pending, decision))
  session.pendingPermission = null
  if (session.status === 'permission') session.status = 'running'
  return true
}

// A pending `item/tool/requestUserInput` server request (EXPERIMENTAL, grounded against codex-harness
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

// A decided question leaves the Session running, unless a later status already replaced `asking`.
export function settleQuestion(session: {
  pendingQuestion: PendingCodexQuestion | null
  status: SessionStatus
}) {
  session.pendingQuestion = null
  if (session.status === 'asking') session.status = 'running'
}
