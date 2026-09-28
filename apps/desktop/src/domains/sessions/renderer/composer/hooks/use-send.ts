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
  onSend?: Send
  turnConfigurationValue: TurnConfiguration | null | undefined
  clearSentContent: (sentIds: string[]) => void
  isCurrentDraft: () => boolean
}) {
  const { draft, attachments, markError, onSend } = input
  const { turnConfigurationValue, clearSentContent } = input
  if (onSend === undefined || (!draft.trim() && attachments.length === 0)) return
  const resolved = await resolveAttachments(draft, attachments, markError)
  if (!resolved.prompt.trim() && resolved.attachments.length === 0) return
  switch (
    outcomeFor(await onSend(resolved.prompt, turnConfigurationValue ?? null, resolved.attachments))
  ) {
    case 'accepted':
      if (input.isCurrentDraft()) clearSentContent(resolved.sentIds)
      return
    case 'rejected':
      return
    case 'uncertain':
      return
  }
}

// The Send callback: everything performSend needs, bound to this composer's state.
export function useSend(input: {
  draft: string
  attachments: ComposerAttachment[]
  clearSentContent: (sentIds: string[]) => void
  markError: (ids: string[]) => void
  onSend?: Send
  turnConfigurationValue: TurnConfiguration | null | undefined
  editing: ComposerEditing
  latestEditing: RefObject<ComposerEditing>
}) {
  const { draft, attachments, clearSentContent } = input
  const { markError, onSend, turnConfigurationValue } = input
  return useCallback(
    () =>
      performSend({
        attachments,
        clearSentContent,
        draft,
        markError,
        onSend,
        turnConfigurationValue,
        isCurrentDraft: () => sameDraftContent(input.editing, input.latestEditing.current),
      }),
    [
      attachments,
      clearSentContent,
      draft,
      markError,
      onSend,
      turnConfigurationValue,
      input.editing,
      input.latestEditing,
    ],
  )
}
