import { assign, fromPromise, setup } from 'xstate'
import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import type {
  Message,
  SessionUsage,
  ToolCall,
  Turn,
  TurnStatus,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { type CodexChannel, CodexChannelClosedError } from './codex-channel'
import type { PendingCodexPermission } from './permission-protocol'
import { codexApprovalDecision, readRequestApproval } from './permission-protocol'
import { readThreadId, type WireMessage, type TurnStatus as WireTurnStatus } from './protocol'
import {
  readAgentMessageDelta,
  readClosedThread,
  readCompletedTurn,
  readThreadStatus,
  readThreadTokenUsageUpdated,
  readToolCallUpdate,
} from './protocol-notifications'
import type { PendingCodexQuestion } from './question-protocol'
import { codexAnswersFor, readRequestUserInput } from './question-protocol'
import { readUpdatedThreadName } from './rename-protocol'

function turnStatusFrom(status: WireTurnStatus): TurnStatus {
  return status === 'inProgress' ? 'running' : status
}

// ADR-0047: one child actor per managed Codex Session, multiplexed as a thread over the shared
// `codex app-server` channel the supervisor owns. Everything server-driven arrives as a
// `Notification` event; the adapter broadcasts every notification to every live child, and each
// child's own guards accept only the ones addressed to its threadId. This machine never reads the
// channel directly outside its own invoked actors.
export type ManagedSessionDeps = {
  getChannel: () => CodexChannel | null
  sessionService: SessionService
  waitForWorkspaceReady: (workspaceId: string) => Promise<void>
  now: () => Date
}

type SendOutcome = 'accepted' | 'rejected' | 'uncertain'

type ManagedSessionContext = {
  sessionId: SessionIdentity | null
  workspaceId: string
  cwd: string
  turnId: string | null
  turns: Turn[]
  messages: Message[]
  toolCalls: ToolCall[]
  usage: SessionUsage
  title: string | null
  pendingApproval: PendingCodexPermission | null
  pendingQuestion: PendingCodexQuestion | null
  // Lets the adapter's execute() learn how the most recent Send settled without inspecting the
  // rejected promise itself (context stays serializable): 'accepted' once turn/start's response
  // arrives, 'uncertain' when the channel drops before it does, 'rejected' on any other error.
  // `sendSequence` increments on every settlement so a waiter can tell "this" Send apart from a
  // later one.
  lastSendOutcome: SendOutcome | null
  lastSendRejection: string | null
  sendSequence: number
  opensExistingThread: boolean
}

// A fresh `session.start` carries no native ID: Codex only hands one back in `thread/start`'s
// response, so lease acquisition (keyed on that ID) cannot run before the thread exists. A
// `resume` already knows the ID. It calls `thread/resume` only after the lease is held (#2581).
export type ManagedSessionInput =
  | {
      kind: 'start'
      workspaceId: string
      cwd: string
    }
  | {
      kind: 'resume'
      sessionId: SessionIdentity
      workspaceId: string
      cwd: string
    }

export type ManagedSessionEvent =
  | {
      type: 'Send'
      prompt: string
    }
  | {
      type: 'Steer'
      prompt: string
    }
  | {
      type: 'Interrupt'
    }
  | {
      type: 'Decide'
      decision: 'approve' | 'reject'
    }
  | {
      type: 'Answer'
      answer: string
    }
  | {
      type: 'Rename'
      title: string
    }
  | {
      type: 'Compact'
    }
  | {
      type: 'Close'
    }
  | {
      type: 'Notification'
      message: WireMessage
    }
  | {
      type: 'Channel lost'
    }
  | {
      type: 'Channel restored'
    }

function requireChannel(getChannel: () => CodexChannel | null): CodexChannel {
  const channel = getChannel()
  if (channel === null) throw new Error('Codex app-server channel is not connected')
  return channel
}

function threadIdOf(context: ManagedSessionContext): string {
  if (context.sessionId === null) throw new Error('Managed Session has no identity yet')
  return context.sessionId.nativeId
}

function hasThreadStatus(
  context: ManagedSessionContext,
  event: ManagedSessionEvent,
  type: 'notLoaded' | 'systemError',
): boolean {
  if (event.type !== 'Notification') return false
  const status = readThreadStatus(event.message)
  return (
    status !== undefined && status.threadId === threadIdOf(context) && status.status.type === type
  )
}

function createManagedSessionActors(deps: ManagedSessionDeps) {
  return {
    waitForWorkspace: fromPromise<
      void,
      {
        workspaceId: string
      }
    >(({ input }) => deps.waitForWorkspaceReady(input.workspaceId)),
    acquireLease: fromPromise<
      ReturnType<SessionService['acquire']>,
      {
        sessionId: SessionIdentity
      }
    >(({ input }) => Promise.resolve(deps.sessionService.acquire(input.sessionId))),
    releaseLease: fromPromise<
      void,
      {
        sessionId: SessionIdentity
      }
    >(({ input }) => {
      deps.sessionService.release(input.sessionId)
      return Promise.resolve()
    }),
    resumeThread: fromPromise<
      {
        threadId: string
      },
      {
        threadId: string
        cwd: string
      }
    >(async ({ input }) => {
      const threadId = await requireChannel(deps.getChannel).request(
        'thread/resume',
        {
          cwd: input.cwd,
          threadId: input.threadId,
        },
        readThreadId,
      )
      if (threadId !== input.threadId) throw new Error('Codex resumed a different Session.')
      return {
        threadId,
      }
    }),
    startThread: fromPromise<
      {
        threadId: string
      },
      {
        cwd: string
      }
    >(async ({ input }) => {
      const threadId = await requireChannel(deps.getChannel).request(
        'thread/start',
        {
          cwd: input.cwd,
        },
        readThreadId,
      )
      return {
        threadId,
      }
    }),
    runTurn: fromPromise<
      {
        turnId: string
      },
      {
        threadId: string
        prompt: string
      }
    >(async ({ input }) => {
      const turn = await requireChannel(deps.getChannel).request(
        'turn/start',
        {
          threadId: input.threadId,
          input: [
            {
              type: 'text',
              text: input.prompt,
              text_elements: [],
            },
          ],
          model: 'gpt-5-codex',
          effort: 'medium',
          approvalPolicy: 'on-request',
          sandboxPolicy: {
            type: 'workspaceWrite',
          },
        },
        (value) => value,
      )
      return {
        turnId: (
          turn as {
            turn: {
              id: string
            }
          }
        ).turn.id,
      }
    }),
    steerTurn: fromPromise<
      void,
      {
        threadId: string
        turnId: string
        prompt: string
      }
    >(async ({ input }) => {
      await requireChannel(deps.getChannel).request(
        'turn/steer',
        {
          threadId: input.threadId,
          input: [
            {
              type: 'text',
              text: input.prompt,
              text_elements: [],
            },
          ],
          expectedTurnId: input.turnId,
        },
        (value) => value,
      )
    }),
    interruptTurn: fromPromise<
      void,
      {
        threadId: string
        turnId: string
      }
    >(async ({ input }) => {
      await requireChannel(deps.getChannel).request(
        'turn/interrupt',
        {
          threadId: input.threadId,
          turnId: input.turnId,
        },
        (value) => value,
      )
    }),
    decideApproval: fromPromise<
      void,
      {
        permission: PendingCodexPermission
        decision: 'approve' | 'reject'
      }
    >(({ input }) => {
      requireChannel(deps.getChannel).respond(
        input.permission.requestId,
        codexApprovalDecision(input.permission, input.decision === 'approve' ? 'allow' : 'deny'),
      )
      return Promise.resolve()
    }),
    answerQuestion: fromPromise<
      void,
      {
        question: PendingCodexQuestion
        answer: string
      }
    >(({ input }) => {
      requireChannel(deps.getChannel).respond(
        input.question.requestId,
        codexAnswersFor(input.question, [
          {
            kind: 'text',
            index: 1,
            text: input.answer,
          },
        ]),
      )
      return Promise.resolve()
    }),
    renameThread: fromPromise<
      void,
      {
        threadId: string
        title: string
      }
    >(async ({ input }) => {
      await requireChannel(deps.getChannel).request(
        'thread/name/set',
        {
          threadId: input.threadId,
          name: input.title,
        },
        (value) => value,
      )
    }),
    compactThread: fromPromise<
      void,
      {
        threadId: string
      }
    >(async ({ input }) => {
      await requireChannel(deps.getChannel).request(
        'thread/compact/start',
        {
          threadId: input.threadId,
        },
        (value) => value,
      )
    }),
    unsubscribeThread: fromPromise<
      void,
      {
        threadId: string
      }
    >(async ({ input }) => {
      await requireChannel(deps.getChannel).request(
        'thread/unsubscribe',
        {
          threadId: input.threadId,
        },
        () => undefined,
      )
    }),
  }
}

export function createManagedSessionMachine(deps: ManagedSessionDeps) {
  return setup({
    types: {
      context: {} as ManagedSessionContext,
      events: {} as ManagedSessionEvent,
      input: {} as ManagedSessionInput,
    },
    actors: createManagedSessionActors(deps),
    guards: {
      isOwnOpenTurn: ({ context }) => context.turnId !== null,
      isTurnCompletedForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const completed = readCompletedTurn(event.message)
        return completed !== undefined && completed.threadId === threadIdOf(context)
      },
      isPermissionRequestedForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const permission = readRequestApproval(event.message)
        return permission !== undefined && permission.sessionId === threadIdOf(context)
      },
      isQuestionAskedForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const question = readRequestUserInput(event.message)
        return question !== undefined && question.threadId === threadIdOf(context)
      },
      isRenamedForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const renamed = readUpdatedThreadName(event.message)
        return renamed !== undefined && renamed.threadId === threadIdOf(context)
      },
      hasMessageDeltaForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const delta = readAgentMessageDelta(event.message)
        return delta !== undefined && delta.threadId === threadIdOf(context)
      },
      hasToolCallUpdateForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const update = readToolCallUpdate(event.message)
        return update !== undefined && update.threadId === threadIdOf(context)
      },
      hasTokenUsageForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const usage = readThreadTokenUsageUpdated(event.message)
        return usage !== undefined && usage.threadId === threadIdOf(context)
      },
      isThreadNotLoaded: ({ context, event }) => {
        return hasThreadStatus(context, event, 'notLoaded')
      },
      isThreadSystemError: ({ context, event }) => {
        return hasThreadStatus(context, event, 'systemError')
      },
      isTurnFailedForThread: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        const completed = readCompletedTurn(event.message)
        return (
          completed !== undefined &&
          completed.threadId === threadIdOf(context) &&
          completed.turn.status === 'failed'
        )
      },
      isThreadClosed: ({ context, event }) => {
        if (event.type !== 'Notification') return false
        return readClosedThread(event.message) === threadIdOf(context)
      },
    },
    actions: {
      clearTurn: assign({
        turnId: null,
      }),
      assignPendingApproval: assign({
        pendingApproval: ({ event }) => {
          if (event.type !== 'Notification') return null
          return readRequestApproval(event.message) ?? null
        },
      }),
      clearPendingApproval: assign({
        pendingApproval: null,
      }),
      assignPendingQuestion: assign({
        pendingQuestion: ({ event }) => {
          if (event.type !== 'Notification') return null
          return readRequestUserInput(event.message) ?? null
        },
      }),
      clearPendingQuestion: assign({
        pendingQuestion: null,
      }),
      markTurnCompleted: assign({
        turns: ({ context, event }) => {
          if (event.type !== 'Notification') return context.turns
          const completed = readCompletedTurn(event.message)
          if (completed === undefined) return context.turns
          const completedAt = deps.now().getTime()
          const status = turnStatusFrom(completed.turn.status)
          const known = context.turns.some((turn) => turn.id === completed.turn.id)
          if (!known) {
            return [
              ...context.turns,
              {
                id: completed.turn.id,
                status,
                startedAt: completedAt,
                completedAt,
              },
            ]
          }
          return context.turns.map((turn) =>
            turn.id === completed.turn.id
              ? {
                  ...turn,
                  status,
                  completedAt,
                }
              : turn,
          )
        },
      }),
      appendMessageDelta: assign({
        messages: ({ context, event }) => {
          if (event.type !== 'Notification') return context.messages
          const delta = readAgentMessageDelta(event.message)
          if (delta === undefined) return context.messages
          const existing = context.messages.find((message) => message.id === delta.itemId)
          if (existing === undefined) {
            return [
              ...context.messages,
              {
                id: delta.itemId,
                turnId: delta.turnId,
                role: 'agent',
                text: delta.text,
              },
            ]
          }
          return context.messages.map((message) =>
            message.id === delta.itemId
              ? {
                  ...message,
                  text: message.text + delta.text,
                }
              : message,
          )
        },
      }),
      appendUserMessage: assign({
        messages: ({ context, event }) => {
          if (event.type !== 'Send') return context.messages
          const turnId = `pending-${context.sendSequence + 1}`
          return [
            ...context.messages,
            {
              id: `user-${context.sendSequence + 1}`,
              turnId,
              role: 'user',
              text: event.prompt,
            },
          ]
        },
      }),
      updateToolCall: assign({
        toolCalls: ({ context, event }) => {
          if (event.type !== 'Notification') return context.toolCalls
          const update = readToolCallUpdate(event.message)
          if (update === undefined) return context.toolCalls
          const existing = context.toolCalls.find((toolCall) => toolCall.id === update.id)
          if (existing === undefined)
            return [
              ...context.toolCalls,
              {
                id: update.id,
                turnId: update.turnId,
                name: update.name,
                status: update.status,
              },
            ]
          return context.toolCalls.map((toolCall) =>
            toolCall.id === update.id
              ? {
                  ...toolCall,
                  name: update.name,
                  status: update.status,
                }
              : toolCall,
          )
        },
      }),
      assignTokenUsage: assign({
        usage: ({ context, event }) => {
          if (event.type !== 'Notification') return context.usage
          const usage = readThreadTokenUsageUpdated(event.message)
          if (usage === undefined) return context.usage
          return {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          }
        },
      }),
      assignTitle: assign({
        title: ({ context, event }) => {
          if (event.type !== 'Notification') return context.title
          return readUpdatedThreadName(event.message)?.title ?? context.title
        },
      }),
    },
    delays: {
      recoveryTimeout: 60_000,
    },
  }).createMachine({
    id: 'codexManagedSessionMachine',
    context: ({ input }) => ({
      sessionId: input.kind === 'resume' ? input.sessionId : null,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      turnId: null,
      turns: [],
      messages: [],
      toolCalls: [],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
      title: null,
      pendingApproval: null,
      pendingQuestion: null,
      lastSendOutcome: null,
      lastSendRejection: null,
      sendSequence: 0,
      opensExistingThread: input.kind === 'resume',
    }),
    initial: 'AwaitingWorkspace',
    states: {
      AwaitingWorkspace: {
        invoke: {
          src: 'waitForWorkspace',
          input: ({ context }) => ({
            workspaceId: context.workspaceId,
          }),
          onDone: 'Routing',
          onError: 'Failed',
        },
      },
      Routing: {
        always: [
          {
            guard: ({ context }) => context.sessionId === null,
            target: 'CreatingThread',
          },
          {
            target: 'AcquiringLease',
          },
        ],
      },
      CreatingThread: {
        invoke: {
          src: 'startThread',
          input: ({ context }) => ({
            cwd: context.cwd,
          }),
          onDone: {
            target: 'AcquiringLease',
            actions: assign({
              sessionId: ({ event }) => ({
                harness: 'codex',
                nativeId: event.output.threadId,
              }),
            }),
          },
          onError: 'Failed',
        },
      },
      AcquiringLease: {
        invoke: {
          src: 'acquireLease',
          input: ({ context }) => ({
            sessionId: context.sessionId as SessionIdentity,
          }),
          onDone: [
            {
              guard: ({ event }) => event.output.posture !== 'managed',
              target: 'Watched',
            },
            {
              guard: ({ context }) => context.opensExistingThread,
              target: 'ResumingThread',
            },
            {
              target: 'Active',
            },
          ],
          onError: 'Failed',
        },
      },
      ResumingThread: {
        invoke: {
          src: 'resumeThread',
          input: ({ context }) => ({
            threadId: threadIdOf(context),
            cwd: context.cwd,
          }),
          onDone: 'Active',
          onError: {
            target: 'ReleasingLease',
            actions: assign({
              lastSendRejection: ({ event }) =>
                event.error instanceof Error
                  ? event.error.message
                  : 'Codex refused to resume this Session.',
            }),
          },
        },
      },
      Active: {
        initial: 'Idle',
        states: {
          Idle: {
            on: {
              Notification: [
                {
                  guard: 'isTurnFailedForThread',
                  target: '#codexManagedSessionMachine.Failed',
                  actions: 'markTurnCompleted',
                },
                {
                  guard: 'isThreadSystemError',
                  target: '#codexManagedSessionMachine.Failed',
                },
              ],
              Send: {
                target: 'Running',
                actions: 'appendUserMessage',
              },
            },
          },
          Running: {
            invoke: {
              src: 'runTurn',
              input: ({ context, event }) => ({
                threadId: threadIdOf(context),
                prompt: event.type === 'Send' ? event.prompt : '',
              }),
              onDone: {
                actions: assign({
                  turnId: ({ event }) => event.output.turnId,
                  turns: ({ context, event }) => [
                    ...context.turns,
                    {
                      id: event.output.turnId,
                      status: 'running',
                      startedAt: deps.now().getTime(),
                      completedAt: null,
                    },
                  ],
                  lastSendOutcome: 'accepted',
                  sendSequence: ({ context }) => context.sendSequence + 1,
                }),
              },
              onError: [
                {
                  // The channel dropped before turn/start answered: we don't know whether Codex
                  // received it. 'Channel lost' (broadcast by the supervisor, task #9) carries the
                  // session the rest of the way into Recovering; this only records the outcome so
                  // the adapter's waiting execute() call can report 'uncertain' instead of hanging.
                  guard: ({ event }) => event.error instanceof CodexChannelClosedError,
                  target: '#codexManagedSessionMachine.Recovering',
                  actions: assign({
                    lastSendOutcome: 'uncertain',
                    lastSendRejection: null,
                    sendSequence: ({ context }) => context.sendSequence + 1,
                  }),
                },
                {
                  target: 'Idle',
                  actions: assign({
                    lastSendOutcome: 'rejected',
                    lastSendRejection: ({ event }) =>
                      event.error instanceof Error
                        ? event.error.message
                        : 'Codex rejected the send',
                    sendSequence: ({ context }) => context.sendSequence + 1,
                  }),
                },
              ],
            },
            on: {
              Steer: {
                guard: 'isOwnOpenTurn',
                target: 'Steering',
              },
              Interrupt: {
                guard: 'isOwnOpenTurn',
                target: 'Interrupting',
              },
              Notification: [
                {
                  guard: 'isTurnFailedForThread',
                  target: '#codexManagedSessionMachine.Failed',
                  actions: 'markTurnCompleted',
                },
                {
                  guard: 'isThreadSystemError',
                  target: '#codexManagedSessionMachine.Failed',
                },
                {
                  guard: 'isTurnCompletedForThread',
                  target: 'Idle',
                  actions: [
                    'markTurnCompleted',
                    'clearTurn',
                  ],
                },
                {
                  guard: 'isPermissionRequestedForThread',
                  target: 'AwaitingPermission',
                  actions: 'assignPendingApproval',
                },
                {
                  guard: 'isQuestionAskedForThread',
                  target: 'AwaitingQuestion',
                  actions: 'assignPendingQuestion',
                },
                {
                  guard: 'isRenamedForThread',
                  actions: 'assignTitle',
                },
                {
                  guard: 'hasMessageDeltaForThread',
                  actions: 'appendMessageDelta',
                },
                {
                  guard: 'hasToolCallUpdateForThread',
                  actions: 'updateToolCall',
                },
                {
                  guard: 'hasTokenUsageForThread',
                  actions: 'assignTokenUsage',
                },
              ],
            },
          },
          Steering: {
            invoke: {
              src: 'steerTurn',
              input: ({ context, event }) => ({
                threadId: threadIdOf(context),
                turnId: context.turnId ?? '',
                prompt: event.type === 'Steer' ? event.prompt : '',
              }),
              onDone: 'Running',
              onError: 'Running',
            },
          },
          Interrupting: {
            invoke: {
              src: 'interruptTurn',
              input: ({ context }) => ({
                threadId: threadIdOf(context),
                turnId: context.turnId ?? '',
              }),
              onDone: 'Running',
              onError: 'Running',
            },
          },
          AwaitingPermission: {
            on: {
              Decide: {
                target: 'Deciding',
              },
            },
          },
          Deciding: {
            invoke: {
              src: 'decideApproval',
              input: ({ context, event }) => ({
                permission: context.pendingApproval as PendingCodexPermission,
                decision: event.type === 'Decide' ? event.decision : 'reject',
              }),
              onDone: {
                target: 'Running',
                actions: 'clearPendingApproval',
              },
              onError: {
                target: 'Running',
                actions: 'clearPendingApproval',
              },
            },
          },
          AwaitingQuestion: {
            on: {
              Answer: {
                target: 'Answering',
              },
            },
          },
          Answering: {
            invoke: {
              src: 'answerQuestion',
              input: ({ context, event }) => ({
                question: context.pendingQuestion as PendingCodexQuestion,
                answer: event.type === 'Answer' ? event.answer : '',
              }),
              onDone: {
                target: 'Running',
                actions: 'clearPendingQuestion',
              },
              onError: {
                target: 'Running',
                actions: 'clearPendingQuestion',
              },
            },
          },
          Renaming: {
            invoke: {
              src: 'renameThread',
              input: ({ context, event }) => ({
                threadId: threadIdOf(context),
                title: event.type === 'Rename' ? event.title : '',
              }),
              onDone: 'Recall',
              onError: 'Recall',
            },
          },
          Compacting: {
            invoke: {
              src: 'compactThread',
              input: ({ context }) => ({
                threadId: threadIdOf(context),
              }),
              onDone: 'Recall',
              onError: 'Recall',
            },
            on: {
              Notification: {
                guard: 'isOwnOpenTurn',
                target: 'Recall',
              },
            },
          },
          Recall: {
            type: 'history',
            history: 'shallow',
          },
        },
        on: {
          Rename: '.Renaming',
          Compact: '.Compacting',
          Notification: [
            {
              guard: 'isThreadNotLoaded',
              target: 'ReleasingLease',
            },
            {
              guard: 'isThreadClosed',
              target: 'ReleasingLease',
            },
            {
              guard: 'isRenamedForThread',
              actions: 'assignTitle',
            },
            {
              guard: 'hasMessageDeltaForThread',
              actions: 'appendMessageDelta',
            },
            {
              guard: 'hasToolCallUpdateForThread',
              actions: 'updateToolCall',
            },
            {
              guard: 'hasTokenUsageForThread',
              actions: 'assignTokenUsage',
            },
          ],
          'Channel lost': 'Recovering',
          Close: 'Unsubscribing',
        },
      },
      Recovering: {
        after: {
          recoveryTimeout: 'ReleasingLease',
        },
        on: {
          // Targets Active's own history so a reconnect resumes the substate `Channel lost`
          // interrupted (e.g. Running with an open Turn), not a reset to Idle.
          'Channel restored': 'Active.Recall',
        },
      },
      ReleasingLease: {
        invoke: {
          src: 'releaseLease',
          input: ({ context }) => ({
            sessionId: context.sessionId as SessionIdentity,
          }),
          onDone: 'Watched',
          onError: 'Watched',
        },
      },
      Watched: {
        type: 'final',
      },
      Closing: {
        invoke: {
          src: 'releaseLease',
          input: ({ context }) => ({
            sessionId: context.sessionId as SessionIdentity,
          }),
          onDone: 'Closed',
          onError: 'Closed',
        },
      },
      Unsubscribing: {
        invoke: {
          src: 'unsubscribeThread',
          input: ({ context }) => ({
            threadId: threadIdOf(context),
          }),
          onDone: 'Closing',
          onError: 'Closing',
        },
      },
      Closed: {
        type: 'final',
      },
      Failed: {
        type: 'final',
      },
    },
  })
}
