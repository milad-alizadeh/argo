import type { LexicalEditor } from 'lexical'
import { type RefObject, useCallback } from 'react'

import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import type { ComposerAttachment } from '../../state/use-composer-store'
import type { TurnSetup } from '../../turn-setup/turn-setup'
import { resolveAttachments } from './use-composer-attachments'

export type Send = (
  text: string,
  setup: TurnSetup | null,
  attachments: SessionAttachmentInput[],
) => Promise<boolean>

// The draft/attachments state a Send needs, resolved and dispatched as either a queued Turn
// (running) or the live Turn, then cleared only for what actually left the composer.
// Exported for direct testing: a queued Send must never reach onSend, since that is what begins
// the Turn Marker (#2099) — a running Turn already owns it.
export async function performSend(input: {
  draft: string
  attachments: ComposerAttachment[]
  markError: (ids: string[]) => void
  isRunning: boolean
  addPendingTurn: (
    text: string,
    setup: TurnSetup | undefined,
    attachments: SessionAttachmentInput[],
  ) => void
  editor: LexicalEditor | null
  onSend: Send
  setupValue: TurnSetup | null | undefined
  clearDraft: (editor?: LexicalEditor | null) => void
  clear: (ids: string[]) => void
}) {
  const { draft, attachments, markError, isRunning, addPendingTurn, editor, onSend } = input
  const { setupValue, clearDraft, clear } = input
  if (!draft.trim() && attachments.length === 0) return
  const resolved = await resolveAttachments(draft, attachments, markError)
  if (!resolved.prompt.trim() && resolved.attachments.length === 0) return
  if (isRunning) {
    addPendingTurn(resolved.prompt, setupValue ?? undefined, resolved.attachments)
    clearDraft()
    clear(resolved.sentIds)
    return
  }
  if (await onSend(resolved.prompt, setupValue ?? null, resolved.attachments)) {
    clearDraft(editor)
    clear(resolved.sentIds)
  }
}

// The Send callback: everything performSend needs, bound to this composer's state.
export function useSend(input: {
  editorRef: RefObject<LexicalEditor | null>
  draft: string
  attachments: ComposerAttachment[]
  clear: (ids: string[]) => void
  clearDraft: (editor?: LexicalEditor | null) => void
  isRunning: boolean
  markError: (ids: string[]) => void
  addPendingTurn: (
    text: string,
    setup: TurnSetup | undefined,
    attachments: SessionAttachmentInput[],
  ) => void
  onSend: Send
  setupValue: TurnSetup | null | undefined
}) {
  const { editorRef, draft, attachments, clear, clearDraft, isRunning } = input
  const { markError, addPendingTurn, onSend, setupValue } = input
  return useCallback(
    () =>
      performSend({
        addPendingTurn,
        attachments,
        clear,
        clearDraft,
        draft,
        editor: editorRef.current,
        isRunning,
        markError,
        onSend,
        setupValue,
      }),
    [
      addPendingTurn,
      attachments,
      clear,
      clearDraft,
      draft,
      editorRef,
      isRunning,
      markError,
      onSend,
      setupValue,
    ],
  )
}
