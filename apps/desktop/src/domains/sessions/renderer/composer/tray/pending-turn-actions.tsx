import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PendingTurn } from '@/domains/sessions/renderer/composer/tray/use-pending-turns'
import { Icon } from '@/platform/renderer/components/icon'
import { Button } from '@/platform/renderer/components/ui/button'

export function PendingTurnActions({
  onEdit,
  onSteer,
  onRemove,
  turn,
}: {
  onEdit: (turn: PendingTurn) => void
  onSteer: (turn: PendingTurn) => Promise<boolean>
  onRemove: (id: string) => void
  turn: PendingTurn
}) {
  const { t } = useTranslation('sessions')
  const [isSteering, setSteering] = useState(false)
  return (
    <>
      <Button
        aria-label={`Steer queued message: ${turn.text}`}
        disabled={isSteering}
        onClick={() => {
          setSteering(true)
          void onSteer(turn).then((steered) => {
            if (!steered) setSteering(false)
          })
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icon name="queued-turn-path" className="size-3.5" />
        {t('composer.queued.steer')}
      </Button>
      <Button
        aria-label={`Remove queued message: ${turn.text}`}
        onClick={() => onRemove(turn.id)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Icon name="delete-queued-turn" className="size-3.5" />
      </Button>
      <Button
        aria-label={`Edit queued message: ${turn.text}`}
        onClick={() => onEdit(turn)}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <Icon name="edit-queued-turn" className="size-3.5" />
      </Button>
    </>
  )
}
