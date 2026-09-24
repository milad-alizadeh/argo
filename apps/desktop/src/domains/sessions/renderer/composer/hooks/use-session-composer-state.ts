import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef } from 'react'
import type { TurnSetupControlProps } from '../toolbar/run-setup-menu'
import { usePendingTurns } from '../tray/use-pending-turns'
import { supportedSetup, type TurnSetup } from '../turn-setup/turn-setup'
import { useComposerAttachments } from './use-composer-attachments'
import { useComposerStore } from './use-composer-store'
import { type Send, useSend } from './use-send'

// The setup a queued Turn was written with, narrowed to the choices still offered.
function turnSetupOf(setup: TurnSetupControlProps | null, turnSetup: TurnSetup | undefined) {
  if (setup === null) return null
  return turnSetup === undefined
    ? setup.value
    : supportedSetup(setup.choices, turnSetup, setup.value)
}

function useComposerDraft(sessionId: string, editorRef: RefObject<LexicalEditor | null>) {
  const draft = useComposerStore(({ drafts }) => drafts[sessionId] ?? '')
  const setDraft = useComposerStore(({ setDraft }) => setDraft)
  const clearDraft = useCallback(
    (editor = editorRef.current) => {
      // Selecting the fresh paragraph matters: without it, the next keystroke finds no
      // selection to type into and Lexical opens a second paragraph instead, so the composer's
      // next Send carries a leading blank line (#e2e-real-cheap-models).
      editor?.update(() => $getRoot().clear().append($createParagraphNode()).selectEnd())
      setDraft(sessionId, '')
    },
    [editorRef, sessionId, setDraft],
  )
  const restoreDraft = useCallback(
    (text: string, editor = editorRef.current) => {
      if ((useComposerStore.getState().drafts[sessionId] ?? '') !== '') return
      editor?.update(() => $convertFromMarkdownString(text, TRANSFORMERS))
      setDraft(sessionId, text)
    },
    [editorRef, sessionId, setDraft],
  )
  return { clearDraft, draft, restoreDraft }
}

export function useSessionComposerState({
  isRunning,
  onSend,
  sessionId,
  setup,
}: {
  isRunning: boolean
  onSend?: Send
  sessionId: string
  setup: TurnSetupControlProps | null
}) {
  const editorRef = useRef<LexicalEditor>(null)
  const { clearDraft, draft, restoreDraft } = useComposerDraft(sessionId, editorRef)
  const { attachments, markError, clear } = useComposerAttachments(sessionId)
  const sendPendingTurn: Send = useCallback(
    (text, turnSetup, pendingAttachments) =>
      onSend?.(text, turnSetupOf(setup, turnSetup ?? undefined), pendingAttachments) ??
      Promise.resolve(false),
    [onSend, setup],
  )
  const { addPendingTurn } = usePendingTurns({ isRunning, onSend: sendPendingTurn, sessionId })
  const send = useSend({
    addPendingTurn,
    attachments,
    clear,
    clearDraft,
    draft,
    editorRef,
    isRunning,
    markError,
    onSend,
    restoreDraft,
    setupValue: setup?.value,
  })
  return { editorRef, send }
}
