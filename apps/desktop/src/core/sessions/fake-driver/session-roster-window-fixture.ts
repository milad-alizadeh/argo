// Filler Sessions for the packaged pagination proof (#2239): enough of them, all older than every
// other fixture, to push the roster's bounded window past ROSTER_PAGE_SIZE.
import { stat, utimes, writeFile } from 'node:fs/promises'
import { fixturePath } from './session-fixture-files'

// The packaged app's main process reads each file's mtime from its own `stat` call, in a
// separate OS process from the one that just called `utimes` here. On a slow disk that write can
// still be in flight when the app reads it, so this waits for a `stat` in THIS process to observe
// the backdated time before returning, rather than trusting `utimes`'s own resolved promise.
async function utimesSettled(file: string, at: Date) {
  await utimes(file, at, at)
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if ((await stat(file)).mtime.getTime() === at.getTime()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

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
    await utimesSettled(file, new Date(writtenAt))
  }
}
