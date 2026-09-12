import { useEffect, useState } from 'react'

import { hasRunningBackgroundWork } from '../../../../core/sessions/background-work'
import type { Session, SessionFeed } from '../types'

const ROSTER_QUERY = '(max-width: 1023px)'
const INSPECTOR_QUERY = '(max-width: 687px)'

function useBreakpoint(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

export function sessionPageState({
  selected,
  feed,
  failure,
  feedFailure,
  loading,
  sessionCount,
}: {
  selected: Session | null
  feed: SessionFeed | null
  failure: string | null
  feedFailure: string | null
  loading: boolean
  sessionCount: number
}): string {
  if (loading) return 'loading'
  if (failure !== null) return 'roster-error'
  if (sessionCount === 0) return 'no-sessions'
  if (feedFailure !== null) return 'feed-error'
  if (feed !== null && feed.rows.length === 0) return 'blank'
  if (selected?.posture === 'external') return 'read-only'
  if (selected?.posture === 'orphaned') return 'orphaned'
  return selected?.status ?? 'unselected'
}

export function inspectorIsAvailable(session: Session | null): boolean {
  return session !== null && hasRunningBackgroundWork(session)
}

function inspectorStartsOpen(session: Session | null): boolean {
  return (
    session?.status === 'starting' ||
    session?.status === 'running' ||
    session?.status === 'permission' ||
    session?.status === 'asking'
  )
}

export function useSessionPanels(selected: Session | null) {
  const narrowRoster = useBreakpoint(ROSTER_QUERY)
  const foldedInspector = useBreakpoint(INSPECTOR_QUERY)
  const [rosterOpen, setRosterOpen] = useState(() => !window.matchMedia(ROSTER_QUERY).matches)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  useEffect(() => setRosterOpen(!narrowRoster), [narrowRoster])
  useEffect(() => setInspectorOpen(inspectorStartsOpen(selected)), [selected])

  const inspectorAvailable = inspectorIsAvailable(selected)
  const inspectorVisible = inspectorAvailable && inspectorOpen && !foldedInspector
  return {
    narrowRoster,
    rosterOpen,
    setRosterOpen,
    inspectorAvailable,
    inspectorVisible,
    setInspectorOpen,
  }
}

export function inspectorState(available: boolean, visible: boolean): string {
  if (!available) return 'absent'
  return visible ? 'open' : 'collapsed'
}

export function rosterState(narrow: boolean, open: boolean): string {
  if (!open) return 'closed'
  return narrow ? 'open' : 'docked'
}
