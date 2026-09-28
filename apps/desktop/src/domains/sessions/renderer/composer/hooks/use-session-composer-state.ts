import type { LexicalEditor } from 'lexical'
import { useCallback, useRef } from 'react'
import { useComposerEditing } from '../editing/composer-editing-context'
import type { TurnConfigurationControlProps } from '../toolbar/turn-configuration-menu'
import { type Send, useSend } from './use-send'

export function useSessionComposerState({
  onSend,
  turnConfiguration,
}: {
  onSend?: Send
  turnConfiguration: TurnConfigurationControlProps | null
}) {
  const editorRef = useRef<LexicalEditor>(null)
  const { editing, dispatch, markAttachmentErrors } = useComposerEditing()
  const latestEditing = useRef(editing)
  latestEditing.current = editing
  const clearSentContent = useCallback(
    (sentIds: string[]) => dispatch({ type: 'send.accepted', sentIds }),
    [dispatch],
  )
  const send = useSend({
    attachments: editing.attachments,
    clearSentContent,
    draft: editing.prompt,
    markError: markAttachmentErrors,
    onSend,
    turnConfigurationValue: turnConfiguration?.value,
    editing,
    latestEditing,
  })
  return { editorRef, send }
}
