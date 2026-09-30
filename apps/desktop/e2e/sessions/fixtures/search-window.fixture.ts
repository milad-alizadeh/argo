// A buried Session for the packaged search proof (#2375): older than enough filler Sessions to
// sit outside the Roster's bounded window, findable only if search reaches the full indexed
// history rather than filtering what the Roster already loaded.
import { WINDOW_FILLER_COUNT, writePromptedTranscript } from './roster-window.fixture'

export const BURIED_SEARCH_TARGET = 'buriedSearchTarget'
export const BURIED_SEARCH_TITLE = 'Unearthed plan for the quarry expansion'

// One tick older than the oldest window filler (`windowFiller<COUNT - 1>`), so this Session is
// never inside the first bounded window either.
export async function writeBuriedSearchTarget(transcripts: string, cwd: string) {
  const base = Date.parse('2020-01-01T00:00:00.000Z')
  await writePromptedTranscript(transcripts, cwd, {
    id: BURIED_SEARCH_TARGET,
    writtenAt: new Date(base - WINDOW_FILLER_COUNT * 60_000).toISOString(),
    prompt: BURIED_SEARCH_TITLE,
    reply: 'Found it.',
  })
}
