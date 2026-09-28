import type { LexicalEditor } from 'lexical'
import { type RefObject, useCallback } from 'react'

import type { SessionAttachmentInput } from '@/domains/sessions/api/attachments'
import type { ComposerAttachment, ComposerEditing } from '../editing/composer-editing'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'
import { resolveAttachments } from './use-composer-attachments'

export type SendOutcome = 'accepted' | 'rejected' | 'uncertain'
export type Send = (
  text: string,
  turnConfiguration: TurnConfiguration | null,
  attachments: SessionAttachmentInput[],
) => Promise<SendOutcome | boolean>

function outcomeFor(result: SendOutcome | boolean): SendOutcome {
  if (result === true) return 'accepted'
  if (result === false) return 'rejected'
  return result
}

export function sameDraftContent(start: ComposerEditing, current: ComposerEditing): boolean {
  return (
    start.prompt === current.prompt &&
    start.tickets === current.tickets &&
    start.turnConfiguration === current.turnConfiguration &&
    start.attachments.length === current.attachments.length &&
    start.attachments.every(
      (attachment, index) =>
        attachment.id === current.attachments[index]?.id &&
        attachment.path === current.attachments[index]?.path,
    )
  )
}

// Resolve attachments, send through the durable command, and clear only after main accepts it.
export async function performSend(input: {
  draft: string
  attachments: ComposerAttachment[]
  markError: (ids: string[]) => void
  editor: LexicalEditor | null
  onSend?: Send
  turnConfigurationValue: TurnConfiguration | null | undefined
  clearDraft: (editor?: LexicalEditor | null) => void
  restoreDraft: (text: string, editor?: LexicalEditor | null) => void
  clear: (ids: string[]) => void
  isCurrentDraft: () => boolean
}) {
  const { draft, attachments, markError, editor, onSend } = input
  const { turnConfigurationValue, clearDraft, clear } = input
  if (onSend === undefined || (!draft.trim() && attachments.length === 0)) return
  const resolved = await resolveAttachments(draft, attachments, markError)
  if (!resolved.prompt.trim() && resolved.attachments.length === 0) return
  switch (
    outcomeFor(await onSend(resolved.prompt, turnConfigurationValue ?? null, resolved.attachments))
  ) {
    case 'accepted':
      if (input.isCurrentDraft()) {
        clearDraft(editor)
        clear(resolved.sentIds)
      }
      return
    case 'rejected':
      if (input.isCurrentDraft()) input.restoreDraft(draft, editor)
      return
    case 'uncertain':
      return
  }
}

// The Send callback: everything performSend needs, bound to this composer's state.
export function useSend(input: {
  editorRef: RefObject<LexicalEditor | null>
  draft: string
  attachments: ComposerAttachment[]
  clear: (ids: string[]) => void
  clearDraft: (editor?: LexicalEditor | null) => void
  restoreDraft: (text: string, editor?: LexicalEditor | null) => void
  markError: (ids: string[]) => void
  onSend?: Send
  turnConfigurationValue: TurnConfiguration | null | undefined
  editing: ComposerEditing
  latestEditing: RefObject<ComposerEditing>
}) {
  const { editorRef, draft, attachments, clear, clearDraft, restoreDraft } = input
  const { markError, onSend, turnConfigurationValue } = input
  return useCallback(
    () =>
      performSend({
        attachments,
        clear,
        clearDraft,
        draft,
        editor: editorRef.current,
        markError,
        onSend,
        restoreDraft,
        turnConfigurationValue,
        isCurrentDraft: () => sameDraftContent(input.editing, input.latestEditing.current),
      }),
    [
      attachments,
      clear,
      clearDraft,
      draft,
      editorRef,
      markError,
      onSend,
      restoreDraft,
      turnConfigurationValue,
      input.editing,
      input.latestEditing,
    ],
  )
}
