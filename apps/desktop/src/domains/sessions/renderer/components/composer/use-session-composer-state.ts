import { $convertFromMarkdownString, TRANSFORMERS } from '@lexical/markdown'
import { $createParagraphNode, $getRoot, type LexicalEditor } from 'lexical'
import { type RefObject, useCallback, useRef } from 'react'
import type { TurnSetupControlProps } from '@/domains/sessions/renderer/components/composer/run-setup-menu'
import {
  type PendingTurn,
  usePendingTurns,
} from '@/domains/sessions/renderer/components/composer/tray/use-pending-turns'
import {
  useAttachmentTransfer,
  useComposerAttachments,
} from '@/domains/sessions/renderer/components/composer/use-composer-attachments'
import { type Send, useSend } from '@/domains/sessions/renderer/components/composer/use-send'
import { useComposerStore } from '@/domains/sessions/renderer/state/use-composer-store'
import { supportedSetup, type TurnSetup } from '@/domains/sessions/renderer/turn-setup/turn-setup'

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

// A queued Turn brought back to edit restores its text and, where still offered, its own setup
// choices rather than the composer's current ones.
function useEditPendingTurn(
  editorRef: RefObject<LexicalEditor | null>,
  changeDraft: (text: string) => void,
  setup: TurnSetupControlProps | null,
) {
  return useCallback(
    (turn: PendingTurn) => {
      changeDraft(turn.text)
      editorRef.current?.update(() => $convertFromMarkdownString(turn.text, TRANSFORMERS))
      window.requestAnimationFrame(() => editorRef.current?.focus())
      if (setup && turn.setup !== undefined)
        setup.onChange(supportedSetup(setup.choices, turn.setup, setup.value))
    },
    [changeDraft, editorRef, setup],
  )
}

// Everything a SessionComposer render needs: the draft, the attachment strip, the pending-turn
// queue and the callbacks that tie them together, so the component itself is just prop wiring.
export function useSessionComposerState({
  isRunning,
  onSend,
  sessionId,
  setup,
}: {
  isRunning: boolean
  onSend: Send
  sessionId: string
  setup: TurnSetupControlProps | null
}) {
  const editorRef = useRef<LexicalEditor>(null)
  const { changeDraft, clearDraft, draft } = useComposerDraft(sessionId, editorRef)
  const { attachments, attach, remove, markError, clear, tickets, addTicket, removeTicket } =
    useComposerAttachments(sessionId)
  const onEdit = useEditPendingTurn(editorRef, changeDraft, setup)
  const sendPendingTurn: Send = useCallback(
    (text, turnSetup, pendingAttachments) =>
      onSend(text, turnSetupOf(setup, turnSetup ?? undefined), pendingAttachments),
    [onSend, setup],
  )
  const { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn } = usePendingTurns({
    isRunning,
    onSend: sendPendingTurn,
    sessionId,
  })
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
    setupValue: setup?.value,
  })
  const { attachFiles, dropFiles } = useAttachmentTransfer(attach)
  return {
    attachments,
    tickets,
    addTicket,
    attachFiles,
    changeDraft,
    draft,
    dropFiles,
    editorRef,
    onEdit,
    pendingTurns,
    removeAttachment: remove,
    removeTicket,
    removePendingTurn,
    reorderPendingTurn,
    send,
  }
}
