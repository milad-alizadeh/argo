import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import { type QuestionAnswer, validQuestionAnswers } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionLiveInput } from '@/domains/sessions/main/api'
import {
  type LiveSessionChannel,
  type LiveSessionChannelEvent,
  type LiveSessionCommand,
  type LiveSessionControls,
  liveSessionChannelEventSchema,
} from '@/harnesses/registration'
import type {
  AgentMessageDeltaNotification,
  CodexRequest,
  ReasoningSummaryTextDeltaNotification,
  RequestID,
  ThreadItem,
  ThreadReadResponse,
  WireMessage,
} from '../app-server'
import {
  type CodexCollabFacts,
  type CodexMessageFacts,
  codexFeedContent,
  codexMessageContent,
  readCodexPlan,
} from './codex-feed'
import {
  approvalResponse,
  type CodexApproval,
  type CodexInteraction,
  type CodexQuestion,
  questionResponse,
  readCodexInteraction,
} from './codex-session-interactions'
import { dispatchCodexNotification } from './codex-session-notifications'
import {
  APPROVAL_TIMEOUT_MS,
  abandonCompactions,
  type CodexActiveTurn,
  type CodexCompaction,
  type CodexQueuedWork,
  inputItems,
} from './codex-session-protocol'
import { followCodexSkillCommands } from './codex-skill-commands'
import { readCodexNickname } from './codex-subagent-nicknames'
import { readCodexThreadStatus } from './codex-thread-status'

export type CodexLiveClient = {
  request: CodexRequest
  onNotification: (listener: (message: WireMessage) => boolean | undefined) => () => void
  respond: (id: RequestID, result: unknown) => void
}

type Turn = ThreadReadResponse['thread']['turns'][number]
type SubagentItem = Extract<ThreadItem, { type: 'subAgentActivity' }>
type LiveStatus = Extract<SessionLiveEventBody, { type: 'status' }>['status']
type TurnNotice = { threadId: string; turn: Pick<Turn, 'id' | 'status'> }

class CodexSessionChannel implements LiveSessionChannel {
  private readonly client: CodexLiveClient
  private readonly controls: LiveSessionControls | undefined
  private readonly emit: (event: LiveSessionChannelEvent) => void
  private readonly unsubscribe: () => void
  private readonly queue: CodexQueuedWork[] = []
  private readonly seen = new Set<string>()
  private readonly textByItem = new Map<string, string>()
  private readonly reasoningByItem = new Map<string, string[]>()
  private readonly phaseByItem = new Map<string, 'commentary' | 'final_answer' | null>()
  private readonly outputByItem = new Map<string, string>()
  private readonly commandByItem = new Map<string, Extract<FeedContent, { kind: 'command' }>>()
  // A Subagent activity and the collab call behind it share an id; either may land first.
  private readonly collabById = new Map<string, CodexCollabFacts>()
  private readonly activityById = new Map<string, SubagentItem>()
  private readonly nicknameByThread = new Map<string, string>()
  private readonly pending = new Map<string, CodexInteraction>()
  private readonly approvalTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly standingAllow = new Set<string>()
  private interactionAbort = new AbortController()
  private nativeId: string | null = null
  private active: CodexActiveTurn | null = null
  private opening = true
  private closed = false
  private rejected = 0
  private skills: ReturnType<typeof followCodexSkillCommands> | null = null
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
      this.skills = followCodexSkillCommands({
        request: this.client.request,
        cwd: 'resume' in input ? input.resume.cwd : input.cwd,
        closed: () => this.closed,
        reject: (shape) => this.reject(shape),
        onCommands: (commands) => {
          if (!this.closed) this.emit({ type: 'commands', availability: 'listed', commands })
        },
      })
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
    if ('compaction' in command) return this.startCompaction(this.nativeId, command)
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

  // The app-server answers at once; the compaction then streams as a Turn on the same thread.
  private async startCompaction(threadId: string, { commandId, compaction }: CodexCompaction) {
    this.active = { commandId, turnId: null, started: false, compaction }
    try {
      await this.client.request('thread/compact/start', { threadId }, () => undefined)
    } catch (error) {
      if (this.active?.commandId !== commandId || this.active.started) return
      this.active = null
      compaction.reject(error instanceof Error ? error : new Error(String(error)))
      void this.nextTurn()
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

  private planUpdated(params: Record<string, unknown>) {
    const plan = readCodexPlan(params)
    if (plan === null) return this.reject('turn/plan/updated')
    if (plan.threadId === this.nativeId && this.active?.turnId === plan.turnId)
      this.emitItemContent(plan.content, plan.content.id, plan.turnId)
  }

  private threadStatusChanged(params: Record<string, unknown>) {
    const reading = readCodexThreadStatus(params)
    if (reading === null) return this.reject('thread/status/changed')
    if (reading.threadId !== this.nativeId || reading.status === null) return
    this.emitStatus(reading.status, this.active?.turnId ?? null)
  }

  private startTurn(turnId: string) {
    if (this.active === null || this.active.started) return
    this.active.turnId = turnId
    this.active.started = true
    this.emit({ type: 'turn.started', commandId: this.active.commandId })
    this.emitStatus('running', turnId)
  }

  private emitPermission(pending: CodexApproval, decision: PermissionDecision | null) {
    const { turnId, itemId: vendorEventId, publicRequestId: requestId, description } = pending
    const commandId = this.active?.commandId ?? null
    this.emitFeed({
      type: 'permission',
      commandId,
      turnId,
      vendorEventId,
      requestId,
      description,
      decision,
    })
  }

  private emitQuestion(pending: CodexQuestion, answer: string | null) {
    const { turnId, itemId, questions } = pending
    const commandId = this.active?.commandId ?? null
    this.emitFeed({
      type: 'question',
      commandId,
      turnId,
      vendorEventId: itemId,
      requestId: itemId,
      questions,
      answer,
    })
  }

  // A Turn boundary keys no row, so its closing status adds a row instead of replacing the opening one.
  private emitStatus(
    status: LiveStatus,
    turnId: string | null,
    vendorEventId: string | null = null,
  ) {
    const commandId = this.active?.commandId ?? null
    this.emitFeed({ type: 'status', status, commandId, turnId, vendorEventId })
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
    this.emitPermission(pending, 'deny')
    this.emitFeed({
      type: 'failure',
      commandId: this.active?.commandId ?? null,
      turnId: pending.turnId,
      vendorEventId: pending.itemId,
      detail: 'Codex permission expired without an answer.',
    })
    this.emitStatus('running', pending.turnId, pending.itemId)
  }

  private reject(method: string) {
    this.rejected += 1
    console.warn(`Rejected ${this.rejected} unsupported Codex live notification(s): ${method}`)
  }

  private receivePermission(interaction: CodexApproval): true {
    const requestId = interaction.publicRequestId
    if (this.standingAllow.has(interaction.similarityKey)) {
      this.client.respond(interaction.requestId, { decision: 'accept' })
      this.emitPermission(interaction, 'allowForSession')
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
    this.emitPermission(interaction, null)
    this.emitStatus('permission', interaction.turnId, interaction.itemId)
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
    this.emitQuestion(interaction, null)
    this.emitStatus('asking', interaction.turnId, interaction.itemId)
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
    return dispatchCodexNotification(message, {
      turnStarted: (params) => this.turnStarted(params),
      turnCompleted: (params) => this.turnCompleted(params),
      threadStatusChanged: (params) => this.threadStatusChanged(params),
      messageDelta: (params) => this.messageDelta(params),
      reasoningSummaryDelta: (params) => this.reasoningSummaryDelta(params),
      commandOutputDelta: (params) => this.commandOutputDelta(params),
      planUpdated: (params) => this.planUpdated(params),
      itemNotification: (params, phase) => this.itemNotification(params, phase),
      skillsChanged: () => this.skills?.changed(),
    })
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
    const { commandId, turnId, compaction } = this.active
    this.emitStatus(status, turnId)
    this.emit({ type: 'turn.completed', commandId })
    if (status === 'idle') compaction?.resolve()
    else compaction?.reject(new Error(`Codex compaction ended ${notice.turn.status}.`))
    for (const requestId of this.pending.keys()) this.clearApproval(requestId)
    this.interactionAbort.abort()
    this.textByItem.clear()
    this.reasoningByItem.clear()
    this.phaseByItem.clear()
    this.outputByItem.clear()
    this.commandByItem.clear()
    this.collabById.clear()
    this.activityById.clear()
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
    this.emitItemContent({ kind: 'reasoning', id: itemId, text: parts.join('\n') }, itemId, turnId)
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

  private commandItem(item: Extract<ThreadItem, { type: 'commandExecution' }>, turnId: string) {
    const [command] = codexFeedContent(item, (type) => this.reject(`item: ${type}`))
    if (command?.kind !== 'command') return
    const output = command.output ?? this.outputByItem.get(item.id) ?? null
    const updated = { ...command, output }
    this.commandByItem.set(item.id, updated)
    this.emitItemContent(updated, item.id, turnId)
  }

  // Drawn at once, and again with the nickname only a read of the Subagent's own thread gives.
  private subagentItem(item: SubagentItem, turnId: string) {
    this.activityById.set(item.id, item)
    const commandId = this.active?.commandId ?? null
    this.emitDelegation(item, commandId, turnId)
    if (this.nicknameByThread.has(item.agentThreadId)) return
    void readCodexNickname(this.client.request, item.agentThreadId).then((nickname) => {
      if (nickname === null) return
      this.nicknameByThread.set(item.agentThreadId, nickname)
      this.emitDelegation(item, commandId, turnId)
    })
  }

  private collabItem(item: Extract<ThreadItem, { type: 'collabAgentToolCall' }>, turnId: string) {
    this.collabById.set(item.id, { prompt: item.prompt, model: item.model })
    const activity = this.activityById.get(item.id)
    if (activity !== undefined)
      this.emitDelegation(activity, this.active?.commandId ?? null, turnId)
  }

  private emitDelegation(item: SubagentItem, commandId: string | null, turnId: string) {
    const nickname = this.nicknameByThread.get(item.agentThreadId)
    const reject = (type: string) => this.reject(`item: ${type}`)
    for (const content of codexFeedContent(item, reject, this.collabById.get(item.id)))
      this.emitFeed({
        type: 'content',
        commandId,
        turnId,
        vendorEventId: item.id,
        content: content.kind === 'delegation' && nickname ? { ...content, nickname } : content,
      })
  }

  private itemNotification(params: Record<string, unknown>, phase: 'started' | 'completed') {
    try {
      const { threadId, turnId, item } = params as {
        threadId: string
        turnId: string
        item: ThreadItem
      }
      // A compaction's Turn may name itself first in its items, not in a `turn/started`.
      if (threadId === this.nativeId && this.active?.compaction && this.active.turnId === null)
        this.startTurn(turnId)
      if (threadId !== this.nativeId || this.active?.turnId !== turnId) return
      if (item.type === 'commandExecution') return this.commandItem(item, turnId)
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
    if (item.type !== 'agentMessage') {
      for (const content of codexFeedContent(item, (type) =>
        this.reject(`item/completed: ${type}`),
      ))
        this.emitItemContent(content, item.id, turnId)
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
    const commandId = this.active?.commandId ?? null
    this.emitFeed({ type: 'content', commandId, turnId, vendorEventId: itemId, content })
  }

  private emitMessage(message: CodexMessageFacts) {
    this.emitItemContent(codexMessageContent(message), message.itemId, message.turnId)
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

  compact(): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Codex Session channel is closed.'))
    return new Promise<void>((resolve, reject) => {
      this.queue.push({ commandId: crypto.randomUUID(), compaction: { resolve, reject } })
      if (!this.opening && this.active === null) void this.nextTurn()
    })
  }

  async answerPermission(requestId: string, decision: PermissionDecision): Promise<boolean> {
    const pending = this.pending.get(requestId)
    if (pending?.kind !== 'permission') return false
    this.client.respond(pending.requestId, approvalResponse(decision))
    this.controls?.decidePermission(this.nativeId ?? '', requestId, decision)
    if (decision === 'allowForSession') this.standingAllow.add(pending.similarityKey)
    this.clearApproval(requestId)
    this.emitPermission(pending, decision)
    if (decision === 'cancel') await this.interrupt()
    else this.emitStatus('running', pending.turnId, pending.itemId)
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
    this.emitQuestion(
      pending,
      Object.values(response.answers)
        .flatMap(({ answers: values }) => values)
        .join(', '),
    )
    this.emitStatus('running', pending.turnId, pending.itemId)
    return true
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.skills?.stop()
    this.skills = null
    this.pending.clear()
    this.interactionAbort.abort()
    for (const timer of this.approvalTimers.values()) clearTimeout(timer)
    this.approvalTimers.clear()
    this.standingAllow.clear()
    abandonCompactions(this.active, this.queue)
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
