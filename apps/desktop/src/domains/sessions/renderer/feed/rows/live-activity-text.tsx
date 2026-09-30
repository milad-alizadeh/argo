import { useTranslation } from 'react-i18next'
import { displayedToolLabel } from '@/domains/sessions/api/feed'
import { RunningText } from '@/platform/renderer/components/running-text'
import type { SessionActivity } from '../../types'
import { FeedInlineMarkdown } from '../content/feed-inline-markdown'

export type LiveActivity = {
  activity: Pick<SessionActivity, 'kind' | 'label' | 'open'> | null
  running: boolean
  // A compaction in progress outranks the activity: the Feed's compaction marker is the tail then.
  compacting?: boolean
}

// The one line that says what a Session is doing, read from the one fact (`Session.activity`):
// the roster draws it under the title, and the Feed draws it as the running Turn's group title.
// Both read "Running …" while the Session runs and the work is still open, and both read
// "Compacting conversation…" while it compacts. Null when the Session has nothing to say.
// `prose` marks the agent's own words, which are Markdown; a tool's label is literal.
export function useLiveActivityText({
  activity,
  running,
  compacting = false,
}: LiveActivity): { text: string; prose: boolean } | null {
  const { t } = useTranslation('sessions')
  if (compacting) return { text: t('marks.compacting'), prose: false }
  if (activity === null) return null
  const text = displayedToolLabel(activity, running && activity.open, t('workState.running'))
  return { text, prose: activity.kind === 'thought' }
}

export function LiveActivityWords({
  line,
  shimmering = false,
}: {
  line: { text: string; prose: boolean }
  shimmering?: boolean
}) {
  return line.prose ? <FeedInlineMarkdown shimmering={shimmering} text={line.text} /> : line.text
}

// Only the Feed shimmers, and it shimmers for as long as the Session runs: "Searched …" between
// two calls is still live.
export function LiveActivityText({
  shimmer = false,
  ...live
}: LiveActivity & { shimmer?: boolean }) {
  const line = useLiveActivityText(live)
  if (line === null) return null
  if (!shimmer) return <LiveActivityWords line={line} />
  return (
    <RunningText running={live.running}>
      <LiveActivityWords line={line} shimmering={live.running} />
    </RunningText>
  )
}
