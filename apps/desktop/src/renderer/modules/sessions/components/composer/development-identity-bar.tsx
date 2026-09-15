import { GitBranch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SessionTicket } from '@/core/sessions/models'
import type { DevelopmentIdentity } from '@/development/instance'

type DevelopmentIdentityBarProps = {
  identity: DevelopmentIdentity | null
  ticket: Pick<SessionTicket, 'key' | 'title'> | null
}

export function DevelopmentIdentityBar({ identity, ticket }: DevelopmentIdentityBarProps) {
  const { t } = useTranslation('sessions')
  if (identity === null) return null

  return (
    <aside
      aria-label={t('development.label')}
      className="mt-(--spacing-shell-item) flex h-(--size-development-identity-bar) min-w-0 items-center gap-2 border-t border-border/60 px-1 type-meta text-muted-foreground"
      data-component="DevelopmentIdentityBar"
      data-development-instance={identity.id}
      data-development-worktree={identity.worktree}
      data-ticket-key={ticket?.key}
    >
      <span className="shrink-0 font-medium uppercase tracking-wide">
        {t('development.shortLabel')}
      </span>
      {ticket === null ? null : (
        <span
          className="min-w-0 truncate text-foreground"
          title={`${ticket.key} · ${ticket.title}`}
        >
          <span className="font-mono text-muted-foreground">{ticket.key}</span>
          <span aria-hidden="true"> · </span>
          {ticket.title}
        </span>
      )}
      <span className="ml-auto flex min-w-0 items-center gap-1 font-mono" title={identity.worktree}>
        <GitBranch aria-hidden="true" className="size-(--size-icon-inline) shrink-0" />
        <span className="truncate">{identity.worktree}</span>
      </span>
    </aside>
  )
}
