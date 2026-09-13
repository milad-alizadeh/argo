import { GripVertical, Route } from 'lucide-react'
import { useRef } from 'react'

import { PendingTurnActions } from './PendingTurnActions'
import type { PendingTurn } from './usePendingTurns'

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
  if (turns.length === 0) return null
  const removeTurn = (id: string) => {
    onRemove(id)
    window.requestAnimationFrame(() => {
      const nextControl = listRef.current?.querySelector<HTMLButtonElement>('button')
      if (nextControl) nextControl.focus()
      else document.querySelector<HTMLButtonElement>('[aria-label="Message"]')?.focus()
    })
  }
  return (
    <section aria-label="Pending Turns" className="session-page__composer-queue">
      <ul ref={listRef}>
        {turns.map((turn, index) => (
          <li
            key={turn.id}
            draggable
            className="session-page__queued-message cursor-grab active:cursor-grabbing"
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) => event.dataTransfer.setData('text/plain', turn.id)}
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
