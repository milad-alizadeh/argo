import { GripVertical, Pencil, Route, Trash2 } from 'lucide-react'

import { Button } from '../../../components/ui/button'
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
  if (turns.length === 0) return null
  return (
    <section aria-label="Pending Turns" className="session-page__composer-queue">
      <ul>
        {turns.map((turn) => (
          <li
            key={turn.id}
            draggable
            className="session-page__queued-message"
            onDragOver={(event) => event.preventDefault()}
            onDragStart={(event) => event.dataTransfer.setData('text/plain', turn.id)}
            onDrop={(event) => onReorder(event.dataTransfer.getData('text/plain'), turn.id)}
          >
            <GripVertical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <Route aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm leading-5">{turn.text}</span>
            <Button
              aria-label={`Steer queued message: ${turn.text}`}
              onClick={() => {
                onEdit(turn)
                onRemove(turn.id)
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Route aria-hidden="true" className="size-3.5" />
              Steer
            </Button>
            <Button
              aria-label={`Remove queued message: ${turn.text}`}
              onClick={() => onRemove(turn.id)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
            </Button>
            <Button
              aria-label={`Edit queued message: ${turn.text}`}
              onClick={() => onEdit(turn)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Pencil aria-hidden="true" className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
