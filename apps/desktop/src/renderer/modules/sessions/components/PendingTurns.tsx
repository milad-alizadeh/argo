import { GripVertical, Route } from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'

import { PendingTurnActions } from './PendingTurnActions'
import type { PendingTurn } from './usePendingTurns'

function queuedMessageClassName(
  id: string,
  enteringTurnId: string | null,
  exitingTurnId: string | null,
) {
  if (exitingTurnId === id) {
    return 'session-page__queued-message cursor-grab active:cursor-grabbing session-page__queued-message--exit'
  }
  if (enteringTurnId === id) {
    return 'session-page__queued-message cursor-grab active:cursor-grabbing session-page__queued-message--enter'
  }
  return 'session-page__queued-message cursor-grab active:cursor-grabbing'
}

function useQueueAnimations(
  turns: PendingTurn[],
  onRemove: (id: string) => void,
  listRef: RefObject<HTMLUListElement | null>,
) {
  const knownTurnIdsRef = useRef(new Set(turns.map((turn) => turn.id)))
  const exitTimerRef = useRef<number | null>(null)
  const [enteringTurnId, setEnteringTurnId] = useState<string | null>(null)
  const [exitingTurnId, setExitingTurnId] = useState<string | null>(null)

  useEffect(() => {
    const enteringTurn = turns.find((turn) => !knownTurnIdsRef.current.has(turn.id))
    knownTurnIdsRef.current = new Set(turns.map((turn) => turn.id))
    if (!enteringTurn) return
    setEnteringTurnId(enteringTurn.id)
    const enterTimer = window.setTimeout(() => setEnteringTurnId(null), 340)
    return () => window.clearTimeout(enterTimer)
  }, [turns])

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    },
    [],
  )

  const removeTurn = (id: string) => {
    if (exitingTurnId) return
    setExitingTurnId(id)
    exitTimerRef.current = window.setTimeout(() => {
      onRemove(id)
      setExitingTurnId(null)
      window.requestAnimationFrame(() => {
        const nextControl = listRef.current?.querySelector<HTMLButtonElement>('button')
        if (nextControl) nextControl.focus()
        else document.querySelector<HTMLButtonElement>('[aria-label="Message"]')?.focus()
      })
    }, 280)
  }

  return { enteringTurnId, exitingTurnId, removeTurn }
}

export function PendingTurns({
  turns,
  onEdit,
  onRemove,
  onReorder,
}: {
  turns: PendingTurn[]
  onEdit: (turn: PendingTurn) => void
  onRemove: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const { enteringTurnId, exitingTurnId, removeTurn } = useQueueAnimations(turns, onRemove, listRef)

  if (turns.length === 0) return null
  return (
    <section aria-label="Pending Turns" className="session-page__composer-queue">
      <ul ref={listRef}>
        {turns.map((turn, index) => (
          <li
            key={turn.id}
            draggable
            className={queuedMessageClassName(turn.id, enteringTurnId, exitingTurnId)}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', turn.id)
            }}
            onDrop={(event) => onReorder(event.dataTransfer.getData('text/plain'), turn.id)}
          >
            <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <Route aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate type-body">{turn.text}</span>
            <span className="sr-only">Queued turn. Use the move controls to reorder it.</span>
            <PendingTurnActions
              index={index}
              onEdit={onEdit}
              onRemove={removeTurn}
              onReorder={onReorder}
              turn={turn}
              turns={turns}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
