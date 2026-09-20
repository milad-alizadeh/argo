import { useTranslation } from 'react-i18next'
import type { SessionActivity } from '@/domains/sessions/contract/model/models'
import { displayedToolLabel } from '@/domains/sessions/contract/model/tool-feed'
import { RunningText } from '@/domains/sessions/renderer/feed/feed-tool-status'

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
export function useLiveActivityText({ activity, running, compacting = false }: LiveActivity) {
  const { t } = useTranslation('sessions')
  if (compacting) return t('marks.compacting')
  if (activity === null) return null
  return displayedToolLabel(activity, running && activity.open, t('workState.running'))
}

// Only the Feed shimmers, and it shimmers for as long as the Session runs: "Searched …" between
// two calls is still live.
export function LiveActivityText({
  shimmer = false,
  ...live
}: LiveActivity & { shimmer?: boolean }) {
  const text = useLiveActivityText(live)
  if (text === null) return null
  if (!shimmer) return <>{text}</>
  return <RunningText running={live.running}>{text}</RunningText>
}
