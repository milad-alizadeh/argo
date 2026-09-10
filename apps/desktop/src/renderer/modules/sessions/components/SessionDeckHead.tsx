import { useTranslation } from 'react-i18next'

import type { Session } from '../types'

// The deck head (`roster-row-signals-prototype.html` · deck-head): the chosen Session named as the
// Roster names it, and at the trailing edge where it runs. The design keeps a row to what the
// Session is doing, so the working directory and the branch are said here, once, for the one
// Session the reader opened. Both are DERIVED, and the one Argo cannot establish is drawn as
// absent rather than as a plausible value (CONTEXT.md L1 · degrade down).
export function SessionDeckHead({ session }: { session: Session | null }) {
  const { t } = useTranslation()

  return (
    <header className="deck__head flex h-(--size-pane-head) flex-none items-center gap-snug border-b px-6">
      {session === null ? null : (
        <>
          <h2 className="min-w-0 truncate text-body font-semibold text-ink">
            {session.title?.text ?? session.id}
          </h2>
          <span className="flex-1" />
          <span className="flex min-w-0 max-w-[45%] flex-none items-center gap-tight font-mono text-meta text-faint">
            {session.cwd === null ? (
              <span className="roster__place--absent truncate">{t('facts.placeUnknown')}</span>
            ) : (
              // A path is truncated from its START, because its tail is the part that tells two
              // worktrees apart. `direction: rtl` puts the ellipsis there, and the bidi rule stops
              // it also moving the leading slash to the end and drawing a path that is not the path.
              <span className="roster__place truncate [direction:rtl] [unicode-bidi:plaintext]">
                {session.cwd}
              </span>
            )}
            {session.branch === null ? null : (
              <span className="roster__branch flex-none">{session.branch}</span>
            )}
          </span>
        </>
      )}
    </header>
  )
}
