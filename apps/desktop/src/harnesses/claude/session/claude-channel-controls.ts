import type { CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { Question, QuestionAnswer } from '@/domains/sessions/api/questions'
import { questionSchema } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { LiveSessionControls } from '@/harnesses/registration'
import { ASK_USER_QUESTION_TOOL } from './claude-status-hooks'

const askInputSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        header: z.string().nullable(),
        multiSelect: z.boolean(),
        options: z.array(
          z.object({
            label: z.string().min(1),
            description: z.string().nullable(),
          }),
        ),
      }),
    )
    .min(1),
})

type ControlIdentity = {
  commandId: string
  turnId: string
  vendorEventId: string
  requestId: string
}
type ControlContext = {
  controls: LiveSessionControls
  nativeId: string
  identity: ControlIdentity
  emit: (body: SessionLiveEventBody) => void
  emitStatus: (status: 'running' | 'permission' | 'asking') => void
  reject: () => void
}

function answerText(answer: QuestionAnswer, question: Question): string {
  if (answer.kind === 'text') return answer.text
  return answer.indices
    .map((index) => {
      const option = question.options[index - 1]
      if (option === undefined) throw new Error('Claude Question answer has an invalid option.')
      return option.label
    })
    .join(', ')
}

function answeredQuestionEntries(questions: Question[], answers: QuestionAnswer[]) {
  return questions.map((question, index): [string, string] => {
    const answer = answers[index]
    if (answer === undefined) throw new Error('Claude Question answer is incomplete.')
    return [question.question, answerText(answer, question)]
  })
}

function permissionResult(
  decision: Awaited<ReturnType<LiveSessionControls['requestPermission']>>,
  options: Parameters<CanUseTool>[2],
): Awaited<ReturnType<CanUseTool>> {
  switch (decision) {
    case 'allow':
      return { behavior: 'allow' }
    case 'allowForSession':
      return { behavior: 'allow', updatedPermissions: options.suggestions }
    case 'deny':
      return { behavior: 'deny', message: 'The user denied this tool.' }
    case 'cancel':
      return { behavior: 'deny', message: 'The user cancelled this tool.', interrupt: true }
  }
}

async function askQuestion(
  context: ControlContext,
  toolInput: Parameters<CanUseTool>[1],
  options: Parameters<CanUseTool>[2],
): Promise<Awaited<ReturnType<CanUseTool>>> {
  const parsed = askInputSchema.safeParse(toolInput)
  if (!parsed.success) {
    context.reject()
    return { behavior: 'deny', message: 'Claude sent an unsupported Question.' }
  }
  const questions = parsed.data.questions.map((question) => questionSchema.parse(question))
  context.emit({ type: 'question', ...context.identity, questions, answer: null })
  context.emitStatus('asking')
  const answers = await context.controls.requestQuestion({
    nativeId: context.nativeId,
    requestId: options.requestId,
    questions,
    signal: options.signal,
  })
  const answered = answeredQuestionEntries(questions, answers)
  context.emit({
    type: 'question',
    ...context.identity,
    questions,
    answer: answered.map(([, text]) => text).join('; '),
  })
  context.emitStatus('running')
  return {
    behavior: 'allow',
    updatedInput: { ...toolInput, answers: Object.fromEntries(answered) },
  }
}

async function askPermission(
  context: ControlContext,
  toolName: string,
  options: Parameters<CanUseTool>[2],
): Promise<Awaited<ReturnType<CanUseTool>>> {
  const description = options.title ?? options.displayName ?? toolName
  context.emit({
    type: 'permission',
    ...context.identity,
    description,
    decision: null,
  })
  context.emitStatus('permission')
  const decision = await context.controls.requestPermission({
    nativeId: context.nativeId,
    requestId: options.requestId,
    description,
    signal: options.signal,
  })
  context.emit({
    type: 'permission',
    ...context.identity,
    description,
    decision,
  })
  context.emitStatus('running')
  return permissionResult(decision, options)
}

export function createClaudeToolControl(input: {
  controls: LiveSessionControls
  nativeId: () => Promise<string | null>
  commandId: () => string
  emit: (body: SessionLiveEventBody) => void
  reject: () => void
}): CanUseTool {
  return async (toolName, toolInput, options) => {
    const commandId = input.commandId()
    const nativeId = await input.nativeId()
    if (nativeId === null)
      return { behavior: 'deny', message: 'Session interaction is unavailable.' }
    const identity = {
      commandId,
      turnId: commandId,
      vendorEventId: options.toolUseID,
      requestId: options.requestId,
    }
    const emitStatus = (status: 'running' | 'permission' | 'asking') =>
      input.emit({
        type: 'status',
        commandId,
        turnId: commandId,
        vendorEventId: options.toolUseID,
        status,
      })
    const context = {
      controls: input.controls,
      nativeId,
      identity,
      emit: input.emit,
      emitStatus,
      reject: input.reject,
    }
    return toolName === ASK_USER_QUESTION_TOOL
      ? askQuestion(context, toolInput, options)
      : askPermission(context, toolName, options)
  }
}
