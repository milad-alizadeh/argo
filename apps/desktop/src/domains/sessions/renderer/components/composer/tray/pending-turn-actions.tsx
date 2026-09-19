import { Pencil, Route, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PendingTurn } from '@/domains/sessions/renderer/components/composer/tray/use-pending-turns'
import { Button } from '@/platform/renderer/components/ui/button'

export function PendingTurnActions({
  onEdit,
  onRemove,
  turn,
}: {
  onEdit: (turn: PendingTurn) => void
  onRemove: (id: string) => void
  turn: PendingTurn
}) {
  const { t } = useTranslation('sessions')
  return (
    <>
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
        {t('composer.queued.steer')}
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
