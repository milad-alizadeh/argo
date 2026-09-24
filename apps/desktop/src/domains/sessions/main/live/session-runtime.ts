import { createActor, fromPromise, waitFor } from 'xstate'
import type { AvailableHarness } from '@/harnesses/catalog/harness-catalog-machine'
import { type CodexRequest } from '@/harnesses/codex/app-server/codex-app-server-machine'
import { createClaudeSessionMachine } from '@/harnesses/claude/session/claude-session-machine'
import { createCodexSessionMachine } from '@/harnesses/codex/session/codex-session-machine'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import type { SessionSendInput, SessionStartInput } from '../../contract/session-start'
import { createSessionUpsert } from '../storage/session-upsert'
import { type SessionDrainInput, sessionMachine } from './session-machine'

function validSetup(catalog: AvailableHarness, input: Pick<SessionStartInput, 'setup'>) {
  const model = catalog.models.find((candidate) => candidate.value === input.setup.model)
  return (
    model !== undefined &&
    model.efforts.includes(input.setup.effort) &&
    catalog.modes.some((mode) => mode.value === input.setup.mode)
  )
}

export function createSessionRuntime(input: {
  database: DurableDatabase
  codexRequest: CodexRequest
  catalog: (harness: SessionStartInput['harness']) => AvailableHarness | null
}) {
  const actors = new Map<
    string,
    {
      actor: ReturnType<typeof createActor<typeof sessionMachine>>
      stopVendor: () => void
    }
  >()
  const starts = new Map<string, Promise<{ sessionId: string }>>()
  const upsert = createSessionUpsert(input.database)
  const create = (start: SessionStartInput) => {
    let stopVendor = () => {}
    let sendVendor:
      | ((command: Pick<SessionSendInput, 'attachments' | 'prompt' | 'setup'>) => Promise<void>)
      | null = null
    const machine = sessionMachine.provide({
      actors: {
        start: fromPromise(async ({ input: command }: { input: SessionStartInput }) => {
          if (command.harness === 'claude') {
            const claude = createActor(createClaudeSessionMachine(), { input: command }).start()
            stopVendor = () => claude.stop()
            sendVendor = async (next) => {
              claude.send({ type: 'Send', command: next })
              const sent = await waitFor(
                claude,
                (candidate) => candidate.matches('Ready') || candidate.matches('Failed'),
              )
              if (sent.matches('Failed'))
                throw new Error(sent.context.failure ?? 'Claude Session send failed.')
            }
            const snapshot = await waitFor(
              claude,
              (candidate) => candidate.matches('Ready') || candidate.matches('Failed'),
            )
            if (snapshot.matches('Failed') || snapshot.context.nativeId === null)
              throw new Error(snapshot.context.failure ?? 'Claude Session start failed.')
            return { nativeId: snapshot.context.nativeId }
          }
          const codex = createActor(createCodexSessionMachine(input.codexRequest), {
            input: command,
          }).start()
          stopVendor = () => codex.stop()
          sendVendor = async (next) => {
            codex.send({ type: 'Send', command: next })
            const sent = await waitFor(
              codex,
              (candidate) => candidate.matches('Ready') || candidate.matches('Failed'),
            )
            if (sent.matches('Failed'))
              throw new Error(sent.context.failure ?? 'Codex Session send failed.')
          }
          const snapshot = await waitFor(
            codex,
            (candidate) => candidate.matches('Ready') || candidate.matches('Failed'),
          )
          if (snapshot.matches('Failed') || snapshot.context.nativeId === null)
            throw new Error(snapshot.context.failure ?? 'Codex Session start failed.')
          return { nativeId: snapshot.context.nativeId }
        }),
        persist: fromPromise(
          ({
            input: record,
          }: {
            input: { harness: string; nativeId: string | null; firstPrompt: string }
          }) => {
            if (record.nativeId === null) throw new Error('Session has no native ID to persist.')
            return Promise.resolve(upsert({ ...record, nativeId: record.nativeId }))
          },
        ),
        drain: fromPromise(({ input: delivery }: { input: SessionDrainInput }) => {
          if (delivery.command === null) return Promise.resolve()
          if (delivery.nativeId === null) throw new Error('Session has no native ID to send.')
          if (sendVendor === null) throw new Error('Session vendor was not retained.')
          return sendVendor(delivery.command)
        }),
      },
    })
    return {
      actor: createActor(machine, { input: start }).start(),
      stopVendor: () => stopVendor(),
    }
  }
  return {
    async start(start: SessionStartInput) {
      const catalog = input.catalog(start.harness)
      if (catalog === null || !validSetup(catalog, start))
        throw new Error('The selected Session setup is no longer available.')
      const existing = starts.get(start.commandId)
      if (existing !== undefined) return existing
      const session = create(start)
      const result = waitFor(
        session.actor,
        (snapshot) => snapshot.matches('Ready') || snapshot.matches('Failed'),
      ).then((snapshot) => {
        if (snapshot.matches('Failed'))
          throw new Error(snapshot.context.failure ?? 'Session start failed.')
        const sessionId = snapshot.context.argoId
        if (sessionId === null) throw new Error('Session identity did not persist.')
        actors.set(sessionId, session)
        return { sessionId }
      })
      starts.set(start.commandId, result)
      return result
    },
    async send(command: SessionSendInput) {
      const session = actors.get(command.sessionId)
      if (session === undefined) throw new Error('Session is not live.')
      session.actor.send({ type: 'Send', command })
      return { sessionId: command.sessionId }
    },
    async submit(command: SessionStartInput & { sessionId: string | null }) {
      if (command.sessionId === null) return this.start(command)
      return this.send({ ...command, sessionId: command.sessionId })
    },
    stop() {
      for (const session of actors.values()) {
        session.actor.stop()
        session.stopVendor()
      }
    },
  }
}

export type SessionRuntime = ReturnType<typeof createSessionRuntime>
