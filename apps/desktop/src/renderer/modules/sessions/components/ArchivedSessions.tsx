import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/renderer/components/ui/collapsible'
import type { SessionId, SessionsListed } from '../types'

export function ArchivedSessions({
  archived,
  rows,
  selectedSessionId,
}: {
  archived: SessionsListed['sessions']
  rows: (sessions: SessionsListed['sessions'], label: string) => ReactNode
  selectedSessionId: SessionId | null
}) {
  const includesSelectedSession = archived.some((session) => session.id === selectedSessionId)
  const [open, setOpen] = useState(includesSelectedSession)

  useEffect(() => {
    if (includesSelectedSession) setOpen(true)
  }, [includesSelectedSession])

  if (archived.length === 0) return null

  return (
    <Collapsible className="border-t border-border/60 py-3" onOpenChange={setOpen} open={open}>
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 px-4 py-1 text-left type-body text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight
          aria-hidden="true"
          className="size-(--size-icon-inline) shrink-0 transition-transform group-data-[panel-open]:rotate-90"
        />
        <span>Archived {archived.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">{rows(archived, 'Archived')}</CollapsibleContent>
    </Collapsible>
  )
}
