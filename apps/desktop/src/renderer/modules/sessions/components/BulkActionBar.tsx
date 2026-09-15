import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/renderer/components/ui/button'

export function BulkActionBar({
  onArchive,
  onClear,
  selectedCount,
}: {
  onArchive: () => void
  onClear: () => void
  selectedCount: number
}) {
  const { t } = useTranslation('sessions')
  return (
    <div
      className="flex items-center gap-2 border-t border-border/60 bg-sidebar px-3 py-2"
      role="toolbar"
    >
      <span className="flex-1 truncate type-body text-muted-foreground">
        {t('bulkSelect.count', { count: selectedCount })}
      </span>
      <Button onClick={onArchive} size="sm" variant="secondary">
        {t('bulkSelect.archive')}
      </Button>
      <Button aria-label={t('bulkSelect.clear')} onClick={onClear} size="icon-sm" variant="ghost">
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  )
}
