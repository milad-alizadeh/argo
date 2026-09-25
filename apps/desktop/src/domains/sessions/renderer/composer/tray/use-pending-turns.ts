import { useCallback, useEffect, useRef } from 'react'
import type { SessionAttachmentInput } from '@/domains/sessions/api/attachments'
import { useComposerEditing } from '../editing/composer-editing-context'
import type { Send } from '../hooks/use-send'
import type { TurnConfiguration } from '../turn-configuration/turn-configuration'

export type { PendingTurn } from '../editing/composer-editing'

export function usePendingTurns({ isRunning, onSend }: { isRunning: boolean; onSend?: Send }) {
  const { editing, dispatch } = useComposerEditing()
  const wasRunning = useRef(isRunning)

  const addPendingTurn = useCallback(
    (
      text: string,
      turnConfiguration: TurnConfiguration | undefined,
      attachments: SessionAttachmentInput[],
    ) =>
      dispatch({
        type: 'pending-turn.added',
        turn: { id: crypto.randomUUID(), text, turnConfiguration, attachments },
      }),
    [dispatch],
  )

  const removePendingTurn = useCallback(
    (id: string) => dispatch({ type: 'pending-turn.removed', id }),
    [dispatch],
  )

  useEffect(() => {
    const becameIdle = wasRunning.current && !isRunning
    wasRunning.current = isRunning
    const nextTurn = editing.pendingTurns[0]
    if (!becameIdle || !nextTurn || onSend === undefined) return
    void onSend(nextTurn.text, nextTurn.turnConfiguration ?? null, nextTurn.attachments).then(
      (sent) => {
        if (sent) removePendingTurn(nextTurn.id)
      },
    )
  }, [editing.pendingTurns, isRunning, onSend, removePendingTurn])

  return { addPendingTurn }
}
