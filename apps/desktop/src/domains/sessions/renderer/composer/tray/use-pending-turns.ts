import { useCallback, useEffect, useRef } from 'react'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/attachments-contract'
import {
  type PendingTurn,
  useComposerStore,
} from '@/domains/sessions/renderer/composer/use-composer-store'
import type { Send } from '@/domains/sessions/renderer/composer/use-send'
import type { TurnSetup } from '@/domains/sessions/renderer/turn-setup/turn-setup'

export type { PendingTurn } from '@/domains/sessions/renderer/composer/use-composer-store'

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
