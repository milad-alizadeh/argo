// Filler Sessions for the packaged pagination proof (#2239): enough of them, all older than every
// other fixture, to push the roster's bounded window past ROSTER_PAGE_SIZE. Kept apart from
// `feed.fixture.ts` so that file's own line count stays put.
import { utimes, writeFile } from 'node:fs/promises'
import { fixturePath } from '../../../mocks/sessions/mock-transcript-files'

// One more than ROSTER_PAGE_SIZE, so the first Roster page always leaves at least one of these
// unread and the last one always sits outside it.
export const WINDOW_FILLER_COUNT = 51
export const FARTHEST_WINDOW_FILLER_ID = `windowFiller${WINDOW_FILLER_COUNT - 1}`

// Written oldest-writes-last so `windowFiller0` is the most recently touched of the set and
// `windowFiller<COUNT - 1>` the oldest, mirroring the recency order the Roster reads by.
export async function writeWindowFillerSessions(transcripts: string, cwd: string) {
  const base = Date.parse('2020-01-01T00:00:00.000Z')
  for (let index = 0; index < WINDOW_FILLER_COUNT; index += 1) {
    const id = `windowFiller${index}`
    const writtenAt = new Date(base - index * 60_000).toISOString()
    const file = fixturePath(transcripts, id)
    await writeFile(
      file,
      `${JSON.stringify({
        type: 'assistant',
        cwd,
        timestamp: writtenAt,
        uuid: `${id}-a`,
        parentUuid: null,
        message: {
          role: 'assistant',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Filler.' }],
        },
      })}\n`,
    )
    await utimes(file, new Date(writtenAt), new Date(writtenAt))
  }
}
