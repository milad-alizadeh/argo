import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import { type QuestionAnswer, validQuestionAnswers } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionLiveInput } from '@/domains/sessions/main/api/session-submit'
import {
  type LiveSessionChannel,
  type LiveSessionChannelEvent,
  type LiveSessionCommand,
  type LiveSessionControls,
  liveSessionChannelEventSchema,
} from '@/harnesses/registration'
import type { CodexRequest, RequestID, WireMessage } from '../app-server/codex-app-server-client'
import { codexCommandContent } from './codex-command-content'
import { codexThreadItemTypeSchema } from './codex-session-history'
import {
  approvalResponse,
  type CodexApproval,
  type CodexInteraction,
  type CodexQuestion,
  questionResponse,
  readCodexInteraction,
} from './codex-session-interactions'
import { codexSubagentContent } from './codex-subagent-content'

export type CodexLiveClient = {
  request: CodexRequest
  onNotification: (listener: (message: WireMessage) => boolean | undefined) => () => void
  respond: (id: RequestID, result: unknown) => void
}

type CodexInputItem =
  | {
      type: 'text'
      text: string
      text_elements: Array<{ byteRange: { start: number; end: number }; placeholder: string }>
    }
  | { type: 'localImage'; path: string }

const threadResultSchema = z.object({ thread: z.object({ id: z.string().min(1) }) })
const turnResultSchema = z.object({ turn: z.object({ id: z.string().min(1) }) })
const turnNotificationSchema = z.object({
  threadId: z.string().min(1),
  turn: z.object({
    id: z.string().min(1),
    status: z.enum(['inProgress', 'completed', 'failed', 'interrupted']),
  }),
})
const itemNotificationSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  item: z
    .object({
      id: z.string().min(1),
      type: z.string().min(1),
      text: z.string().optional(),
      content: z.array(z.unknown()).optional(),
    })
    .passthrough(),
})
const messageDeltaSchema = z.object({
  threadId: z.string().min(1),
  turnId: z.string().min(1),
  itemId: z.string().min(1),
  delta: z.string(),
})
const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000
const userContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('localImage'), path: z.string() }),
  z.object({ type: z.literal('image'), url: z.string() }),
])

function inputItems(command: LiveSessionCommand): CodexInputItem[] {
  const items: CodexInputItem[] = [{ type: 'text', text: command.prompt, text_elements: [] }]
  for (const attachment of command.attachments) {
    if (attachment.kind === 'image') items.push({ type: 'localImage', path: attachment.path })
    else
      items.push({
        type: 'text',
        text: attachment.path,
        text_elements: [
          {
            byteRange: { start: 0, end: Buffer.byteLength(attachment.path) },
            placeholder: attachment.path,
          },
        ],
      })
  }
  return items
}

export class CodexSessionChannel implements LiveSessionChannel {
  private readonly client: CodexLiveClient
  private readonly controls: LiveSessionControls | undefined
  private readonly emit: (event: LiveSessionChannelEvent) => void
  private readonly unsubscribe: () => void
  private readonly queue: LiveSessionCommand[] = []
  private readonly seen = new Set<string>()
  private readonly textByItem = new Map<string, string>()
  private readonly outputByItem = new Map<string, string>()
  private readonly commandByItem = new Map<string, Extract<FeedContent, { kind: 'command' }>>()
  private readonly pending = new Map<string, CodexInteraction>()
  private readonly approvalTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly standingAllow = new Set<string>()
  private interactionAbort = new AbortController()
  private nativeId: string | null = null
  private active: { commandId: string; turnId: string | null; started: boolean } | null = null
  private opening = true
  private closed = false
  private rejected = 0

  constructor(
    input: SessionLiveInput,
    client: CodexLiveClient,
    options: {
      emit: (event: LiveSessionChannelEvent) => void
      controls?: LiveSessionControls
    },
  ) {
    this.client = client
    this.controls = options.controls
    this.emit = (event) => options.emit(liveSessionChannelEventSchema.parse(event))
    this.unsubscribe = client.onNotification((message) => this.receive(message))
    void this.open(input)
  }

  private async open(input: SessionLiveInput) {
    try {
      const nativeId = await this.client.request(
        'resume' in input ? 'thread/resume' : 'thread/start',
        'resume' in input
          ? { threadId: input.resume.nativeId, sandbox: input.turnConfiguration.mode }
          : {
              cwd: input.cwd,
              model: input.turnConfiguration.model,
              approvalPolicy: 'on-request',
              sandbox: input.turnConfiguration.mode,
            },
        (value) => threadResultSchema.parse(value).thread.id,
      )
      if (this.closed) return
      this.nativeId = nativeId
      this.emit({ type: 'identity', nativeId })
      this.opening = false
      await this.submit(input)
    } catch (error) {
      this.fail(error)
    }
  }

  async submit(command: LiveSessionCommand): Promise<void> {
    if (this.closed) throw new Error('Codex Session channel is closed.')
    if (this.seen.has(command.commandId)) return
    this.seen.add(command.commandId)
    this.queue.push(command)
    this.emit({ type: 'command.accepted', commandId: command.commandId })
    if (!this.opening && this.active === null) await this.nextTurn()
  }

  private async nextTurn() {
    const command = this.queue.shift()
    if (command === undefined || this.nativeId === null || this.closed) return
    this.interactionAbort = new AbortController()
    this.active = { commandId: command.commandId, turnId: null, started: false }
    try {
      const turnId = await this.client.request(
        'turn/start',
        {
          threadId: this.nativeId,
          input: inputItems(command),
          model: command.turnConfiguration.model,
          effort: command.turnConfiguration.effort,
        },
        (value) => turnResultSchema.parse(value).turn.id,
      )
      if (this.closed || this.active?.commandId !== command.commandId) return
      if (this.active.turnId !== null && this.active.turnId !== turnId)
        return this.reject('turn/start mismatched Turn')
      this.startTurn(turnId)
    } catch (error) {
      if (this.active?.commandId === command.commandId && !this.active.started) this.fail(error)
    }
  }

  private emitFeed(body: SessionLiveEventBody) {
    if (!this.closed) this.emit({ type: 'feed', body })
  }

  private startTurn(turnId: string) {
    if (this.active === null || this.active.started) return
    this.active.turnId = turnId
    this.active.started = true
    this.emit({ type: 'turn.started', commandId: this.active.commandId })
    this.emitFeed({
      type: 'status',
      status: 'running',
      commandId: this.active.commandId,
      turnId,
      vendorEventId: turnId,
    })
  }

  private clearApproval(requestId: string) {
    const timer = this.approvalTimers.get(requestId)
    if (timer !== undefined) clearTimeout(timer)
    this.approvalTimers.delete(requestId)
    this.pending.delete(requestId)
  }

  private expireApproval(requestId: string) {
    const pending = this.pending.get(requestId)
    if (pending?.kind !== 'permission' || this.closed) return
    this.clearApproval(requestId)
    this.controls?.decidePermission(this.nativeId ?? '', requestId, 'deny')
    try {
      this.client.respond(pending.requestId, { decision: 'decline' })
    } catch (error) {
      this.fail(error)
      return
    }
    this.emitFeed({
      type: 'permission',
      commandId: this.active?.commandId ?? null,
      turnId: pending.turnId,
      vendorEventId: pending.itemId,
      requestId,
      description: pending.description,
      decision: 'deny',
    })
    this.emitFeed({
      type: 'failure',
      commandId: this.active?.commandId ?? null,
      turnId: pending.turnId,
      vendorEventId: pending.itemId,
      detail: 'Codex permission expired without an answer.',
    })
  }

  private reject(method: string) {
    this.rejected += 1
    console.warn(`Rejected ${this.rejected} unsupported Codex live notification(s): ${method}`)
  }

  private receivePermission(interaction: CodexApproval): true {
    const requestId = interaction.publicRequestId
    if (this.standingAllow.has(interaction.similarityKey)) {
      this.client.respond(interaction.requestId, { decision: 'accept' })
      this.emitFeed({
        type: 'permission',
        commandId: this.active?.commandId ?? null,
        turnId: interaction.turnId,
        vendorEventId: interaction.itemId,
        requestId,
        description: interaction.description,
        decision: 'allowForSession',
      })
      return true
    }
    this.pending.set(requestId, interaction)
    if (this.controls !== undefined && this.nativeId !== null)
      void this.controls
        .requestPermission({
          nativeId: this.nativeId,
          requestId,
          description: interaction.description,
          signal: this.interactionAbort.signal,
        })
        .catch(() => undefined)
    const timer = setTimeout(() => this.expireApproval(requestId), APPROVAL_TIMEOUT_MS)
    timer.unref()
    this.approvalTimers.set(requestId, timer)
    this.emitFeed({
      type: 'permission',
      commandId: this.active?.commandId ?? null,
      turnId: interaction.turnId,
      vendorEventId: interaction.itemId,
      requestId,
      description: interaction.description,
      decision: null,
    })
    return true
  }

  private receiveQuestion(interaction: CodexQuestion): true {
    const requestId = interaction.itemId
    this.pending.set(requestId, interaction)
    if (this.controls !== undefined && this.nativeId !== null)
      void this.controls
        .requestQuestion({
          nativeId: this.nativeId,
          requestId,
          questions: interaction.questions,
          signal: this.interactionAbort.signal,
        })
        .catch(() => undefined)
    this.emitFeed({
      type: 'question',
      commandId: this.active?.commandId ?? null,
      turnId: interaction.turnId,
      vendorEventId: interaction.itemId,
      requestId,
      questions: interaction.questions,
      answer: null,
    })
    return true
  }

  private receiveInteraction(
    message: Extract<WireMessage, { method: string }>,
  ): boolean | undefined {
    try {
      const interaction = readCodexInteraction(message)
      if (interaction === null) return undefined
      if (interaction.threadId !== this.nativeId || interaction.turnId !== this.active?.turnId)
        return undefined
      switch (interaction.kind) {
        case 'permission':
          return this.receivePermission(interaction)
        case 'question':
          return this.receiveQuestion(interaction)
      }
    } catch {
      this.reject(message.method)
      return undefined
    }
  }

  private receive(message: WireMessage): boolean | undefined {
    if (this.closed || !('method' in message)) return undefined
    if (message.id !== undefined) return this.receiveInteraction(message)
    switch (message.method) {
      case 'turn/started':
        this.turnStarted(message.params)
        return undefined
      case 'turn/completed':
        this.turnCompleted(message.params)
        return undefined
      case 'item/agentMessage/delta':
        this.messageDelta(message.params)
        return undefined
      case 'item/commandExecution/outputDelta':
        this.commandOutputDelta(message.params)
        return undefined
      case 'item/completed':
        this.itemNotification(message.params, 'completed')
        return undefined
      case 'item/started':
        this.itemNotification(message.params, 'started')
        return undefined
      default:
        return undefined
    }
  }

  private turnStarted(params: Record<string, unknown>) {
    const parsed = turnNotificationSchema.safeParse(params)
    if (!parsed.success || parsed.data.turn.status !== 'inProgress')
      return this.reject('turn/started')
    if (parsed.data.threadId !== this.nativeId || this.active === null) return
    if (this.active.turnId !== null && this.active.turnId !== parsed.data.turn.id)
      return this.reject('turn/started mismatched Turn')
    this.startTurn(parsed.data.turn.id)
  }

  private turnCompleted(params: Record<string, unknown>) {
    const parsed = turnNotificationSchema.safeParse(params)
    if (!parsed.success || parsed.data.turn.status === 'inProgress')
      return this.reject('turn/completed')
    if (parsed.data.threadId !== this.nativeId || this.active?.turnId !== parsed.data.turn.id)
      return
    const { commandId, turnId } = this.active
    this.emitFeed({
      type: 'status',
      status: parsed.data.turn.status === 'completed' ? 'idle' : 'stopped',
      commandId,
      turnId,
      vendorEventId: turnId,
    })
    this.emit({ type: 'turn.completed', commandId })
    for (const requestId of this.pending.keys()) this.clearApproval(requestId)
    this.interactionAbort.abort()
    this.textByItem.clear()
    this.outputByItem.clear()
    this.commandByItem.clear()
    this.active = null
    void this.nextTurn()
  }

  private messageDelta(params: Record<string, unknown>) {
    const parsed = messageDeltaSchema.safeParse(params)
    if (!parsed.success) return this.reject('item/agentMessage/delta')
    const { threadId, turnId, itemId, delta } = parsed.data
    if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
    const text = (this.textByItem.get(itemId) ?? '') + delta
    this.textByItem.set(itemId, text)
    this.emitMessage({ itemId, turnId, role: 'assistant', text })
  }

  private commandOutputDelta(params: Record<string, unknown>) {
    const parsed = messageDeltaSchema.safeParse(params)
    if (!parsed.success) return this.reject('item/commandExecution/outputDelta')
    const { threadId, turnId, itemId, delta } = parsed.data
    if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
    const output = (this.outputByItem.get(itemId) ?? '') + delta
    this.outputByItem.set(itemId, output)
    const command = this.commandByItem.get(itemId)
    if (command === undefined) return
    const updated = { ...command, output }
    this.commandByItem.set(itemId, updated)
    this.emitFeed({
      type: 'content',
      commandId: this.active.commandId,
      turnId,
      vendorEventId: itemId,
      content: updated,
    })
  }

  private commandItem(
    item: z.infer<typeof itemNotificationSchema>['item'],
    turnId: string,
    phase: 'started' | 'completed',
  ) {
    const command = codexCommandContent(item, phase)
    if (command?.kind !== 'command') return this.reject(`item/${phase}`)
    const output =
      phase === 'completed'
        ? (command.output ?? this.outputByItem.get(item.id) ?? null)
        : (this.outputByItem.get(item.id) ?? command.output)
    const updated = { ...command, output }
    this.commandByItem.set(item.id, updated)
    this.emitFeed({
      type: 'content',
      commandId: this.active?.commandId ?? null,
      turnId,
      vendorEventId: item.id,
      content: updated,
    })
  }

  private subagentItem(
    item: z.infer<typeof itemNotificationSchema>['item'],
    turnId: string,
    phase: 'started' | 'completed',
  ) {
    const delegation = codexSubagentContent(item)
    if (delegation === null) return this.reject(`item/${phase}`)
    this.emitFeed({
      type: 'content',
      commandId: this.active?.commandId ?? null,
      turnId,
      vendorEventId: item.id,
      content: delegation,
    })
  }

  private userItem(item: z.infer<typeof itemNotificationSchema>['item'], turnId: string) {
    if (item.content === undefined)
      return this.reject('item/completed: missing userMessage content')
    const content = item.content.map((part) => userContentSchema.safeParse(part))
    if (content.some((part) => !part.success)) return this.reject('item/completed')
    const text = content
      .flatMap((part) => (part.success && part.data.type === 'text' ? [part.data.text] : []))
      .join('\n')
    if (text !== '') this.emitMessage({ itemId: item.id, turnId, role: 'user', text })
  }

  private itemNotification(params: Record<string, unknown>, phase: 'started' | 'completed') {
    const parsed = itemNotificationSchema.safeParse(params)
    if (!parsed.success) return this.reject(`item/${phase}`)
    const { threadId, turnId, item } = parsed.data
    if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
    if (!codexThreadItemTypeSchema.safeParse(item.type).success)
      return this.reject(`item/${phase}: ${item.type}`)
    if (item.type === 'commandExecution') return this.commandItem(item, turnId, phase)
    if (item.type === 'subAgentActivity') return this.subagentItem(item, turnId, phase)
    if (phase === 'started') return
    if (item.type === 'userMessage') return this.userItem(item, turnId)
    if (item.type !== 'agentMessage') return
    if (item.text === undefined) return this.reject('item/completed: missing agentMessage content')
    this.textByItem.set(item.id, item.text)
    this.emitMessage({ itemId: item.id, turnId, role: 'assistant', text: item.text })
  }

  private emitMessage(message: {
    itemId: string
    turnId: string
    role: 'user' | 'assistant'
    text: string
  }) {
    this.emitFeed({
      type: 'content',
      commandId: this.active?.commandId ?? null,
      turnId: message.turnId,
      vendorEventId: message.itemId,
      content: { kind: 'message', id: message.itemId, role: message.role, text: message.text },
    })
  }

  private fail(error: unknown) {
    if (this.closed) return
    const detail = String(error)
    this.emitFeed({
      type: 'failure',
      commandId: this.active?.commandId ?? null,
      turnId: this.active?.turnId ?? null,
      vendorEventId: null,
      detail,
    })
    this.emit({ type: 'failure', detail })
  }

  async interrupt(): Promise<void> {
    if (this.nativeId === null || this.active?.turnId === null || this.active === null)
      throw new Error('Codex Session has no active Turn to interrupt.')
    await this.client.request(
      'turn/interrupt',
      { threadId: this.nativeId, turnId: this.active.turnId },
      (value) => z.strictObject({}).parse(value),
    )
  }

  async answerPermission(requestId: string, decision: PermissionDecision): Promise<boolean> {
    const pending = this.pending.get(requestId)
    if (pending?.kind !== 'permission') return false
    this.client.respond(pending.requestId, approvalResponse(decision))
    this.controls?.decidePermission(this.nativeId ?? '', requestId, decision)
    if (decision === 'allowForSession') this.standingAllow.add(pending.similarityKey)
    this.clearApproval(requestId)
    this.emitFeed({
      type: 'permission',
      commandId: this.active?.commandId ?? null,
      turnId: pending.turnId,
      vendorEventId: pending.itemId,
      requestId,
      description: pending.description,
      decision,
    })
    if (decision === 'cancel') await this.interrupt()
    return true
  }

  async answerQuestion(requestId: string, answers: QuestionAnswer[]): Promise<boolean> {
    const pending = this.pending.get(requestId)
    if (pending?.kind !== 'question' || !validQuestionAnswers(pending.questions, answers))
      return false
    const response = questionResponse(pending, answers)
    this.client.respond(pending.requestId, response)
    this.controls?.decideQuestion(this.nativeId ?? '', requestId, answers)
    this.pending.delete(requestId)
    this.emitFeed({
      type: 'question',
      commandId: this.active?.commandId ?? null,
      turnId: pending.turnId,
      vendorEventId: pending.itemId,
      requestId,
      questions: pending.questions,
      answer: Object.values(response.answers)
        .flatMap(({ answers: values }) => values)
        .join(', '),
    })
    return true
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.pending.clear()
    this.interactionAbort.abort()
    for (const timer of this.approvalTimers.values()) clearTimeout(timer)
    this.approvalTimers.clear()
    this.standingAllow.clear()
    this.unsubscribe()
    this.emit({ type: 'closed' })
  }
}

export function openCodexSessionChannel(
  input: SessionLiveInput,
  client: CodexLiveClient,
  options: {
    emit: (event: LiveSessionChannelEvent) => void
    controls?: LiveSessionControls
  },
): LiveSessionChannel {
  return new CodexSessionChannel(input, client, options)
}
