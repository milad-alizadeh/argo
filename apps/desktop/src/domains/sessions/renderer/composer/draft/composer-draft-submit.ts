import { useCallback } from 'react'
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
  setSendFailureOwner: React.Dispatch<React.SetStateAction<string | null>>
  submit: (input: RouterInputs['sessionSubmit']) => Promise<{ sessionId: string }>
  clearAcceptedDraft: () => void
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
    setSendFailureOwner,
    suppressNextEmptyAutosave,
    submit,
    clearAcceptedDraft,
  } = input
  return useCallback(
    (
      prompt: string,
      turnConfiguration: TurnConfiguration | null,
      attachments: DraftContent['attachments'],
    ) =>
      submitDraft({
        input: {
          persist,
          persisted,
          latestEditing,
          saveTimer,
          owner,
          setSaveFailureOwner,
          setSendFailureOwner,
          suppressNextEmptyAutosave,
          submit,
          clearAcceptedDraft,
        },
        prompt,
        turnConfiguration,
        attachments,
      }),
    [
      clearAcceptedDraft,
      latestEditing,
      owner,
      persist,
      persisted,
      saveTimer,
      setSaveFailureOwner,
      setSendFailureOwner,
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
}: {
  input: ComposerDraftSubmitInput
  prompt: string
  turnConfiguration: TurnConfiguration | null
  attachments: DraftContent['attachments']
}) {
  const editing = input.latestEditing.current
  if (editing === null || turnConfiguration === null || input.owner === null) return null
  cancelSaveTimer(input.saveTimer, input.owner)
  input.setSendFailureOwner((failedOwner) => (failedOwner === input.owner ? null : failedOwner))
  const saved = await persistDraft({
    persist: input.persist,
    editing,
    prompt,
    attachments,
    turnConfiguration,
    owner: input.owner,
    setSaveFailureOwner: input.setSaveFailureOwner,
  })
  return saved === null
    ? null
    : sendPersistedDraft({
        saved,
        submit: input.submit,
        owner: input.owner,
        setSendFailureOwner: input.setSendFailureOwner,
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
  submit: ComposerDraftSubmitInput['submit']
  owner: string
  setSendFailureOwner: ComposerDraftSubmitInput['setSendFailureOwner']
  suppressNextEmptyAutosave: React.RefObject<string | null>
  persisted: React.RefObject<Map<string, PersistedDraft>>
  clearAcceptedDraft: () => void
}) {
  try {
    const result = await submitSavedDraft(input.saved, input.submit)
    input.suppressNextEmptyAutosave.current = input.owner
    if (input.persisted.current.get(input.owner)?.id === input.saved.id)
      input.persisted.current.delete(input.owner)
    input.clearAcceptedDraft()
    input.setSendFailureOwner((failedOwner) => (failedOwner === input.owner ? null : failedOwner))
    return result.sessionId
  } catch {
    input.setSendFailureOwner(input.owner)
    return null
  }
}

function submitSavedDraft(saved: PersistedDraft, submit: ComposerDraftSubmitInput['submit']) {
  return submit({
    draftId: saved.id,
    expectedRevision: saved.revision,
    commandId: crypto.randomUUID(),
  })
}
