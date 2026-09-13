import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef, useState } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { SessionCli } from '../hooks/useSessionComposer'
import { ComposerForm } from './ComposerForm'
import './composer-content.css'
import { usePendingTurns } from './usePendingTurns'

export type SessionComposerProps = {
  isRunning?: boolean
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: (text: string) => Promise<boolean>
  plan?: SessionPlan | null
  cliPicker?: { cli: SessionCli; onChangeCli: (cli: SessionCli) => void } | null
}

function restorePendingTurn(
  turn: { text: string },
  editorRef: RefObject<LexicalEditor | null>,
  onChange: (text: string) => void,
) {
  onChange(turn.text)
  editorRef.current?.update(() => $convertFromMarkdownString(turn.text, TRANSFORMERS))
  window.requestAnimationFrame(() => editorRef.current?.focus())
}

export function SessionComposer({
  isRunning = false,
  onInterrupt,
  sessionId,
  onSend,
  plan = null,
  cliPicker,
}: SessionComposerProps) {
  const [drafts, setDrafts] = useState(() => new Map<string, string>())
  const draft = drafts.get(sessionId) ?? ''
  const editorRef = useRef<LexicalEditor>(null)
  const { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn } = usePendingTurns({
    isRunning,
    onSend,
    sessionId,
  })
  const changeDraft = useCallback(
    (text: string) => setDrafts((current) => new Map(current).set(sessionId, text)),
    [sessionId],
  )
  const clearDraft = useCallback(
    (editor = editorRef.current) => {
      editor?.update(() => $getRoot().clear().append($createParagraphNode()))
      setDrafts((current) => new Map(current).set(sessionId, ''))
    },
    [sessionId],
  )
  const send = useCallback(async () => {
    const text =
      editorRef.current?.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS)) ?? draft
    if (!text.trim()) return
    if (isRunning) {
      addPendingTurn(text)
      clearDraft()
      return
    }
    const editor = editorRef.current
    if (await onSend(text)) clearDraft(editor)
  }, [addPendingTurn, clearDraft, draft, isRunning, onSend])
  return (
    <ComposerForm
      cliPicker={cliPicker}
      draft={draft}
      editorRef={editorRef}
      isRunning={isRunning}
      onChange={changeDraft}
      onEdit={(turn) => restorePendingTurn(turn, editorRef, changeDraft)}
      onInterrupt={onInterrupt}
      onRemove={removePendingTurn}
      onReorder={reorderPendingTurn}
      onSend={() => void send()}
      pendingTurns={pendingTurns}
      plan={plan}
      sessionId={sessionId}
    />
  )
}
