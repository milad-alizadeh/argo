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
import type { AgentMessageDeltaNotification } from '../app-server/protocol-generated/v2/agent-message-delta-notification'
import type { ReasoningSummaryTextDeltaNotification } from '../app-server/protocol-generated/v2/reasoning-summary-text-delta-notification'
import type { ThreadItem } from '../app-server/protocol-generated/v2/thread-item'
import type { ThreadReadResponse } from '../app-server/protocol-generated/v2/thread-read-response'
import { codexCommandContent } from './codex-command-content'
import { codexContentFromItems, userPromptMessage, userPromptParts } from './codex-session-history'
import {
  approvalResponse,
  type CodexApproval,
  type CodexInteraction,
  type CodexQuestion,
  questionResponse,
  readCodexInteraction,
} from './codex-session-interactions'
import { APPROVAL_TIMEOUT_MS, inputItems } from './codex-session-protocol'
import { CodexSubagentNicknames, CodexSubagentPairing } from './codex-subagent-content'
import { readCodexThreadStatus } from './codex-thread-status'

export type CodexLiveClient = {
  request: CodexRequest
  onNotification: (listener: (message: WireMessage) => boolean | undefined) => () => void
  respond: (id: RequestID, result: unknown) => void
}

type Turn = ThreadReadResponse['thread']['turns'][number]
type TurnNotice = { threadId: string; turn: Pick<Turn, 'id' | 'status'> }

export class CodexSessionChannel implements LiveSessionChannel {
  private readonly client: CodexLiveClient
  private readonly controls: LiveSessionControls | undefined
  private readonly emit: (event: LiveSessionChannelEvent) => void
  private readonly unsubscribe: () => void
  private readonly queue: LiveSessionCommand[] = []
  private readonly seen = new Set<string>()
  private readonly textByItem = new Map<string, string>()
  private readonly reasoningByItem = new Map<string, string[]>()
  private readonly phaseByItem = new Map<string, 'commentary' | 'final_answer' | null>()
  private readonly outputByItem = new Map<string, string>()
  private readonly commandByItem = new Map<string, Extract<FeedContent, { kind: 'command' }>>()
  private readonly subagents: CodexSubagentPairing
  private readonly pending = new Map<string, CodexInteraction>()
  private readonly approvalTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly standingAllow = new Set<string>()
  private interactionAbort = new AbortController()
  private nativeId: string | null = null
  private active: { commandId: string; turnId: string | null; started: boolean } | null = null
  private opening = true
  private closed = false
  private rejected = 0
  private lastStatus: string | null = null

  constructor(
    input: SessionLiveInput,
    client: CodexLiveClient,
    options: {
      emit: (event: LiveSessionChannelEvent) => void
      controls?: LiveSessionControls
    },
  ) {
    this.client = client
    this.subagents = new CodexSubagentPairing(new CodexSubagentNicknames(client.request))
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
        (value) => (value as ThreadReadResponse).thread.id,
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
        (value) => (value as { turn: Pick<Turn, 'id'> }).turn.id,
      )
      if (this.closed || this.active?.commandId !== command.commandId) return
      if (this.active.turnId !== null && this.active.turnId !== turnId)
        return this.reject('turn/start mismatched Turn')
      this.startTurn(turnId)
    } catch (error) {
      if (this.active?.commandId === command.commandId && !this.active.started) this.fail(error)
    }
  }

  // Turn boundaries and thread status both report a status, so a repeat adds no Feed row.
  private emitFeed(body: SessionLiveEventBody) {
    if (this.closed) return
    if (body.type === 'status') {
      if (body.status === this.lastStatus) return
      this.lastStatus = body.status
    }
    this.emit({ type: 'feed', body })
  }

  private threadStatusChanged(params: Record<string, unknown>) {
    const reading = readCodexThreadStatus(params)
    if (reading === null) return this.reject('thread/status/changed')
    if (reading.threadId !== this.nativeId || reading.status === null) return
    this.emitFeed({
      type: 'status',
      status: reading.status,
      commandId: this.active?.commandId ?? null,
      turnId: this.active?.turnId ?? null,
      vendorEventId: null,
    })
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

  private emitInteractionStatus(
    status: 'running' | 'permission' | 'asking',
    interaction: CodexInteraction,
  ) {
    this.emitFeed({
      type: 'status',
      status,
      commandId: this.active?.commandId ?? null,
      turnId: interaction.turnId,
      vendorEventId: interaction.itemId,
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
    this.emitInteractionStatus('running', pending)
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
    this.emitInteractionStatus('permission', interaction)
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
    this.emitInteractionStatus('asking', interaction)
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
    try {
      return this.receiveNotification(message)
    } catch {
      this.reject(message.method)
      return undefined
    }
  }

  private receiveNotification(message: Extract<WireMessage, { method: string }>): undefined {
    switch (message.method) {
      case 'turn/started':
        this.turnStarted(message.params)
        return undefined
      case 'turn/completed':
        this.turnCompleted(message.params)
        return undefined
      case 'thread/status/changed':
        this.threadStatusChanged(message.params)
        return undefined
      case 'item/agentMessage/delta':
        this.messageDelta(message.params)
        return undefined
      case 'item/reasoning/summaryTextDelta':
        this.reasoningSummaryDelta(message.params)
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
    const notice = params as TurnNotice
    if (notice.turn.status !== 'inProgress') return this.reject('turn/started')
    if (notice.threadId !== this.nativeId || this.active === null) return
    if (this.active.turnId !== null && this.active.turnId !== notice.turn.id)
      return this.reject('turn/started mismatched Turn')
    this.startTurn(notice.turn.id)
  }

  private turnCompleted(params: Record<string, unknown>) {
    const notice = params as TurnNotice
    if (notice.turn.status === 'inProgress') return this.reject('turn/completed')
    if (notice.threadId !== this.nativeId || this.active?.turnId !== notice.turn.id) return
    let status: 'idle' | 'stopped'
    switch (notice.turn.status) {
      case 'completed':
        status = 'idle'
        break
      case 'failed':
      case 'interrupted':
        status = 'stopped'
        break
      default:
        return this.reject('turn/completed')
    }
    const { commandId, turnId } = this.active
    this.emitFeed({
      type: 'status',
      status,
      commandId,
      turnId,
      vendorEventId: turnId,
    })
    this.emit({ type: 'turn.completed', commandId })
    for (const requestId of this.pending.keys()) this.clearApproval(requestId)
    this.interactionAbort.abort()
    this.textByItem.clear()
    this.reasoningByItem.clear()
    this.phaseByItem.clear()
    this.outputByItem.clear()
    this.commandByItem.clear()
    this.subagents.clear()
    this.active = null
    void this.nextTurn()
  }

  private messageDelta(params: Record<string, unknown>) {
    const { threadId, turnId, itemId, delta } = params as AgentMessageDeltaNotification
    if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
    const text = (this.textByItem.get(itemId) ?? '') + delta
    this.textByItem.set(itemId, text)
    this.emitMessage({
      itemId,
      turnId,
      role: 'assistant',
      text,
      phase: this.phaseByItem.get(itemId),
    })
  }

  private reasoningSummaryDelta(params: Record<string, unknown>) {
    const { threadId, turnId, itemId, delta, summaryIndex } =
      params as ReasoningSummaryTextDeltaNotification
    if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
    const parts = this.reasoningByItem.get(itemId) ?? []
    parts[summaryIndex] = (parts[summaryIndex] ?? '') + delta
    this.reasoningByItem.set(itemId, parts)
    this.emitItemContent(
      { kind: 'reasoning', id: itemId, text: parts.join('\n'), redacted: false },
      itemId,
      turnId,
    )
  }

  private commandOutputDelta(params: Record<string, unknown>) {
    const { threadId, turnId, itemId, delta } = params as AgentMessageDeltaNotification
    if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
    const output = (this.outputByItem.get(itemId) ?? '') + delta
    this.outputByItem.set(itemId, output)
    const command = this.commandByItem.get(itemId)
    if (command === undefined) return
    const updated = { ...command, output }
    this.commandByItem.set(itemId, updated)
    this.emitItemContent(updated, itemId, turnId)
  }

  private commandItem(
    item: Extract<ThreadItem, { type: 'commandExecution' }>,
    turnId: string,
    phase: 'started' | 'completed',
  ) {
    const command = codexCommandContent(item, phase)
    const output =
      phase === 'completed'
        ? (command.output ?? this.outputByItem.get(item.id) ?? null)
        : (this.outputByItem.get(item.id) ?? command.output)
    const updated = { ...command, output }
    this.commandByItem.set(item.id, updated)
    this.emitItemContent(updated, item.id, turnId)
  }

  private subagentItem(item: Extract<ThreadItem, { type: 'subAgentActivity' }>, turnId: string) {
    const redraw = (content: FeedContent) => this.emitItemContent(content, content.id, turnId)
    this.emitItemContent(this.subagents.activity(item, redraw), item.id, turnId)
  }

  private collabItem(item: Extract<ThreadItem, { type: 'collabAgentToolCall' }>, turnId: string) {
    const delegation = this.subagents.collab(item)
    if (delegation !== null) this.emitItemContent(delegation, item.id, turnId)
  }

  private userItem(item: Extract<ThreadItem, { type: 'userMessage' }>, turnId: string) {
    const content = userPromptMessage(item.id, userPromptParts(item.content))
    if (content !== null) this.emitItemContent(content, item.id, turnId)
  }

  private itemNotification(params: Record<string, unknown>, phase: 'started' | 'completed') {
    try {
      const { threadId, turnId, item } = params as {
        threadId: string
        turnId: string
        item: ThreadItem
      }
      if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
      if (item.type === 'commandExecution') return this.commandItem(item, turnId, phase)
      if (item.type === 'subAgentActivity') return this.subagentItem(item, turnId)
      if (item.type === 'collabAgentToolCall') return this.collabItem(item, turnId)
      // A started edit already names its files, so the Feed shows it before the patch lands.
      if (item.type === 'fileChange') return this.completedItem(item, turnId)
      if (phase === 'started') {
        if (item.type === 'agentMessage') this.phaseByItem.set(item.id, item.phase)
        return
      }
      this.completedItem(item, turnId)
    } catch {
      this.reject(`item/${phase}`)
    }
  }

  private completedItem(item: ThreadItem, turnId: string) {
    if (item.type === 'userMessage') return this.userItem(item, turnId)
    if (item.type !== 'agentMessage') {
      let projected: FeedContent[]
      try {
        projected = codexContentFromItems([item])
      } catch {
        return this.reject(`item/completed: ${item.type}`)
      }
      for (const content of projected) this.emitItemContent(content, item.id, turnId)
      return
    }
    this.phaseByItem.set(item.id, item.phase)
    this.textByItem.set(item.id, item.text)
    this.emitMessage({
      itemId: item.id,
      turnId,
      role: 'assistant',
      text: item.text,
      phase: this.phaseByItem.get(item.id),
    })
  }

  private emitItemContent(content: FeedContent, itemId: string, turnId: string) {
    this.emitFeed({
      type: 'content',
      commandId: this.active?.commandId ?? null,
      turnId,
      vendorEventId: itemId,
      content,
    })
  }

  private emitMessage(message: {
    itemId: string
    turnId: string
    role: 'user' | 'assistant'
    text: string
    phase?: 'commentary' | 'final_answer' | null
  }) {
    this.emitItemContent(
      {
        kind: 'message',
        id: message.itemId,
        role: message.role,
        text: message.text,
        ...(message.phase !== undefined ? { phase: message.phase } : {}),
      },
      message.itemId,
      message.turnId,
    )
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
      () => undefined,
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
    else this.emitInteractionStatus('running', pending)
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
    this.emitInteractionStatus('running', pending)
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
