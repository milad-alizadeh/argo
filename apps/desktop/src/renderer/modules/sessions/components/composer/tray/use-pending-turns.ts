import { useCallback, useEffect, useRef } from 'react'
import type { SessionAttachmentInput } from '@/core/sessions/attachments-contract'
import { type PendingTurn, useComposerStore } from '../../../state/use-composer-store'
import type { TurnSetup } from '../../../turn-setup/turn-setup'
import type { Send } from '../use-send'

export type { PendingTurn } from '../../../state/use-composer-store'

const NO_PENDING_TURNS: PendingTurn[] = []

export function usePendingTurns({
  isRunning,
  onSend,
  sessionId,
}: {
  isRunning: boolean
  onSend: Send
  sessionId: string
}) {
  const pendingTurns = useComposerStore(
    ({ pendingTurns }) => pendingTurns[sessionId] ?? NO_PENDING_TURNS,
  )
  const add = useComposerStore(({ addPendingTurn }) => addPendingTurn)
  const remove = useComposerStore(({ removePendingTurn }) => removePendingTurn)
  const reorder = useComposerStore(({ reorderPendingTurn }) => reorderPendingTurn)
  const wasRunning = useRef(isRunning)

  const addPendingTurn = useCallback(
    (text: string, setup: TurnSetup | undefined, attachments: SessionAttachmentInput[]) =>
      add(sessionId, { id: crypto.randomUUID(), text, setup, attachments }),
    [add, sessionId],
  )

  const removePendingTurn = useCallback((id: string) => remove(sessionId, id), [remove, sessionId])

  const reorderPendingTurn = useCallback(
    (sourceId: string, targetId: string) => {
      reorder(sessionId, sourceId, targetId)
    },
    [reorder, sessionId],
  )

  useEffect(() => {
    const becameIdle = wasRunning.current && !isRunning
    wasRunning.current = isRunning
    const nextTurn = pendingTurns[0]
    if (!becameIdle || !nextTurn) return
    void onSend(nextTurn.text, nextTurn.setup ?? null, nextTurn.attachments).then((sent) => {
      if (sent) removePendingTurn(nextTurn.id)
    })
  }, [isRunning, onSend, pendingTurns, removePendingTurn])

  return { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn }
}
