import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import type { useTurnSetup } from '@/domains/sessions/renderer/turn-setup/use-turn-setup'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'
import { type ComposerIdentity, composerIdentityKey } from './composer-identity'
import { sendToDraftIdentity } from './send-draft-turn'
import { sendToSessionIdentity } from './send-turn'
import type { ComposerState } from './use-composer-store'
import type { Send } from './use-send'
import type { Failure } from './use-session-composer-actions'
import type { useSessionMutations } from './use-session-mutations'
import type { TurnMarkerApi } from './use-turn-marker'

type ComposerSendOptions = {
  harness: SessionHarness
  cockpit: Cockpit
  identity: ComposerIdentity
  marker: TurnMarkerApi
  navigate: NavigateFunction
  queryClient: ReturnType<typeof useQueryClient>
  roster: ReturnType<typeof useSessions>['roster']
  send: ReturnType<typeof useSessionMutations>['send']
  setDraft: ComposerState['setDraft']
  removeAttachmentPaths: ComposerState['removeAttachmentPaths']
  rekey: ComposerState['rekey']
  setFailure: (failure: Failure | null) => void
  start: ReturnType<typeof useSessionMutations>['start']
  watchTurn: ReturnType<typeof useTurnSetup>['watchTurn']
}

function sendManagedSession(harness: SessionHarness, sessionId: string, prompt: string) {
  return window.argo.executeManagedSessionCommand({
    type: 'session.send',
    session: { harness, nativeId: sessionId },
    prompt,
  })
}

export function composerSend(options: ComposerSendOptions): Send {
  const {
    harness,
    cockpit,
    identity,
    marker,
    navigate,
    queryClient,
    roster,
    send,
    setDraft,
    removeAttachmentPaths,
    rekey,
    setFailure,
    start,
    watchTurn,
  } = options
  return async (prompt, setup, attachments) => {
    const turn = { prompt, setup, attachments }
    return identity.kind === 'session'
      ? sendToSessionIdentity(
          {
            queryClient,
            roster,
            marker,
            send,
            sendManagedSession,
            setFailure,
            watchTurn,
          },
          identity.sessionId,
          turn,
        )
      : sendToDraftIdentity(
          {
            harness,
            cockpit,
            marker,
            navigate,
            onStarted: (sessionId) => {
              rekey(composerIdentityKey(identity), sessionId)
              setDraft(sessionId, '')
              removeAttachmentPaths(
                sessionId,
                attachments.map((attachment) => attachment.path),
              )
            },
            queryClient,
            send,
            setFailure,
            start,
            watchTurn,
          },
          identity,
          turn,
        )
  }
}
