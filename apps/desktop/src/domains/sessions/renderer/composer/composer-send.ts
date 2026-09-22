import type { useQueryClient } from '@tanstack/react-query'
import type { NavigateFunction } from 'react-router'
import type { Cockpit } from '@/domains/projects/renderer/port'
import {
  type ComposerIdentity,
  composerIdentityKey,
} from '@/domains/sessions/renderer/composer/composer-identity'
import { sendToDraftIdentity } from '@/domains/sessions/renderer/composer/send-draft-turn'
import { sendToSessionIdentity } from '@/domains/sessions/renderer/composer/send-turn'
import type { useTurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/use-turn-setup'
import type { ComposerState } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { Send } from '@/domains/sessions/renderer/composer/use-send'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import type { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import type { TurnMarkerApi } from '@/domains/sessions/renderer/composer/use-turn-marker'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'

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
