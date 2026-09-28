import { useQueryClient } from '@tanstack/react-query'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { attachmentKindOf } from '@/domains/sessions/api/attachments'
import type { RouterInputs, RouterOutputs } from '@/platform/renderer/trpc-client'
import type { ComposerEditing } from '../editing/composer-editing'
import {
  supportedConfiguration,
  type TurnConfiguration,
  type TurnConfigurationChoices,
} from '../turn-configuration/turn-configuration'
import { cachedComposerDraft } from './composer-draft-cache'

// A stored draft value becomes the editing the composer draws, and the record the autosave compares.

export type DraftTarget = RouterInputs['composerDraftCreate']['target']
export type DraftContent = RouterInputs['composerDraftCreate']['content']
export type DraftValue = RouterOutputs['composerDraftCreate']
export type PersistedDraft = {
  id: string
  revision: number
  owner: string
  fingerprint: string
}
export type LoadedDraft = { owner: string; editing: ComposerEditing; target: DraftTarget }
export type ComposerDraftRecord = {
  persisted: React.RefObject<Map<string, PersistedDraft>>
  latestEditing: React.RefObject<ComposerEditing | null>
  setLoaded: React.Dispatch<React.SetStateAction<LoadedDraft | null>>
  initialFingerprints: React.RefObject<Map<string, string>>
  remember: (owner: string, draft: DraftValue) => void
}

export function contentFromEditing(editing: ComposerEditing): DraftContent | null {
  if (editing.turnConfiguration === null) return null
  return {
    prompt: editing.prompt,
    attachments: editing.attachments.map(({ path }) => ({ path, kind: attachmentKindOf(path) })),
    ticketContext: editing.tickets,
    turnConfiguration: editing.turnConfiguration,
  }
}

function editingFromDraft(
  draft: DraftValue,
  choices: TurnConfigurationChoices,
  fallback: TurnConfiguration,
): ComposerEditing {
  return {
    prompt: draft.prompt,
    attachments: draft.attachments.map(({ path }, index) => ({
      id: `${draft.id}:${index}`,
      path,
      status: 'idle',
    })),
    tickets: draft.ticketContext,
    turnConfiguration: supportedConfiguration(choices, draft.turnConfiguration, fallback),
  }
}

export function loadedDraft(input: {
  owner: string
  draft: DraftValue
  choices: TurnConfigurationChoices
  opening: TurnConfiguration
}): LoadedDraft {
  const { owner, draft, choices, opening } = input
  return { owner, editing: editingFromDraft(draft, choices, opening), target: draft.target }
}

export function fingerprint(target: DraftTarget, content: DraftContent) {
  return JSON.stringify({ target, content })
}

export function adoptComposerDraft(
  input: ComposerDraftRecord,
  loaded: LoadedDraft,
  draft: DraftValue,
) {
  const content = contentFromEditing(loaded.editing)
  if (content === null) return
  const storedContent: DraftContent = {
    prompt: draft.prompt,
    attachments: draft.attachments,
    ticketContext: draft.ticketContext,
    turnConfiguration: draft.turnConfiguration,
  }
  input.persisted.current.set(loaded.owner, {
    id: draft.id,
    revision: draft.revision,
    owner: loaded.owner,
    fingerprint: fingerprint(draft.target, storedContent),
  })
  input.initialFingerprints.current.set(loaded.owner, fingerprint(draft.target, content))
  input.latestEditing.current = loaded.editing
  input.remember(loaded.owner, draft)
  input.setLoaded(loaded)
}

// An owner the renderer has read or saved before starts from that draft in its first render, so a
// revisit never waits on a read.
export function useCachedComposerDraft(
  input: ComposerDraftRecord & {
    owner: string | null
    choices: TurnConfigurationChoices | null
    opening: TurnConfiguration | null
    targetRestored: boolean
  },
  loadedOwner: string | null,
) {
  const queryClient = useQueryClient()
  const { owner, choices, opening } = input
  const draft =
    owner === null || owner === loadedOwner || !input.targetRestored
      ? undefined
      : cachedComposerDraft(queryClient, owner)
  const cached = useMemo(
    () =>
      draft === undefined || owner === null || choices === null || opening === null
        ? undefined
        : { loaded: loadedDraft({ owner, draft, choices, opening }), draft },
    [draft, owner, choices, opening],
  )
  const adopt = useRef(input)
  adopt.current = input
  // A layout effect, so the draft is adopted before the editor reports its first edit.
  useLayoutEffect(() => {
    if (cached !== undefined) adoptComposerDraft(adopt.current, cached.loaded, cached.draft)
  }, [cached])
  return cached?.loaded
}
