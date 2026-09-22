import { useTranslation } from 'react-i18next'
import type { SessionTicket } from '@/domains/sessions/contract/model/models'
import { Icon } from '@/platform/renderer/components/icon/icon'
import type { DevelopmentIdentity } from '@/platform/contract/development-identity'

type DevelopmentIdentityBarProps = {
  identity: DevelopmentIdentity | null
  ticket: Pick<SessionTicket, 'key' | 'title'> | null
}

export function DevelopmentIdentityBar({ identity, ticket }: DevelopmentIdentityBarProps) {
  const { t } = useTranslation('sessions')
  if (identity === null) return null
  const separator = identity.id.lastIndexOf('-')
  const instanceName = separator > 0 ? identity.id.slice(0, separator) : identity.id
  const instanceHash = separator > 0 ? identity.id.slice(separator) : ''

  return (
    <aside
      aria-label={t('development.label')}
      className="flex h-(--size-development-identity-bar) w-full min-w-0 items-center gap-(--spacing-shell-item) bg-foreground px-(--spacing-shell-gutter) type-meta text-background"
      data-component="DevelopmentIdentityBar"
      data-development-instance={identity.id}
      data-development-worktree={identity.worktree}
      data-ticket-key={ticket?.key}
    >
      <span className="shrink-0 font-semibold uppercase tracking-wide">
        {t('development.shortLabel')}
      </span>
      <span className="rounded-sm bg-background px-1.5 py-0.5 font-mono font-semibold text-foreground">
        {identity.label}
      </span>
      <span className="flex min-w-0 font-mono text-background/80" title={identity.id}>
        <span className="min-w-0 truncate">{instanceName}</span>
        <span className="shrink-0">{instanceHash}</span>
      </span>
      {ticket === null ? null : (
        <span className="min-w-0 truncate" title={`${ticket.key} · ${ticket.title}`}>
          <span className="font-mono text-background/70">{ticket.key}</span>
          <span aria-hidden="true"> · </span>
          {ticket.title}
        </span>
      )}
      <span
        className="ml-auto flex min-w-0 items-center gap-1 font-mono text-background/80"
        title={identity.worktree}
      >
        <Icon name="worktree" className="size-(--size-icon-inline) shrink-0" />
        <span className="truncate">{identity.worktree}</span>
      </span>
    </aside>
  )
}
