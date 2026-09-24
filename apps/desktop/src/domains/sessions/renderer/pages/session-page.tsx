import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { trpc } from '@/platform/renderer/trpc-client'

export function SessionPage() {
  const { t } = useTranslation('sessions')
  const page = useQuery(trpc.sessions.page.queryOptions({ page: 1, pageSize: 20 }))

  if (page.isPending) return <main className="p-8">{t('loading')}</main>
  if (page.isError) return <main className="p-8">{t('errors.roster')}</main>

  return (
    <main className="p-8">
      <h1 className="type-title font-heading">{t('title')}</h1>
      <p className="mt-2 type-body text-muted-foreground">
        {page.data.total} {t('navigationLabel')}
      </p>
      <ul className="mt-6 space-y-2">
        {page.data.items.map((item) => (
          <li className="rounded border p-3" key={item.argoId}>
            <div className="font-medium">{item.title ?? item.nativeId}</div>
            <div className="type-meta text-muted-foreground">{item.harness}</div>
          </li>
        ))}
      </ul>
    </main>
  )
}
