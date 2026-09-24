import { useCallback, useEffect, useRef } from 'react'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import { EMPTY_PENDING_TURNS, useComposerStore } from '../hooks/use-composer-store'
import type { Send } from '../hooks/use-send'
import type { TurnSetup } from '../turn-setup/turn-setup'

export type { PendingTurn } from '../hooks'

export function usePendingTurns({
  isRunning,
  onSend,
  sessionId,
}: {
  isRunning: boolean
  onSend?: Send
  sessionId: string
}) {
  const pendingTurns = useComposerStore(
    ({ pendingTurns }) => pendingTurns[sessionId] ?? EMPTY_PENDING_TURNS,
  )
  const add = useComposerStore(({ addPendingTurn }) => addPendingTurn)
  const remove = useComposerStore(({ removePendingTurn }) => removePendingTurn)
  const wasRunning = useRef(isRunning)

  const addPendingTurn = useCallback(
    (text: string, setup: TurnSetup | undefined, attachments: SessionAttachmentInput[]) =>
      add(sessionId, { id: crypto.randomUUID(), text, setup, attachments }),
    [add, sessionId],
  )

  const removePendingTurn = useCallback((id: string) => remove(sessionId, id), [remove, sessionId])

  useEffect(() => {
    const becameIdle = wasRunning.current && !isRunning
    wasRunning.current = isRunning
    const nextTurn = pendingTurns[0]
    if (!becameIdle || !nextTurn || onSend === undefined) return
    void onSend(nextTurn.text, nextTurn.setup ?? null, nextTurn.attachments).then((sent) => {
      if (sent) removePendingTurn(nextTurn.id)
    })
  }, [isRunning, onSend, pendingTurns, removePendingTurn])

  return { addPendingTurn }
}
