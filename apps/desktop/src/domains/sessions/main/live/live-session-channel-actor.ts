import { fromCallback } from 'xstate'
import type { PermissionDecision } from '@/domains/sessions/api/permissions'
import type { QuestionAnswer } from '@/domains/sessions/api/questions'
import {
  type HarnessRegistration,
  type LiveSessionChannel,
  type LiveSessionChannelEvent,
  type LiveSessionControls,
  liveSessionChannelEventSchema,
} from '@/harnesses/registration'
import type { SessionLiveInput } from '../api/session-submit'
import type { SessionCommandStore } from '../database/session-command-store'

export type LiveChannelActorEvent =
  | { type: 'Harness identified'; nativeId: string }
  | { type: 'Harness ready'; nativeId: string }
  | {
      type: 'Harness feed'
      serial: number
      body: Extract<LiveSessionChannelEvent, { type: 'feed' }>['body']
    }
  | { type: 'Harness failed'; failure: string }

type ChannelCommand =
  | { type: 'Send'; command: Parameters<LiveSessionChannel['submit']>[0] }
  | { type: 'Interrupt'; reply: { resolve: () => void; reject: (error: Error) => void } }
  | {
      type: 'Answer permission'
      requestId: string
      decision: PermissionDecision
      reply: { resolve: (accepted: boolean) => void; reject: (error: Error) => void }
    }
  | {
      type: 'Answer question'
      requestId: string
      answers: QuestionAnswer[]
      reply: { resolve: (accepted: boolean) => void; reject: (error: Error) => void }
    }

function channelEvents(
  input: SessionLiveInput,
  sendBack: (event: LiveChannelActorEvent) => void,
  commands?: SessionCommandStore,
) {
  let nativeId: string | null = null
  let serial = 0
  let activeCommandId = input.commandId
  let rejected = 0
  let failed = false
  return (untrusted: LiveSessionChannelEvent) => {
    const parsed = liveSessionChannelEventSchema.safeParse(untrusted)
    if (!parsed.success) {
      rejected += 1
      console.warn(`Rejected ${rejected} unsupported live channel event(s).`)
      return
    }
    const event = parsed.data
    switch (event.type) {
      case 'identity':
        nativeId = event.nativeId
        sendBack({ type: 'Harness identified', nativeId: event.nativeId })
        return
      case 'turn.completed':
        commands?.record(event.commandId, 'completed')
        if (nativeId !== null) sendBack({ type: 'Harness ready', nativeId })
        return
      case 'feed':
        serial += 1
        sendBack({ type: 'Harness feed', serial, body: event.body })
        return
      case 'failure':
        failed = true
        commands?.record(activeCommandId, 'uncertain')
        sendBack({ type: 'Harness failed', failure: event.detail })
        return
      case 'closed':
        if (!failed) sendBack({ type: 'Harness failed', failure: 'Live Session channel closed.' })
        return
      case 'command.accepted':
        commands?.record(event.commandId, 'accepted')
        return
      case 'turn.started':
        activeCommandId = event.commandId
        commands?.record(event.commandId, 'running')
        return
    }
  }
}

function errorOf(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

function receiveChannelCommand(
  channel: LiveSessionChannel,
  event: ChannelCommand,
  sendBack: (event: LiveChannelActorEvent) => void,
) {
  switch (event.type) {
    case 'Send':
      void channel.submit(event.command).catch((error) => {
        sendBack({ type: 'Harness failed', failure: String(error) })
      })
      return
    case 'Interrupt':
      void channel
        .interrupt()
        .then(event.reply.resolve, (error) => event.reply.reject(errorOf(error)))
      return
    case 'Answer permission':
      void channel
        .answerPermission(event.requestId, event.decision)
        .then(event.reply.resolve, (error) => event.reply.reject(errorOf(error)))
      return
    case 'Answer question':
      void channel
        .answerQuestion(event.requestId, event.answers)
        .then(event.reply.resolve, (error) => event.reply.reject(errorOf(error)))
      return
  }
}

export function liveSessionChannelActor(
  open: NonNullable<HarnessRegistration['openLiveSession']>,
  controls: LiveSessionControls | undefined,
  commands?: SessionCommandStore,
) {
  return fromCallback<ChannelCommand, SessionLiveInput, LiveChannelActorEvent>(
    ({ input, receive, sendBack }) => {
      const channel = open(input, controls, channelEvents(input, sendBack, commands))
      receive((event) => receiveChannelCommand(channel, event, sendBack))
      return () => channel.close()
    },
  )
}
