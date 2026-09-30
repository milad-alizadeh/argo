// Filler Sessions for the packaged pagination proof (#2239): enough of them, all older than every
// other fixture, to push the Session List's bounded window past its first page. Kept apart from
// `feed.fixture.ts` so that file's own line count stays put.
import { utimes, writeFile } from 'node:fs/promises'
import { newFixturePath } from '../../../mocks/sessions/mock-transcript-files'

// One more than a page, so the first Session List page always leaves at least one of these
// unread and the last one always sits outside it.
export const WINDOW_FILLER_COUNT = 51
export const FARTHEST_WINDOW_FILLER = `windowFiller${WINDOW_FILLER_COUNT - 1}`

// One prompt and its reply, dated `writtenAt`: the Harness lists a transcript only once it holds a prompt.
export async function writePromptedTranscript(
  transcripts: string,
  cwd: string,
  session: { id: string; writtenAt: string; prompt: string; reply: string },
) {
  const { id, writtenAt, prompt, reply } = session
  const file = await newFixturePath(transcripts, id, cwd)
  const lines = [
    {
      type: 'user',
      cwd,
      timestamp: writtenAt,
      uuid: `${id}-u`,
      parentUuid: null,
      message: { role: 'user', content: [{ type: 'text', text: prompt }] },
    },
    {
      type: 'assistant',
      cwd,
      timestamp: writtenAt,
      uuid: `${id}-a`,
      parentUuid: `${id}-u`,
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: reply }],
      },
    },
  ]
  await writeFile(file, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`)
  await utimes(file, new Date(writtenAt), new Date(writtenAt))
}

// Written oldest-writes-last so `windowFiller0` is the most recently touched of the set and
// `windowFiller<COUNT - 1>` the oldest, mirroring the recency order the Session List reads by.
export async function writeWindowFillerSessions(transcripts: string, cwd: string) {
  const base = Date.parse('2020-01-01T00:00:00.000Z')
  for (let index = 0; index < WINDOW_FILLER_COUNT; index += 1) {
    await writePromptedTranscript(transcripts, cwd, {
      id: `windowFiller${index}`,
      writtenAt: new Date(base - index * 60_000).toISOString(),
      prompt: `Filler ${index}.`,
      reply: 'Filler.',
    })
  }
}
