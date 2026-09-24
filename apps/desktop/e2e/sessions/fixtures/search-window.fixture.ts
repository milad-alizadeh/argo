// A buried Session for the packaged search proof (#2375): older than enough filler Sessions to
// sit outside the SessionList's bounded window, findable only if search reaches the full indexed
// history rather than filtering what the SessionList already loaded.
import { utimes, writeFile } from 'node:fs/promises'
import { fixturePath } from '../../../mocks/sessions/mock-transcript-files'
import { WINDOW_FILLER_COUNT } from './session-list-window.fixture'

export const BURIED_SEARCH_TARGET_ID = 'buriedSearchTarget'
export const BURIED_SEARCH_TITLE = 'Unearthed plan for the quarry expansion'

// One tick older than the oldest window filler (`windowFiller<COUNT - 1>`), so this Session is
// never inside the first bounded window either.
export async function writeBuriedSearchTarget(transcripts: string, cwd: string) {
  const base = Date.parse('2020-01-01T00:00:00.000Z')
  const writtenAt = new Date(base - WINDOW_FILLER_COUNT * 60_000).toISOString()
  const file = fixturePath(transcripts, BURIED_SEARCH_TARGET_ID)
  const lines = [
    {
      type: 'user',
      cwd,
      timestamp: writtenAt,
      uuid: `${BURIED_SEARCH_TARGET_ID}-u`,
      parentUuid: null,
      message: { role: 'user', content: [{ type: 'text', text: BURIED_SEARCH_TITLE }] },
    },
    {
      type: 'assistant',
      cwd,
      timestamp: writtenAt,
      uuid: `${BURIED_SEARCH_TARGET_ID}-a`,
      parentUuid: `${BURIED_SEARCH_TARGET_ID}-u`,
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Found it.' }],
      },
    },
  ]
  await writeFile(file, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`)
  await utimes(file, new Date(writtenAt), new Date(writtenAt))
}
