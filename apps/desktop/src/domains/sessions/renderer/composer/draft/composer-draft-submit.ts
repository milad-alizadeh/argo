import { isTRPCClientError } from '@trpc/client'
import { useCallback } from 'react'
import {
  type SessionSubmitRejection,
  sessionSubmitRejectionSchema,
} from '@/domains/sessions/api/session-submit-rejection'
import type { AppRouter } from '@/platform/main/trpc-router'
import type { RouterInputs, RouterOutputs } from '@/platform/renderer/trpc-client'
import type { ComposerEditing } from '../editing/composer-editing'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

type DraftContent = RouterInputs['composerDraftCreate']['content']

type PersistedDraft = {
  id: string
  revision: number
  owner: string
  fingerprint: string
}
// A rejection names its reason when main knows why the Turn never reached the Harness.
export type DraftSubmitFailure =
  | { outcome: 'rejected'; reason: SessionSubmitRejection | null }
  | { outcome: 'uncertain' }
export const PLAIN_REJECTION = { outcome: 'rejected', reason: null } satisfies DraftSubmitFailure
type DraftSubmission = {
  prompt: string
  turnConfiguration: TurnConfiguration | null
  attachments: DraftContent['attachments']
  // Told the saved revision before main is asked to send it.
  onSaved?: (saved: PersistedDraft) => void
}
type DraftSubmitResult =
  | { outcome: 'accepted'; sessionId: string; worktreeGone: string | null }
  | DraftSubmitFailure
// A debounced autosave, kept with its save so a page hide can send it at once.
export type PendingSave = { timer: number; save: () => void }
export type ComposerDraftActionInput = {
  persist: (content: DraftContent) => Promise<PersistedDraft>
  persisted: React.RefObject<Map<string, PersistedDraft>>
  latestEditing: React.RefObject<ComposerEditing | null>
  pendingSaves: React.RefObject<Map<string, PendingSave>>
  owner: string | null
  setSaveFailureOwner: React.Dispatch<React.SetStateAction<string | null>>
  suppressNextEmptyAutosave: React.RefObject<string | null>
}
type ComposerDraftSubmitInput = ComposerDraftActionInput & {
  setSendFailure: React.Dispatch<
    React.SetStateAction<{ owner: string; outcome: 'rejected' | 'uncertain' } | null>
  >
  submit: (input: RouterInputs['sessionSubmit']) => Promise<RouterOutputs['sessionSubmit']>
  clearAcceptedDraft: (saved: PersistedDraft) => void
}
type PersistInput = {
  persist: ComposerDraftSubmitInput['persist']
  editing: ComposerEditing
  prompt: string
  attachments: DraftContent['attachments']
  turnConfiguration: TurnConfiguration
  owner: string
  setSaveFailureOwner: ComposerDraftSubmitInput['setSaveFailureOwner']
}

export function useComposerDraftSubmit(input: ComposerDraftSubmitInput) {
  const {
    persist,
    persisted,
    latestEditing,
    pendingSaves,
    owner,
    setSaveFailureOwner,
    setSendFailure,
    suppressNextEmptyAutosave,
    submit,
    clearAcceptedDraft,
  } = input
  return useCallback(
    (submission: DraftSubmission) =>
      submitDraft({
        input: {
          persist,
          persisted,
          latestEditing,
          pendingSaves,
          owner,
          setSaveFailureOwner,
          setSendFailure,
          suppressNextEmptyAutosave,
          submit,
          clearAcceptedDraft,
        },
        ...submission,
      }),
    [
      clearAcceptedDraft,
      latestEditing,
      owner,
      persist,
      persisted,
      pendingSaves,
      setSaveFailureOwner,
      setSendFailure,
      suppressNextEmptyAutosave,
      submit,
    ],
  )
}

async function submitDraft({
  input,
  prompt,
  turnConfiguration,
  attachments,
  onSaved,
}: DraftSubmission & { input: ComposerDraftSubmitInput }) {
  const editing = input.latestEditing.current
  if (editing === null || turnConfiguration === null || input.owner === null) return PLAIN_REJECTION
  cancelPendingSave(input.pendingSaves, input.owner)
  input.setSendFailure((failure) => (failure?.owner === input.owner ? null : failure))
  const saved = await persistDraft({
    persist: input.persist,
    editing,
    prompt,
    attachments,
    turnConfiguration,
    owner: input.owner,
    setSaveFailureOwner: input.setSaveFailureOwner,
  })
  if (saved === null) return PLAIN_REJECTION
  onSaved?.(saved)
  return sendPersistedDraft({
    saved,
    editing,
    latestEditing: input.latestEditing,
    submit: input.submit,
    owner: input.owner,
    setSendFailure: input.setSendFailure,
    suppressNextEmptyAutosave: input.suppressNextEmptyAutosave,
    persisted: input.persisted,
    clearAcceptedDraft: input.clearAcceptedDraft,
  })
}

export function cancelPendingSave(
  pendingSaves: React.RefObject<Map<string, PendingSave>>,
  owner: string,
) {
  const pending = pendingSaves.current.get(owner)
  if (pending === undefined) return
  window.clearTimeout(pending.timer)
  pendingSaves.current.delete(owner)
}

async function persistDraft(input: PersistInput) {
  try {
    const saved = await input.persist({
      prompt: input.prompt,
      attachments: input.attachments,
      ticketContext: input.editing.tickets,
      turnConfiguration: input.turnConfiguration,
    })
    input.setSaveFailureOwner((failedOwner) => (failedOwner === input.owner ? null : failedOwner))
    return saved
  } catch {
    input.setSaveFailureOwner(input.owner)
    return null
  }
}

async function sendPersistedDraft(input: {
  saved: PersistedDraft
  editing: ComposerEditing
  latestEditing: React.RefObject<ComposerEditing | null>
  submit: ComposerDraftSubmitInput['submit']
  owner: string
  setSendFailure: ComposerDraftSubmitInput['setSendFailure']
  suppressNextEmptyAutosave: React.RefObject<string | null>
  persisted: React.RefObject<Map<string, PersistedDraft>>
  clearAcceptedDraft: ComposerDraftSubmitInput['clearAcceptedDraft']
}) {
  try {
    const result = await submitSavedDraft(input.saved, input.submit)
    if (input.latestEditing.current === input.editing)
      input.suppressNextEmptyAutosave.current = input.owner
    if (
      input.persisted.current.get(input.owner)?.id === input.saved.id &&
      input.persisted.current.get(input.owner)?.revision === input.saved.revision
    )
      input.persisted.current.delete(input.owner)
    input.clearAcceptedDraft(input.saved)
    input.setSendFailure((failure) => (failure?.owner === input.owner ? null : failure))
    return {
      outcome: 'accepted',
      sessionId: result.sessionId,
      worktreeGone: result.worktreeGone,
    } satisfies DraftSubmitResult
  } catch (error) {
    const failure = submitFailure(error)
    input.setSendFailure({ owner: input.owner, outcome: failure.outcome })
    return failure
  }
}

function submitFailure(error: unknown): DraftSubmitFailure {
  if (!isTRPCClientError<AppRouter>(error)) return { outcome: 'uncertain' }
  const code = error.data?.code
  if (code !== 'BAD_REQUEST' && code !== 'NOT_FOUND' && code !== 'PRECONDITION_FAILED')
    return { outcome: 'uncertain' }
  // Any other message keeps the plain rejection text.
  const reason = sessionSubmitRejectionSchema.safeParse(error.message)
  return { outcome: 'rejected', reason: reason.success ? reason.data : null }
}

function submitSavedDraft(saved: PersistedDraft, submit: ComposerDraftSubmitInput['submit']) {
  return submit({
    draftId: saved.id,
    expectedRevision: saved.revision,
    commandId: crypto.randomUUID(),
  })
}
