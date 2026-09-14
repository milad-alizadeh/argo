import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { HarnessControl } from '../harness/harnesses'
import { useComposerStore } from '../state/useComposerStore'
import { supportedSetup, type TurnSetup } from '../turn-setup/turn-setup'
import { ComposerForm } from './ComposerForm'
import './composer-content.css'
import type { TurnSetupControlProps } from './RunSetupMenu'
import { type PendingTurn, usePendingTurns } from './usePendingTurns'

export type SessionComposerProps = {
  contextTokens?: number | null
  focusOnMount?: boolean
  isCompacting?: boolean
  isRunning?: boolean
  onCompact?: () => Promise<boolean>
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: (text: string, setup: TurnSetup | null) => Promise<boolean>
  plan?: SessionPlan | null
  harness?: HarnessControl | null
  setup?: TurnSetupControlProps | null
}

// The setup a queued Turn was written with, narrowed to the choices still offered.
function turnSetupOf(setup: TurnSetupControlProps | null, turnSetup: TurnSetup | undefined) {
  if (setup === null) return null
  return turnSetup === undefined
    ? setup.value
    : supportedSetup(setup.choices, turnSetup, setup.value)
}

// A queued Turn brought back to edit carries its own choices, kept only where still offered.
function restoreSetup(turn: PendingTurn, setup: TurnSetupControlProps | null | undefined) {
  if (setup && turn.setup !== undefined)
    setup.onChange(supportedSetup(setup.choices, turn.setup, setup.value))
}

function restorePendingTurn(
  turn: PendingTurn,
  editorRef: RefObject<LexicalEditor | null>,
  onChange: (text: string) => void,
) {
  onChange(turn.text)
  editorRef.current?.update(() => $convertFromMarkdownString(turn.text, TRANSFORMERS))
  window.requestAnimationFrame(() => editorRef.current?.focus())
}

function useComposerDraft(sessionId: string, editorRef: RefObject<LexicalEditor | null>) {
  const draft = useComposerStore(({ drafts }) => drafts[sessionId] ?? '')
  const setDraft = useComposerStore(({ setDraft }) => setDraft)
  const changeDraft = useCallback(
    (text: string) => setDraft(sessionId, text),
    [sessionId, setDraft],
  )
  const clearDraft = useCallback(
    (editor = editorRef.current) => {
      editor?.update(() => $getRoot().clear().append($createParagraphNode()))
      setDraft(sessionId, '')
    },
    [editorRef, sessionId, setDraft],
  )
  return { changeDraft, clearDraft, draft }
}

export function SessionComposer({
  contextTokens,
  focusOnMount = false,
  isCompacting = false,
  isRunning = false,
  onCompact,
  onInterrupt,
  sessionId,
  onSend,
  plan = null,
  harness = null,
  setup = null,
}: SessionComposerProps) {
  const editorRef = useRef<LexicalEditor>(null)
  const { changeDraft, clearDraft, draft } = useComposerDraft(sessionId, editorRef)
  const sendPendingTurn = useCallback(
    (text: string, turnSetup: TurnSetup | undefined) => onSend(text, turnSetupOf(setup, turnSetup)),
    [onSend, setup],
  )
  const { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn } = usePendingTurns({
    isRunning,
    onSend: sendPendingTurn,
    sessionId,
  })
  const send = useCallback(async () => {
    if (!draft.trim()) return
    if (isRunning) {
      addPendingTurn(draft, setup?.value)
      clearDraft()
      return
    }
    const editor = editorRef.current
    if (await onSend(draft, setup?.value ?? null)) clearDraft(editor)
  }, [addPendingTurn, clearDraft, draft, isRunning, onSend, setup?.value])
  return (
    <ComposerForm
      harness={harness}
      draft={draft}
      editorRef={editorRef}
      focusOnMount={focusOnMount}
      contextTokens={contextTokens}
      isCompacting={isCompacting}
      isRunning={isRunning}
      onChange={changeDraft}
      onCompact={onCompact}
      onEdit={(turn) => {
        restorePendingTurn(turn, editorRef, changeDraft)
        restoreSetup(turn, setup)
      }}
      onInterrupt={onInterrupt}
      onRemove={removePendingTurn}
      onReorder={reorderPendingTurn}
      onSend={() => void send()}
      pendingTurns={pendingTurns}
      plan={plan}
      sessionId={sessionId}
      setup={setup}
    />
  )
}
