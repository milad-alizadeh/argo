import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef } from 'react'
import { useComposerEditing } from '../editing/composer-editing-context'
import type { TurnConfigurationControlProps } from '../toolbar/turn-configuration-menu'
import { usePendingTurns } from '../tray/use-pending-turns'
import {
  supportedConfiguration,
  type TurnConfiguration,
} from '../turn-configuration/turn-configuration'
import { useComposerAttachments } from './use-composer-attachments'
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

function useComposerDraft(editorRef: RefObject<LexicalEditor | null>) {
  const { editing, dispatch } = useComposerEditing()
  const draft = editing.prompt
  const clearDraft = useCallback(
    (editor = editorRef.current) => {
      // Selecting the fresh paragraph matters: without it, the next keystroke finds no
      // selection to type into and Lexical opens a second paragraph instead, so the composer's
      // next Send carries a leading blank line (#e2e-real-cheap-models).
      editor?.update(() => $getRoot().clear().append($createParagraphNode()).selectEnd())
      dispatch({ type: 'prompt.changed', prompt: '' })
    },
    [dispatch, editorRef],
  )
  const restoreDraft = useCallback(
    (text: string, editor = editorRef.current) => {
      if (editing.prompt !== '') return
      editor?.update(() => $convertFromMarkdownString(text, TRANSFORMERS))
      dispatch({ type: 'prompt.changed', prompt: text })
    },
    [dispatch, editing.prompt, editorRef],
  )
  return { clearDraft, draft, restoreDraft }
}

export function useSessionComposerState({
  isRunning,
  onSend,
  turnConfiguration,
}: {
  isRunning: boolean
  onSend?: Send
  turnConfiguration: TurnConfigurationControlProps | null
}) {
  const editorRef = useRef<LexicalEditor>(null)
  const { clearDraft, draft, restoreDraft } = useComposerDraft(editorRef)
  const { attachments, markError, clear } = useComposerAttachments()
  const sendPendingTurn: Send = useCallback(
    (text, queuedConfiguration, pendingAttachments) =>
      onSend?.(
        text,
        turnConfigurationOf(turnConfiguration, queuedConfiguration ?? undefined),
        pendingAttachments,
      ) ?? Promise.resolve(false),
    [onSend, turnConfiguration],
  )
  const { addPendingTurn } = usePendingTurns({ isRunning, onSend: sendPendingTurn })
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
