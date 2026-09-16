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
      {/* The instance names the store this app reads, so an empty dialog reads as another app's
          store rather than as lost data (#2304). Two worktrees on one branch share a label. It
          truncates like the worktree beside it: a real id runs to ~40 characters, and at the
          minimum window width a fixed one would eat the path that says which tree this is. */}
      <span className="min-w-0 truncate font-mono text-background/80" title={identity.id}>
        {identity.id}
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
        <GitBranch aria-hidden="true" className="size-(--size-icon-inline) shrink-0" />
        <span className="truncate">{identity.worktree}</span>
      </span>
    </aside>
  )
}
