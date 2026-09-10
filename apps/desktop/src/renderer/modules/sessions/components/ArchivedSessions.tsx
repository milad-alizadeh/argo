import { ChevronRightIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible'

import type { Session, SessionId } from '../types'

import { SessionList } from './SessionList'
import { SessionsEmptyState } from './SessionsEmptyState'

type ArchivedSessionsProps = {
  sessions: readonly Session[]
  selectedSessionId: SessionId | null
  onSelect: (sessionId: SessionId) => void
}

// How many archived rows one page holds. A reader who archived a year of runs has hundreds of
// them, and drawing all of them the moment the section opens costs the open. So the section takes
// them a page at a time and the next page is asked for by reaching the end of the ones on screen.
const PAGE = 20

// Reaching the end of the drawn rows asks for the next page. An observer rather than a scroll
// handler, because the sentinel is inside the Roster's own scroller and the browser reports it
// crossing that edge without the renderer measuring anything (ADR-0033).
function useNextPage(hasMore: boolean, next: () => void) {
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = sentinel.current
    if (element === null || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) next()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasMore, next])
  return sentinel
}

// The Roster's foot (#1907): the archived Sessions, behind a Collapsible titled "Archived". They
// are a reading of the Claude desktop app's own `isArchived` and Argo writes none of it back, so
// this section says what that app was told rather than keeping a second answer beside it.
export function ArchivedSessions({ sessions, selectedSessionId, onSelect }: ArchivedSessionsProps) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(PAGE)
  const page = sessions.slice(0, shown)
  const hasMore = page.length < sessions.length
  const sentinel = useNextPage(hasMore, () => setShown((count) => count + PAGE))

  return (
    <Collapsible className="roster__archived flex-none border-t">
      <CollapsibleTrigger className="group flex w-full items-center gap-tight px-snug py-2 text-left text-meta text-faint hover:text-ink">
        <ChevronRightIcon className="size-[12px] flex-none transition-transform group-data-[panel-open]:rotate-90" />
        {t('archived')}
        <span className="font-mono">{sessions.length}</span>
      </CollapsibleTrigger>
      {/* Its own scroller, so a long archive scrolls inside the section and the live Sessions
          above it stay where the reader left them. */}
      <CollapsibleContent className="max-h-[40vh] overflow-y-auto">
        {sessions.length === 0 ? (
          <SessionsEmptyState
            description={t('empty.archived.description')}
            title={t('empty.archived.title')}
          />
        ) : (
          <>
            <SessionList
              label={t('archived')}
              onSelect={onSelect}
              selectedSessionId={selectedSessionId}
              sessions={page}
            />
            {hasMore ? <div aria-hidden="true" className="h-px" ref={sentinel} /> : null}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
