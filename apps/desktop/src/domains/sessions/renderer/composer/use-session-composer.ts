import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { NavigateFunction } from 'react-router'
import type { Cockpit, ProjectActions } from '@/domains/projects/renderer/port'
import type { SessionErrorCode } from '@/domains/sessions/contract/ipc/contract'
import { composerIdentityKey } from '@/domains/sessions/renderer/composer/composer-identity'
import { composerSend } from '@/domains/sessions/renderer/composer/composer-send'
import type { SessionComposerProps } from '@/domains/sessions/renderer/composer/session-composer'
import {
  managedSessionIsRunning,
  useComposerActions,
} from '@/domains/sessions/renderer/composer/use-composer-actions'
import { useComposerFacts } from '@/domains/sessions/renderer/composer/use-composer-facts'
import { useComposerStore } from '@/domains/sessions/renderer/composer/use-composer-store'
import type { Failure } from '@/domains/sessions/renderer/composer/use-session-composer-actions'
import { useSessionMutations } from '@/domains/sessions/renderer/composer/use-session-mutations'
import type { TurnMarkerView } from '@/domains/sessions/renderer/feed/rows/turn-marker-state'
import type { SessionHarness } from '@/domains/sessions/renderer/harness/harnesses'
import type { SessionFeedRow } from '@/domains/sessions/renderer/types'
import type { useSessions } from '@/domains/sessions/renderer/use-sessions'

type SessionComposerOptions = {
  harness: SessionHarness
  cockpit: Cockpit
  projectActions: Pick<ProjectActions, 'selectWorkspace' | 'createManagedWorkspace'>
  focusOnMount: boolean
  navigate: NavigateFunction
  roster: ReturnType<typeof useSessions>['roster']
  selectedSessionId: string | null
}

type ComposerResult = {
  failure: { message: string; code: SessionErrorCode | null } | null
  retry: () => void
  props: Omit<SessionComposerProps, 'plan' | 'harness'>
  markerView: TurnMarkerView | null
  optimisticRow: SessionFeedRow | null
  settledPromptRow: SessionFeedRow | null
}

function useSendFor(options: {
  base: Pick<SessionComposerOptions, 'harness' | 'cockpit' | 'navigate' | 'roster'>
  facts: ReturnType<typeof useComposerFacts>
  mutations: ReturnType<typeof useSessionMutations>
  composerActions: ReturnType<typeof useComposerStore.getState>
  setFailure: (failure: Failure | null) => void
}) {
  const { base, facts, mutations, composerActions, setFailure } = options
  const { harness, cockpit, navigate, roster } = base
  return composerSend({
    harness,
    cockpit,
    identity: facts.identity,
    marker: facts.marker,
    navigate,
    queryClient: useQueryClient(),
    roster,
    send: mutations.send,
    setDraft: composerActions.setDraft,
    removeAttachmentPaths: composerActions.removeAttachmentPaths,
    rekey: composerActions.rekey,
    setFailure,
    start: mutations.start,
    watchTurn: facts.watchTurn,
  })
}

export function useSessionComposer(options: SessionComposerOptions): ComposerResult {
  const { harness, cockpit, projectActions, focusOnMount, navigate, roster, selectedSessionId } =
    options
  const [failure, setFailure] = useState<Failure | null>(null)
  const queryClient = useQueryClient()
  const mutations = useSessionMutations()
  const composerActions = useComposerStore.getState()
  const facts = useComposerFacts(
    { harness, cockpit, projectActions, roster, selectedSessionId },
    setFailure,
  )
  const { identity, sessionId, control, workspace, selectedRow, isCompacting } = facts
  const { isHandingOff, onCompact, onHandoff, onInterrupt, onSteer, ...marks } = useComposerActions(
    {
      harness,
      identity,
      mutations,
      marker: facts.marker,
      roster,
      sessionId,
      selectedRow,
      setFailure,
      queryClient,
    },
  )
  const onSend = useSendFor({
    base: { harness, cockpit, navigate, roster },
    facts,
    mutations,
    composerActions,
    setFailure,
  })
  return {
    failure:
      failure?.sessionId === sessionId ? { message: failure.message, code: failure.code } : null,
    retry: () => setFailure(null),
    ...marks,
    props: {
      focusOnMount,
      isCompacting,
      isHandingOff,
      isRunning: managedSessionIsRunning(roster, sessionId),
      onCompact,
      onHandoff,
      onInterrupt,
      onSteer,
      onSend,
      sessionId: composerIdentityKey(identity),
      setup: control,
      workspace,
    },
  }
}
