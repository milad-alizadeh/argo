import type { LexicalEditor } from 'lexical'
import { type RefObject, useCallback } from 'react'

import type { ComposerAttachment } from '../state/useComposerStore'
import type { TurnSetup } from '../turn-setup/turn-setup'
import { resolveAttachments } from './useComposerAttachments'

// The draft/attachments state a Send needs, resolved and dispatched as either a queued Turn
// (running) or the live Turn, then cleared only for what actually left the composer.
async function performSend(input: {
  draft: string
  attachments: ComposerAttachment[]
  markError: (ids: string[]) => void
  isRunning: boolean
  addPendingTurn: (text: string, setup: TurnSetup | undefined) => void
  editor: LexicalEditor | null
  onSend: (text: string, setup: TurnSetup | null) => Promise<boolean>
  setupValue: TurnSetup | null | undefined
  clearDraft: (editor?: LexicalEditor | null) => void
  clear: (ids: string[]) => void
}) {
  const { draft, attachments, markError, isRunning, addPendingTurn, editor, onSend } = input
  const { setupValue, clearDraft, clear } = input
  if (!draft.trim() && attachments.length === 0) return
  const { prompt, sentIds } = await resolveAttachments(draft, attachments, markError)
  if (!prompt.trim()) return
  if (isRunning) {
    addPendingTurn(prompt, setupValue ?? undefined)
    clearDraft()
    clear(sentIds)
    return
  }
  if (await onSend(prompt, setupValue ?? null)) {
    clearDraft(editor)
    clear(sentIds)
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
  addPendingTurn: (text: string, setup: TurnSetup | undefined) => void
  onSend: (text: string, setup: TurnSetup | null) => Promise<boolean>
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
