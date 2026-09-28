import {
  type PermissionMode,
  type Query,
  query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type {
  SessionLiveInput,
  SessionStartInput,
} from '@/domains/sessions/main/api/session-submit'
import {
  type LiveSessionChannel,
  type LiveSessionChannelEvent,
  type LiveSessionCommand,
  type LiveSessionControls,
  liveSessionChannelEventSchema,
} from '@/harnesses/registration'
import { claudeCliEnvironment } from '../cli-environment'
import { createClaudeToolControl } from './claude-channel-controls'
import { decodeClaudeLiveContent } from './claude-feed-decoder'
import { ClaudeLiveText } from './claude-live-text'

type Send = Pick<SessionStartInput, 'prompt' | 'commandId'>
type ClaudeLiveInput = SessionLiveInput
type ClaudeResult = Extract<SDKMessage, { type: 'result' }>
type ClaudeOutput = Exclude<SDKMessage, ClaudeResult>

const permissionModes: Record<string, PermissionMode> = {
  default: 'default',
  manual: 'default',
  acceptEdits: 'acceptEdits',
  bypassPermissions: 'bypassPermissions',
  plan: 'plan',
  dontAsk: 'dontAsk',
  auto: 'auto',
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
}

function decodedFeedEvents(
  message: SDKMessage,
  fallbackCommandId: string,
  reject: () => void,
): SessionLiveEventBody[] {
  const commandId =
    'user_message_uuid' in message && typeof message.user_message_uuid === 'string'
      ? message.user_message_uuid
      : fallbackCommandId
  return decodeClaudeLiveContent(message, reject).map((content) => ({
    type: 'content',
    content,
    commandId,
    turnId: commandId,
    vendorEventId: content.id,
  }))
}

function claudeQueryOptions(
  input: ClaudeLiveInput,
  mode: PermissionMode,
  canUseTool?: ReturnType<typeof createClaudeToolControl>,
) {
  return {
    cwd: 'resume' in input ? input.resume.cwd : input.cwd,
    ...('resume' in input ? { resume: input.resume.nativeId } : {}),
    model: input.turnConfiguration.model,
    permissionMode: mode,
    includePartialMessages: true,
    ...(canUseTool === undefined ? {} : { canUseTool }),
    env: claudeCliEnvironment(),
  }
}

export class ClaudeSessionChannel implements LiveSessionChannel {
  private prompts: Send[] = []
  private wake: (() => void) | null = null
  private session: Query | null = null
  private open = true
  private activeCommandId: string
  private nativeId: string | null = null
  private rejected = 0
  private interruptRequested = false
  private opened = false
  private closedEmitted = false
  private seen = new Set<string>()
  private startedCommands = new Set<string>()
  private liveText = new ClaudeLiveText()
  private input: ClaudeLiveInput
  private controls: LiveSessionControls | undefined
  private onEvent: (event: LiveSessionChannelEvent) => void

  constructor(
    input: ClaudeLiveInput,
    controls: LiveSessionControls | undefined,
    onEvent: (event: LiveSessionChannelEvent) => void,
  ) {
    this.input = input
    this.controls = controls
    this.onEvent = onEvent
    this.activeCommandId = input.commandId
    void this.run()
    void this.submit(input)
  }

  private emit(event: LiveSessionChannelEvent) {
    this.onEvent(liveSessionChannelEventSchema.parse(event))
  }

  private emitFeed(body: SessionLiveEventBody) {
    this.emit({ type: 'feed', body })
  }

  private markTurnStarted() {
    if (this.startedCommands.has(this.activeCommandId)) return
    this.startedCommands.add(this.activeCommandId)
    this.emit({ type: 'turn.started', commandId: this.activeCommandId })
  }

  private emitClosed() {
    if (this.closedEmitted) return
    this.closedEmitted = true
    this.emit({ type: 'closed' })
  }

  private emitStatus(status: 'running' | 'idle') {
    this.emitFeed({
      type: 'status',
      status,
      commandId: this.activeCommandId,
      turnId: this.activeCommandId,
      vendorEventId: null,
    })
  }

  private wakeInput() {
    this.wake?.()
    this.wake = null
  }

  private async *messages(): AsyncGenerator<SDKUserMessage> {
    while (this.open) {
      if (this.prompts.length === 0)
        await new Promise<void>((resolve) => {
          this.wake = resolve
        })
      const command = this.prompts.shift()
      if (command === undefined) continue
      this.activeCommandId = command.commandId
      this.emitFeed({
        type: 'content',
        commandId: command.commandId,
        turnId: command.commandId,
        vendorEventId: command.commandId,
        content: { id: command.commandId, kind: 'message', role: 'user', text: command.prompt },
      })
      this.emitStatus('running')
      yield {
        type: 'user',
        message: { role: 'user', content: command.prompt },
        parent_tool_use_id: null,
        uuid: (isUuid(command.commandId)
          ? command.commandId
          : crypto.randomUUID()) as SDKUserMessage['uuid'],
      }
    }
  }

  async submit(command: LiveSessionCommand): Promise<void> {
    if (!this.open) throw new Error('Claude Session channel is closed.')
    if (this.seen.has(command.commandId)) return
    this.seen.add(command.commandId)
    this.prompts.push({ prompt: command.prompt, commandId: command.commandId })
    this.emit({ type: 'command.accepted', commandId: command.commandId })
    this.wakeInput()
  }

  private emitOutput(message: ClaudeOutput) {
    if (message.type === 'assistant' || message.type === 'stream_event') this.markTurnStarted()
    if (message.type === 'system' && message.subtype === 'init' && !this.opened) {
      this.nativeId = message.session_id
      this.emit({ type: 'identity', nativeId: message.session_id })
    }
    if (message.type === 'assistant') this.liveText.settle(message.message.id)
    if (message.type === 'stream_event') {
      const content = this.liveText.append(message)
      if (content !== null) {
        const commandId = message.user_message_uuid ?? this.activeCommandId
        this.emitFeed({
          type: 'content',
          content,
          commandId,
          turnId: commandId,
          vendorEventId: message.uuid,
        })
      }
    }
    for (const body of decodedFeedEvents(message, this.activeCommandId, () => {
      this.rejected += 1
    }))
      this.emitFeed(body)
  }

  private finishTurn(message: ClaudeResult) {
    if (message.is_error && !this.interruptRequested) throw new Error('Claude Session turn failed.')
    this.markTurnStarted()
    this.interruptRequested = false
    this.nativeId = message.session_id
    this.emitStatus('idle')
    if (!this.opened) {
      this.opened = true
      this.emit({ type: 'identity', nativeId: message.session_id })
    }
    this.emit({ type: 'turn.completed', commandId: this.activeCommandId })
  }

  private async readResults(querySession: Query) {
    for await (const message of querySession) {
      if (!this.open) continue
      if (message.type === 'result') this.finishTurn(message)
      else this.emitOutput(message)
    }
    if (this.open) throw new Error('Claude Session ended before the turn completed.')
  }

  private reportFailure(error: unknown) {
    if (!this.open) return
    const detail = String(error)
    this.emitFeed({
      type: 'failure',
      commandId: this.activeCommandId,
      turnId: this.activeCommandId,
      vendorEventId: null,
      detail,
    })
    this.emit({ type: 'failure', detail })
  }

  private async run() {
    try {
      const mode = permissionModes[this.input.turnConfiguration.mode]
      if (mode === undefined) throw new Error('Unsupported Claude permission mode.')
      const canUseTool =
        this.controls === undefined
          ? undefined
          : createClaudeToolControl({
              controls: this.controls,
              nativeId: () => this.nativeId,
              commandId: () => this.activeCommandId,
              emit: (body) => this.emitFeed(body),
              reject: () => {
                this.rejected += 1
              },
            })
      this.session = query({
        prompt: this.messages(),
        options: claudeQueryOptions(this.input, mode, canUseTool),
      })
      await this.readResults(this.session)
    } catch (error) {
      this.reportFailure(error)
    } finally {
      if (this.rejected > 0)
        console.warn(`Rejected ${this.rejected} unsupported Claude live shape(s).`)
      this.open = false
      this.wakeInput()
      this.session?.close()
      this.emitClosed()
    }
  }

  async interrupt(): Promise<void> {
    if (!this.open || this.session === null)
      throw new Error('Claude Session is not available to interrupt.')
    this.interruptRequested = true
    try {
      await this.session.interrupt()
    } catch (error) {
      this.interruptRequested = false
      throw error
    }
  }

  async answerPermission(requestId: string, decision: PermissionDecision): Promise<boolean> {
    return this.nativeId !== null && this.controls !== undefined
      ? this.controls.decidePermission(this.nativeId, requestId, decision)
      : false
  }

  async answerQuestion(requestId: string, answers: QuestionAnswer[]): Promise<boolean> {
    return this.nativeId !== null && this.controls !== undefined
      ? this.controls.decideQuestion(this.nativeId, requestId, answers)
      : false
  }

  close(): void {
    this.open = false
    this.wakeInput()
    this.session?.close()
    this.emitClosed()
  }
}

export function openClaudeSessionChannel(
  input: ClaudeLiveInput,
  controls: LiveSessionControls | undefined,
  onEvent: (event: LiveSessionChannelEvent) => void,
): LiveSessionChannel {
  return new ClaudeSessionChannel(input, controls, onEvent)
}
