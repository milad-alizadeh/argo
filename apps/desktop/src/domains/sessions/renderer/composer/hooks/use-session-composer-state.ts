import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef } from 'react'
import { useComposerEditing } from '../editing/composer-editing-context'
import type { TurnConfigurationControlProps } from '../toolbar/turn-configuration-menu'
import { useComposerAttachments } from './use-composer-attachments'
import { type Send, useSend } from './use-send'

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
  onSend,
  turnConfiguration,
}: {
  onSend?: Send
  turnConfiguration: TurnConfigurationControlProps | null
}) {
  const editorRef = useRef<LexicalEditor>(null)
  const editing = useComposerEditing().editing
  const latestEditing = useRef(editing)
  latestEditing.current = editing
  const { clearDraft, draft, restoreDraft } = useComposerDraft(editorRef)
  const { attachments, markError, clear } = useComposerAttachments()
  const send = useSend({
    attachments,
    clear,
    clearDraft,
    draft,
    editorRef,
    markError,
    onSend,
    restoreDraft,
    turnConfigurationValue: turnConfiguration?.value,
    editing,
    latestEditing,
  })
  return { editorRef, send }
}
