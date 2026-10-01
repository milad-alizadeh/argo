import { isTRPCClientError } from '@trpc/client'
import { useCallback } from 'react'
import type { AppRouter } from '@/platform/main/trpc-router'
import type { RouterInputs } from '@/platform/renderer/trpc-client'
import type { ComposerEditing } from '../editing/composer-editing'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

type DraftContent = RouterInputs['composerDraftCreate']['content']

type PersistedDraft = {
  id: string
  revision: number
  owner: string
  fingerprint: string
}
type DraftSubmission = {
  prompt: string
  turnConfiguration: TurnConfiguration | null
  attachments: DraftContent['attachments']
  // Told the saved revision before main is asked to send it.
  onSaved?: (saved: PersistedDraft) => void
}
type DraftSubmitResult =
  | { outcome: 'accepted'; sessionId: string }
  | { outcome: 'rejected' | 'uncertain' }
export type ComposerDraftActionInput = {
  persist: (content: DraftContent) => Promise<PersistedDraft>
  persisted: React.RefObject<Map<string, PersistedDraft>>
  latestEditing: React.RefObject<ComposerEditing | null>
  saveTimer: React.RefObject<Map<string, number>>
  owner: string | null
  setSaveFailureOwner: React.Dispatch<React.SetStateAction<string | null>>
  suppressNextEmptyAutosave: React.RefObject<string | null>
}
type ComposerDraftSubmitInput = ComposerDraftActionInput & {
  setSendFailure: React.Dispatch<
    React.SetStateAction<{ owner: string; outcome: 'rejected' | 'uncertain' } | null>
  >
  submit: (input: RouterInputs['sessionSubmit']) => Promise<{ sessionId: string }>
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
    saveTimer,
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
          saveTimer,
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
      saveTimer,
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
  if (editing === null || turnConfiguration === null || input.owner === null)
    return { outcome: 'rejected' as const }
  cancelSaveTimer(input.saveTimer, input.owner)
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
  if (saved === null) return { outcome: 'rejected' as const }
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

function cancelSaveTimer(saveTimer: React.RefObject<Map<string, number>>, owner: string) {
  const timer = saveTimer.current.get(owner)
  if (timer === undefined) return
  window.clearTimeout(timer)
  saveTimer.current.delete(owner)
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
    return { outcome: 'accepted', sessionId: result.sessionId } satisfies DraftSubmitResult
  } catch (error) {
    const outcome = definiteRejection(error) ? 'rejected' : 'uncertain'
    input.setSendFailure({ owner: input.owner, outcome })
    return { outcome } satisfies DraftSubmitResult
  }
}

function definiteRejection(error: unknown): boolean {
  if (!isTRPCClientError<AppRouter>(error)) return false
  return (
    error.data?.code === 'BAD_REQUEST' ||
    error.data?.code === 'NOT_FOUND' ||
    error.data?.code === 'PRECONDITION_FAILED'
  )
}

function submitSavedDraft(saved: PersistedDraft, submit: ComposerDraftSubmitInput['submit']) {
  return submit({
    draftId: saved.id,
    expectedRevision: saved.revision,
    commandId: crypto.randomUUID(),
  })
}
