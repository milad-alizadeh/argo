import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '@/platform/renderer/components/icon'

export function ProjectSetupAgentHeader() {
  const { t } = useTranslation('projects')
  return (
    <div className="no-drag-region flex items-center gap-3">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Icon name="agent" size="control" />
      </span>
      <div>
        <p className="type-heading">{t('setup.shell.agentTitle')}</p>
        <p className="type-meta text-muted-foreground">{t('setup.shell.agentSubtitle')}</p>
      </div>
    </div>
  )
}

export function ProjectSetupIntroduction() {
  const { t } = useTranslation('projects')
  return (
    <>
      <span className="grid size-8 place-items-center rounded-full bg-muted">
        <Icon name="sparkles" size="control" />
      </span>
      <p>{t('setup.shell.introduction')}</p>
    </>
  )
}

export function ProjectSetupShell({
  accessibleName,
  children,
  contentRef,
  event,
  header,
  introduction,
  sidebar,
  sidebarDisclosureLabel,
}: {
  accessibleName: string
  children: ReactNode
  contentRef: RefObject<HTMLElement | null>
  event: ReactNode
  header: ReactNode
  introduction: ReactNode
  sidebar: ReactNode
  sidebarDisclosureLabel: string
}) {
  return (
    <main
      aria-label={accessibleName}
      className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    >
      <header className="drag-region flex h-(--size-chrome-bar) shrink-0 items-center justify-between border-b px-5 pl-20">
        {header}
      </header>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_var(--size-session-inspector)] overflow-hidden max-lg:grid-cols-1">
        <section
          className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-8 pt-8 pb-24 lg:px-16"
          ref={contentRef}
        >
          <div className="mb-3 grid max-w-3xl grid-cols-[var(--size-control)_minmax(0,1fr)] gap-3 type-body text-muted-foreground [&_p]:pt-1.5">
            {introduction}
          </div>
          <div className="mb-3 grid max-w-3xl grid-cols-[var(--size-control)_minmax(0,1fr)] gap-3 type-body text-foreground [&_p]:pt-1.5">
            {event}
          </div>
          <details className="mt-4 hidden max-w-3xl overflow-hidden rounded-xl border bg-sidebar max-lg:block">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 type-body font-semibold [&::-webkit-details-marker]:hidden [&_svg]:size-4">
              <span>{sidebarDisclosureLabel}</span>
              <Icon name="chevron-down" size="control" />
            </summary>
            <div className="border-t p-3.5">{sidebar}</div>
          </details>
          <div className="mt-6 ml-(--spacing-shell-region) max-w-3xl rounded-2xl border bg-card p-6 shadow-sm max-lg:ml-0">
            {children}
          </div>
        </section>
        <aside className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto border-l bg-sidebar px-(--spacing-shell-gutter) pt-(--spacing-shell-region) pb-24 max-lg:hidden">
          {sidebar}
        </aside>
      </div>
    </main>
  )
}
