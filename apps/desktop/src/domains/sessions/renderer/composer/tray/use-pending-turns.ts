import { useCallback, useEffect, useRef } from 'react'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { TurnSetup } from '@/domains/sessions/renderer/composer/turn-setup/turn-setup'
import {
  type PendingTurn,
  useComposerStore,
} from '@/domains/sessions/renderer/composer/use-composer-store'
import type { Send } from '@/domains/sessions/renderer/composer/use-send'

export type { PendingTurn } from '@/domains/sessions/renderer/composer/use-composer-store'

const NO_PENDING_TURNS: PendingTurn[] = []

export function usePendingTurns({
  isRunning,
  onSend,
  onSteer,
  sessionId,
}: {
  isRunning: boolean
  onSend: Send
  onSteer?: (text: string, attachments: SessionAttachmentInput[]) => Promise<boolean>
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
  const steerPendingTurn = useCallback(
    async (turn: PendingTurn) => {
      if (onSteer === undefined) return false
      const steered = await onSteer(turn.text, turn.attachments)
      if (steered) removePendingTurn(turn.id)
      return steered
    },
    [onSteer, removePendingTurn],
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

  return { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn, steerPendingTurn }
}
