import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef, useState } from 'react'

import type { SessionPlan } from '@/core/sessions/models'
import type { SessionCli } from '../hooks/useSessionComposer'
import { supportedSetup, type TurnSetup } from '../turn-setup/turn-setup'
import { ComposerForm } from './ComposerForm'
import './composer-content.css'
import type { TurnSetupControlProps } from './RunSetupMenu'
import { type PendingTurn, usePendingTurns } from './usePendingTurns'

export type SessionComposerProps = {
  isRunning?: boolean
  onInterrupt?: () => Promise<boolean>
  sessionId: string
  onSend: (text: string, setup: TurnSetup | null) => Promise<boolean>
  plan?: SessionPlan | null
  cliPicker?: { cli: SessionCli; onChangeCli: (cli: SessionCli) => void } | null
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
  editorRef.current?.update(() =>
    $getRoot()
      .clear()
      .append($createParagraphNode().append($createTextNode(turn.text))),
  )
  window.requestAnimationFrame(() => editorRef.current?.focus())
}

export function SessionComposer({
  isRunning = false,
  onInterrupt,
  sessionId,
  onSend,
  plan = null,
  cliPicker,
  setup = null,
}: SessionComposerProps) {
  const [drafts, setDrafts] = useState(() => new Map<string, string>())
  const draft = drafts.get(sessionId) ?? ''
  const editorRef = useRef<LexicalEditor>(null)
  const sendPendingTurn = useCallback(
    (text: string, turnSetup: TurnSetup | undefined) => onSend(text, turnSetupOf(setup, turnSetup)),
    [onSend, setup],
  )
  const { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn } = usePendingTurns({
    isRunning,
    onSend: sendPendingTurn,
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
      cliPicker={cliPicker}
      draft={draft}
      editorRef={editorRef}
      isRunning={isRunning}
      onChange={changeDraft}
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
