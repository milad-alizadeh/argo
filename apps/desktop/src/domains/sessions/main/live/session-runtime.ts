import { createActor, fromPromise, waitFor } from 'xstate'
import type { AvailableHarness } from '@/harnesses/catalog/harness-catalog-machine'
import { claudeSessionMachine } from '@/harnesses/claude/session/claude-session-machine'
import type { CodexRequest } from '@/harnesses/codex/app-server/codex-app-server-machine'
import {
  codexSessionActors,
  codexSessionMachine,
} from '@/harnesses/codex/session/codex-session-machine'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'
import type { SessionSendInput, SessionStartInput } from '../../contract/session-start'
import { createSessionUpsert } from '../storage/session-upsert'
import { type SessionDrainInput, sessionMachine } from './session-machine'

function validSetup(catalog: AvailableHarness, input: Pick<SessionStartInput, 'setup'>) {
  const model = catalog.models.find((candidate) => candidate.value === input.setup.model)
  return (
    model?.efforts.includes(input.setup.effort) &&
    catalog.modes.some((mode) => mode.value === input.setup.mode)
  )
}

type VendorSession = {
  nativeId: () => Promise<string>
  send: (command: Pick<SessionSendInput, 'attachments' | 'prompt' | 'setup'>) => Promise<void>
  stop: () => void
}

function waitForVendor(
  actor: ReturnType<typeof createActor>,
  startFailure: string,
  sendFailure: string,
): VendorSession {
  return {
    async nativeId() {
      const snapshot = await waitFor(
        actor,
        (candidate) => candidate.hasTag('ready') || candidate.matches('Failed'),
      )
      if (snapshot.matches('Failed') || snapshot.context.nativeId === null)
        throw new Error(snapshot.context.failure ?? startFailure)
      return snapshot.context.nativeId
    },
    async send(command) {
      actor.send({ type: 'Send', command })
      const snapshot = await waitFor(
        actor,
        (candidate) => candidate.hasTag('ready') || candidate.matches('Failed'),
      )
      if (snapshot.matches('Failed')) throw new Error(snapshot.context.failure ?? sendFailure)
    },
    stop: () => actor.stop(),
  }
}

function createVendorSession(start: SessionStartInput, codexRequest: CodexRequest): VendorSession {
  switch (start.harness) {
    case 'claude':
      return waitForVendor(
        createActor(claudeSessionMachine, { input: start }).start(),
        'Claude Session start failed.',
        'Claude Session send failed.',
      )
    case 'codex':
      return waitForVendor(
        createActor(codexSessionMachine.provide({ actors: codexSessionActors(codexRequest) }), {
          input: start,
        }).start(),
        'Codex Session start failed.',
        'Codex Session send failed.',
      )
  }
}

function createLiveSession(
  start: SessionStartInput,
  upsert: ReturnType<typeof createSessionUpsert>,
  codexRequest: CodexRequest,
) {
  const vendor = createVendorSession(start, codexRequest)
  const machine = sessionMachine.provide({
    actors: {
      start: fromPromise(() => vendor.nativeId().then((nativeId) => ({ nativeId }))),
      persist: fromPromise(({ input: record }) => {
        if (record.nativeId === null) throw new Error('Session has no native ID to persist.')
        return Promise.resolve(upsert({ ...record, nativeId: record.nativeId }))
      }),
      drain: fromPromise(({ input: delivery }: { input: SessionDrainInput }) => {
        if (delivery.command === null) return Promise.resolve()
        if (delivery.nativeId === null) throw new Error('Session has no native ID to send.')
        return vendor.send(delivery.command)
      }),
    },
  })
  return { actor: createActor(machine, { input: start }).start(), stopVendor: vendor.stop }
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
  return {
    async start(start: SessionStartInput) {
      const catalog = input.catalog(start.harness)
      if (catalog === null || !validSetup(catalog, start))
        throw new Error('The selected Session setup is no longer available.')
      const existing = starts.get(start.commandId)
      if (existing !== undefined) return existing
      const session = createLiveSession(start, upsert, input.codexRequest)
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
      const snapshot = session.actor.getSnapshot()
      if (snapshot.matches('Failed') || snapshot.matches('Closed'))
        throw new Error(snapshot.context.failure ?? 'Session is not available for sends.')
      const catalog = input.catalog(snapshot.context.first.harness)
      if (catalog === null || !validSetup(catalog, command))
        throw new Error('The selected Session setup is no longer available.')
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
