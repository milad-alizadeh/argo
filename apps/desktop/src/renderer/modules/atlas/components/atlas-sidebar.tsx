import { useTranslation } from 'react-i18next'

export function AtlasSidebar() {
  const { t } = useTranslation('atlas')
  return <aside aria-label={t('sidebar.label')} className="h-full bg-sidebar" />
}
