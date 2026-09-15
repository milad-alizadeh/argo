import { ChevronRight, Loader2, TriangleAlert } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/ui/collapsible'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { useArchivedSessions } from '../hooks/use-archived-sessions'
import { sessionFailureState } from '../session-failure-state'
import type { Session, SessionId } from '../types'

// A sentinel row observed to trigger the next page as it scrolls into view, rather than a
// "load more" button: the ticket calls for infinite scroll.
function LoadMoreSentinel({ onVisible }: { onVisible: () => void }) {
  const target = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = target.current
    if (node === null) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onVisible()
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [onVisible])

  return <div aria-hidden="true" ref={target} />
}

export function ArchivedSessions({
  rows,
  selectedSessionId,
  visibleSessionIds,
}: {
  rows: (sessions: Session[], label: string) => ReactNode
  selectedSessionId: SessionId | null
  visibleSessionIds: readonly SessionId[]
}) {
  const [open, setOpen] = useState(false)
  // Ids the archive query has already surfaced, so a click on a row already on screen never
  // counts as a restore: a restore changes the query's cache key (below), and treating every
  // already-loaded row as one would drop the pages already fetched under the old key.
  const loadedIds = useRef<Set<SessionId>>(new Set())
  // A selection that is not among the active rows AND not already loaded here can only be an
  // archived Session restored from a route or a persisted choice: ask the reader for it by id
  // even before the section is opened by hand, so the sidebar can show it selected rather than
  // showing nothing selected.
  const restoreId =
    selectedSessionId !== null &&
    !visibleSessionIds.includes(selectedSessionId) &&
    !loadedIds.current.has(selectedSessionId)
      ? selectedSessionId
      : null
  const enabled = open || restoreId !== null
  const { error, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, restored, sessions } =
    useArchivedSessions(enabled, restoreId)

  useEffect(() => {
    for (const session of sessions) loadedIds.current.add(session.id)
    if (restored !== null) loadedIds.current.add(restored.id)
  })

  useEffect(() => {
    if (restored !== null) setOpen(true)
  }, [restored])

  // `restored` can fall outside every page already loaded, so it is shown by adding it to the
  // list rather than assuming a later page will bring it into view.
  const displayed =
    restored === null || sessions.some((session) => session.id === restored.id)
      ? sessions
      : [restored, ...sessions]

  return (
    <Collapsible
      className="roster__archived border-t border-border/60 py-3"
      onOpenChange={setOpen}
      open={open}
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 px-4 py-1 text-left type-body text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight
          aria-hidden="true"
          className="size-(--size-icon-inline) shrink-0 transition-transform group-data-[panel-open]:rotate-90"
        />
        <span>Archived</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {isLoading ? (
          <div aria-label="Reading archived Sessions" className="px-4 py-2" role="status">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {error !== null ? (
          <Alert
            className="mx-1 border-destructive/50 bg-destructive/10"
            data-state={sessionFailureState(error.code)}
            variant="destructive"
          >
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Unable to load archived Sessions</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}
        {!isLoading && error === null && displayed.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">No archived Sessions</p>
        ) : null}
        {displayed.length > 0 ? rows(displayed, 'Archived') : null}
        {hasNextPage ? <LoadMoreSentinel onVisible={fetchNextPage} /> : null}
        {isFetchingNextPage ? (
          <div aria-label="Loading more archived Sessions" className="px-4 py-2" role="status">
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}
