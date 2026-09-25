import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef } from 'react'
import type { TurnConfigurationControlProps } from '../toolbar/turn-configuration-menu'
import { usePendingTurns } from '../tray/use-pending-turns'
import {
  supportedConfiguration,
  type TurnConfiguration,
} from '../turn-configuration/turn-configuration'
import { useComposerAttachments } from './use-composer-attachments'
import { useComposerStore } from './use-composer-store'
import { type Send, useSend } from './use-send'

// Narrow the queued Turn Configuration to the choices that remain available.
function turnConfigurationOf(
  control: TurnConfigurationControlProps | null,
  queued: TurnConfiguration | undefined,
) {
  if (control === null) return null
  return queued === undefined
    ? control.value
    : supportedConfiguration(control.choices, queued, control.value)
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
  turnConfiguration,
}: {
  isRunning: boolean
  onSend?: Send
  sessionId: string
  turnConfiguration: TurnConfigurationControlProps | null
}) {
  const editorRef = useRef<LexicalEditor>(null)
  const { clearDraft, draft, restoreDraft } = useComposerDraft(sessionId, editorRef)
  const { attachments, markError, clear } = useComposerAttachments(sessionId)
  const sendPendingTurn: Send = useCallback(
    (text, queuedConfiguration, pendingAttachments) =>
      onSend?.(
        text,
        turnConfigurationOf(turnConfiguration, queuedConfiguration ?? undefined),
        pendingAttachments,
      ) ?? Promise.resolve(false),
    [onSend, turnConfiguration],
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
    turnConfigurationValue: turnConfiguration?.value,
  })
  return { editorRef, send }
}
