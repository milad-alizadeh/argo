import { Pencil, Route, Trash2 } from 'lucide-react'

import { Button } from '../../../components/ui/button'
import type { PendingTurn } from './usePendingTurns'

export function PendingTurnActions({
  index,
  onEdit,
  onRemove,
  onReorder,
  turn,
  turns,
}: {
  index: number
  onEdit: (turn: PendingTurn) => void
  onRemove: (id: string) => void
  onReorder: (sourceId: string, targetId: string) => void
  turn: PendingTurn
  turns: PendingTurn[]
}) {
  return (
    <>
      {index > 0 ? (
        <Button
          aria-label={`Move queued message up: ${turn.text}`}
          className="sr-only focus:not-sr-only"
          onClick={() => onReorder(turn.id, turns[index - 1]?.id ?? turn.id)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Move up
        </Button>
      ) : null}
      {index < turns.length - 1 ? (
        <Button
          aria-label={`Move queued message down: ${turn.text}`}
          className="sr-only focus:not-sr-only"
          onClick={() => onReorder(turn.id, turns[index + 1]?.id ?? turn.id)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Move down
        </Button>
      ) : null}
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
    </>
  )
}
