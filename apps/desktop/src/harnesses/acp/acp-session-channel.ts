import type {
  PermissionOptionKind,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionUpdate,
} from '@agentclientprotocol/sdk'
import { type PermissionDecision, READER_DECISIONS } from '@/domains/sessions/api/permissions'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'
import type { SessionLiveInput } from '@/domains/sessions/main/api'
import {
  type LiveSessionChannel,
  type LiveSessionChannelEvent,
  type LiveSessionCommand,
  type LiveSessionControls,
  liveSessionChannelEventSchema,
} from '@/harnesses/registration'
import { ACP_TURN_SETTING_CATEGORIES, acpConfigSelect } from './acp-catalog'
import { type AcpAgentCommand, type AcpClient, connectAcpAgent } from './acp-client'
import { AcpFeedProjection } from './acp-feed-projection'

type TurnSetting = keyof typeof ACP_TURN_SETTING_CATEGORIES

const decisionOptions = {
  allow: 'allow_once',
  allowForSession: 'allow_always',
  deny: 'reject_once',
  cancel: null,
} as const satisfies Record<PermissionDecision, PermissionOptionKind | null>

export function acpPermissionOutcome(
  request: RequestPermissionRequest,
  decision: PermissionDecision,
): RequestPermissionResponse {
  const kind = decisionOptions[decision]
  const option =
    kind === null ? undefined : request.options.find((candidate) => candidate.kind === kind)
  return option === undefined
    ? { outcome: { outcome: 'cancelled' } }
    : { outcome: { outcome: 'selected', optionId: option.optionId } }
}

// One ACP agent process carrying one Session. Prompts run one at a time in the order they arrive.
export class AcpSessionChannel implements LiveSessionChannel {
  private readonly prompts: LiveSessionCommand[] = []
  private readonly seen = new Set<string>()
  private readonly projection = new AcpFeedProjection()
  private readonly settings = new Map<TurnSetting, { configId: string; value: string }>()
  private wake: (() => void) | null = null
  private client: AcpClient | null = null
  private nativeId: string | null = null
  private activeCommandId: string
  private started = false
  private replaying = false
  private open = true
  private closedEmitted = false
  private invalidSettings = 0
  private readonly cancellation = new AbortController()
  private turnCancellation = new AbortController()
  private closing = false

  private readonly input: SessionLiveInput
  private readonly onEvent: (event: LiveSessionChannelEvent) => void
  private readonly host: { command: AcpAgentCommand; controls: LiveSessionControls | undefined }

  constructor(
    input: SessionLiveInput,
    onEvent: (event: LiveSessionChannelEvent) => void,
    host: { command: AcpAgentCommand; controls: LiveSessionControls | undefined },
  ) {
    this.input = input
    this.onEvent = onEvent
    this.host = host
    this.activeCommandId = input.commandId
    void this.run()
    void this.submit(input)
  }

  private emit(event: LiveSessionChannelEvent) {
    this.onEvent(liveSessionChannelEventSchema.parse(event))
  }

  private identity(vendorEventId: string | null) {
    return { commandId: this.activeCommandId, turnId: this.activeCommandId, vendorEventId }
  }

  private emitFeed(body: SessionLiveEventBody) {
    this.emit({ type: 'feed', body })
  }

  private emitStatus(status: 'running' | 'permission' | 'idle') {
    this.emitFeed({ type: 'status', status, ...this.identity(null) })
  }

  private emitClosed() {
    if (this.closedEmitted) return
    this.closedEmitted = true
    this.emit({ type: 'closed' })
  }

  private receive(sessionId: string, update: SessionUpdate) {
    if (!this.open || (this.nativeId !== null && sessionId !== this.nativeId)) return
    const content = this.projection.project(update)
    if (this.replaying || content === null) return
    if (!this.started) {
      this.started = true
      this.emit({ type: 'turn.started', commandId: this.activeCommandId })
    }
    this.emitFeed({ type: 'content', content, ...this.identity(content.id) })
  }

  private async requestPermission(
    request: RequestPermissionRequest,
    signal: AbortSignal,
  ): Promise<RequestPermissionResponse> {
    const { controls } = this.host
    if (controls === undefined || this.nativeId === null)
      return acpPermissionOutcome(request, 'cancel')
    const decisions = READER_DECISIONS.filter((decision) =>
      request.options.some((option) => option.kind === decisionOptions[decision]),
    )
    if (decisions.length === 0) return acpPermissionOutcome(request, 'cancel')
    const requestId = `${request.toolCall.toolCallId}:${crypto.randomUUID()}`
    const description = request.toolCall.title ?? request.toolCall.toolCallId
    const permission = {
      type: 'permission',
      ...this.identity(null),
      requestId,
      description,
    } as const
    this.emitFeed({ ...permission, decision: null })
    this.emitStatus('permission')
    const decision = await controls
      .requestPermission({
        nativeId: this.nativeId,
        requestId,
        description,
        decisions,
        signal: AbortSignal.any([signal, this.cancellation.signal, this.turnCancellation.signal]),
      })
      .catch(() => 'cancel' as const)
    if (!this.open) return acpPermissionOutcome(request, 'cancel')
    this.emitFeed({ ...permission, decision })
    this.emitStatus('running')
    return acpPermissionOutcome(request, decision)
  }

  private rememberSettings(configOptions: readonly unknown[]) {
    this.settings.clear()
    for (const [setting, category] of Object.entries(ACP_TURN_SETTING_CATEGORIES)) {
      const reading = acpConfigSelect(configOptions, category)
      if (reading.kind === 'invalid') this.invalidSettings += 1
      if (reading.kind !== 'reported') continue
      this.settings.set(setting as TurnSetting, {
        configId: reading.select.id,
        value: reading.select.currentValue,
      })
    }
  }

  // Sends only the settings the agent still reports and the command changes; a model can drop effort.
  private async applySettings(client: AcpClient, sessionId: string, command: LiveSessionCommand) {
    for (const setting of Object.keys(ACP_TURN_SETTING_CATEGORIES) as TurnSetting[]) {
      const current = this.settings.get(setting)
      const wanted = command.turnConfiguration[setting]
      if (current === undefined || wanted === current.value) continue
      this.rememberSettings(await client.setConfigOption(sessionId, current.configId, wanted))
    }
  }

  private async openSession(client: AcpClient) {
    if (!('resume' in this.input)) return client.newSession(this.input.cwd)
    const { nativeId, cwd } = this.input.resume
    this.nativeId = nativeId
    // A load replays the prompts before this one, so the next prompt row keeps its place.
    if (client.capabilities.loadSession) {
      this.replaying = true
      try {
        return await client.loadSession(nativeId, cwd)
      } finally {
        this.replaying = false
      }
    }
    return client.resumeSession(nativeId, cwd)
  }

  private async nextPrompt(): Promise<LiveSessionCommand | null> {
    while (this.open) {
      const command = this.prompts.shift()
      if (command !== undefined) return command
      await new Promise<void>((resolve) => {
        this.wake = resolve
      })
    }
    return null
  }

  private async runPrompt(client: AcpClient, sessionId: string, command: LiveSessionCommand) {
    this.activeCommandId = command.commandId
    this.turnCancellation = new AbortController()
    this.started = false
    this.projection.settle()
    const prompt = this.projection.openPrompt(command.prompt)
    this.emitFeed({ type: 'content', content: prompt, ...this.identity(prompt.id) })
    this.emitStatus('running')
    await this.applySettings(client, sessionId, command)
    await client.prompt(sessionId, command.prompt)
    if (!this.open) return
    this.projection.settle()
    if (!this.started) this.emit({ type: 'turn.started', commandId: command.commandId })
    this.emitStatus('idle')
    this.emit({ type: 'turn.completed', commandId: command.commandId })
  }

  private async run() {
    try {
      const client = await connectAcpAgent(this.host.command, {
        update: (sessionId, update) => this.receive(sessionId, update),
        requestPermission: (request, signal) => this.requestPermission(request, signal),
      })
      this.client = client
      if (!this.open) return this.finishClose(client, null)
      void client.closed.then(() => {
        if (this.open) this.fail(new Error('The ACP agent ended the Session.'))
      })
      const session = await this.openSession(client)
      this.nativeId = session.sessionId
      if (!this.open) return this.finishClose(client, session.sessionId)
      this.rememberSettings(session.configOptions)
      this.emit({ type: 'identity', nativeId: session.sessionId })
      for (
        let command = await this.nextPrompt();
        command !== null;
        command = await this.nextPrompt()
      )
        await this.runPrompt(client, session.sessionId, command)
    } catch (error) {
      this.fail(error)
    } finally {
      if (this.projection.rejected > 0)
        console.warn(`Rejected ${this.projection.rejected} unsupported ACP live update(s).`)
      if (this.invalidSettings > 0)
        console.warn(`Skipped ${this.invalidSettings} unreadable ACP Turn setting(s).`)
      this.close()
    }
  }

  private fail(error: unknown) {
    if (!this.open) return
    const detail = error instanceof Error ? error.message : String(error)
    this.emitFeed({ type: 'failure', ...this.identity(null), detail })
    this.emit({ type: 'failure', detail })
    this.close()
  }

  async submit(command: LiveSessionCommand): Promise<void> {
    if (!this.open) throw new Error('The ACP Session channel is closed.')
    if (this.seen.has(command.commandId)) return
    this.seen.add(command.commandId)
    this.prompts.push(command)
    this.emit({ type: 'command.accepted', commandId: command.commandId })
    this.wake?.()
    this.wake = null
  }

  async interrupt(): Promise<void> {
    if (!this.open || this.client === null || this.nativeId === null)
      throw new Error('The ACP Session is not available to interrupt.')
    this.turnCancellation.abort()
    await this.client.cancel(this.nativeId)
  }

  async answerPermission(requestId: string, decision: PermissionDecision): Promise<boolean> {
    return this.nativeId !== null && this.host.controls !== undefined
      ? this.host.controls.decidePermission(this.nativeId, requestId, decision)
      : false
  }

  // ACP has no Question request; nothing is ever pending to answer.
  async answerQuestion(_requestId: string, _answers: QuestionAnswer[]): Promise<boolean> {
    return false
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.cancellation.abort()
    this.wake?.()
    this.wake = null
    if (this.client !== null && this.nativeId !== null)
      void this.finishClose(this.client, this.nativeId)
    else this.emitClosed()
  }

  private async finishClose(client: AcpClient, nativeId: string | null) {
    if (this.closing) return
    this.closing = true
    const timeout = setTimeout(() => client.close(), 5_000)
    try {
      if (nativeId !== null && client.capabilities.closeSession) await client.closeSession(nativeId)
    } catch (error) {
      console.warn('The ACP agent could not close its Session.', error)
    } finally {
      clearTimeout(timeout)
      client.close()
      this.emitClosed()
    }
  }
}
