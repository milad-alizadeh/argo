import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trpc } from '@/platform/renderer/trpc-client'

export function SessionPage() {
  const { t } = useTranslation('sessions')
  const [pageNumber, setPageNumber] = useState(1)
  const pageSize = 20
  const page = useQuery(trpc.sessions.page.queryOptions({ page: pageNumber, pageSize }))

  if (page.isPending) return <main className="p-8">{t('loading')}</main>
  if (page.isError) return <main className="p-8">{t('errors.roster')}</main>

  const pageCount = Math.max(1, Math.ceil(page.data.total / pageSize))

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
      <nav aria-label={t('pagination.label')} className="mt-6 flex items-center gap-3">
        <button
          className="rounded border px-3 py-2 type-body disabled:opacity-50"
          disabled={pageNumber === 1}
          onClick={() => setPageNumber((current) => current - 1)}
          type="button"
        >
          {t('pagination.previous')}
        </button>
        <span aria-live="polite" className="type-meta">
          {t('pagination.page', { current: pageNumber, total: pageCount })}
        </span>
        <button
          className="rounded border px-3 py-2 type-body disabled:opacity-50"
          disabled={pageNumber >= pageCount}
          onClick={() => setPageNumber((current) => current + 1)}
          type="button"
        >
          {t('pagination.next')}
        </button>
      </nav>
    </main>
  )
}
