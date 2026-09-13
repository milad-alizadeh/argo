import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'

import { type TurnSetup, turnSetupSchema } from '../turn-setup/turn-setup'

// A stored Turn can lack a setup, and then it sends with the composer's current one.
export type PendingTurn = { id: string; text: string; setup?: TurnSetup }

const QUEUE_STORAGE_KEY = 'argo.session-composer-queues'
const pendingTurnSchema = z.strictObject({
  id: z.string().uuid(),
  text: z.string().min(1),
  setup: turnSetupSchema.optional(),
})
const queuesSchema = z.record(z.string(), z.array(pendingTurnSchema))

function restoredQueues(): Map<string, PendingTurn[]> {
  try {
    const parsed = queuesSchema.safeParse(
      JSON.parse(window.localStorage.getItem(QUEUE_STORAGE_KEY) ?? '{}'),
    )
    return parsed.success ? new Map(Object.entries(parsed.data)) : new Map()
  } catch {
    return new Map()
  }
}

function persistQueues(queues: Map<string, PendingTurn[]>) {
  window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(Object.fromEntries(queues)))
}

export function usePendingTurns({
  isRunning,
  onSend,
  sessionId,
}: {
  isRunning: boolean
  onSend: (text: string, setup: TurnSetup | undefined) => Promise<boolean>
  sessionId: string
}) {
  const [queues, setQueues] = useState(restoredQueues)
  const pendingTurns = queues.get(sessionId) ?? []
  const wasRunning = useRef(isRunning)

  useEffect(() => persistQueues(queues), [queues])

  const updateQueue = useCallback(
    (update: (turns: PendingTurn[]) => PendingTurn[]) => {
      setQueues((current) => {
        const next = new Map(current)
        const turns = update(next.get(sessionId) ?? [])
        if (turns.length === 0) next.delete(sessionId)
        else next.set(sessionId, turns)
        return next
      })
    },
    [sessionId],
  )

  const addPendingTurn = useCallback(
    (text: string, setup: TurnSetup | undefined) =>
      updateQueue((turns) => [...turns, { id: crypto.randomUUID(), text, setup }]),
    [updateQueue],
  )

  const removePendingTurn = useCallback(
    (id: string) => updateQueue((turns) => turns.filter((turn) => turn.id !== id)),
    [updateQueue],
  )

  const reorderPendingTurn = useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return
      updateQueue((turns) => {
        const sourceIndex = turns.findIndex(({ id }) => id === sourceId)
        const targetIndex = turns.findIndex(({ id }) => id === targetId)
        if (sourceIndex < 0 || targetIndex < 0) return turns
        const nextTurns = [...turns]
        const [source] = nextTurns.splice(sourceIndex, 1)
        if (!source) return turns
        nextTurns.splice(targetIndex, 0, source)
        return nextTurns
      })
    },
    [updateQueue],
  )

  useEffect(() => {
    const becameIdle = wasRunning.current && !isRunning
    wasRunning.current = isRunning
    const nextTurn = pendingTurns[0]
    if (!becameIdle || !nextTurn) return
    void onSend(nextTurn.text, nextTurn.setup).then((sent) => {
      if (sent) removePendingTurn(nextTurn.id)
    })
  }, [isRunning, onSend, pendingTurns, removePendingTurn])

  return { addPendingTurn, pendingTurns, removePendingTurn, reorderPendingTurn }
}
