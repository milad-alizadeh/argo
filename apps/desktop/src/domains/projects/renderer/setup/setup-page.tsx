import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/platform/renderer/components/ui/button'

export function SetupPage({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-8 py-6">{children}</div>
      </div>
      {actions ? (
        <div className="mx-auto flex w-full max-w-4xl shrink-0 items-center justify-end gap-2 px-8 py-3">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('projects')
  return (
    <Button className="-ml-3" onClick={onClick} type="button" variant="ghost">
      <ArrowLeft aria-hidden="true" />
      {t('setup.document.back')}
    </Button>
  )
}

export function isJson(source: string) {
  try {
    JSON.parse(source)
    return true
  } catch {
    return false
  }
}
