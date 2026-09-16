import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixturePath, proofCwd } from '../../../mocks/sessions/mock-transcript-files'
import { sessionArchivePath } from '../../../src/core/storage/session-archive'

function transcriptRecord(transcripts, { id, prompt, timestamp, uuid }) {
  return `${JSON.stringify({
    type: 'user',
    session_id: id,
    cwd: proofCwd(transcripts, 'order'),
    timestamp,
    uuid,
    parentUuid: null,
    message: { role: 'user', content: prompt },
  })}\n`
}

async function addReplacementChild(transcripts) {
  const link = JSON.stringify({ type: 'last-prompt', leafUuid: 'replacement-parent-answer' })
  const prompt = transcriptRecord(transcripts, {
    id: 'replacementParent',
    prompt: 'Continue replacement work',
    timestamp: '2098-02-01T00:00:00.000Z',
    uuid: 'replacement-child-prompt',
  })
  await writeFile(fixturePath(transcripts, 'replacementChild'), `${link}\n${prompt}`)
}

async function addReplacementParent(transcripts) {
  const prompt = transcriptRecord(transcripts, {
    id: 'replacementParent',
    prompt: 'Start replacement work',
    timestamp: '2097-01-01T00:00:00.000Z',
    uuid: 'replacement-parent-prompt',
  })
  const answer = JSON.stringify({
    type: 'assistant',
    session_id: 'replacementParent',
    cwd: proofCwd(transcripts, 'order'),
    timestamp: '2097-01-01T00:00:01.000Z',
    uuid: 'replacement-parent-answer',
    parentUuid: 'replacement-parent-prompt',
    message: { role: 'assistant', stop_reason: 'end_turn', content: 'Ready.' },
  })
  await writeFile(fixturePath(transcripts, 'replacementParent'), `${prompt}${answer}\n`)
}

async function addRecentSession(transcripts) {
  const sessions = [
    {
      id: 'newSession',
      prompt: 'A newly discovered Session',
      timestamp: '2099-01-01T00:00:00.000Z',
      uuid: 'new-session-prompt',
    },
    {
      id: 'newSessionTwo',
      prompt: 'Another newly discovered Session',
      timestamp: '2100-01-01T00:00:00.000Z',
      uuid: 'new-session-two-prompt',
    },
  ]
  await Promise.all(
    sessions.map((session) =>
      writeFile(fixturePath(transcripts, session.id), transcriptRecord(transcripts, session)),
    ),
  )
}

// The running app reads Argo's own archive document on every Roster poll, so a mutation here is
// what a second Argo window archiving the Session would leave behind (#2315).
async function setArchived(userData, sessionId, archived) {
  const file = sessionArchivePath(userData)
  await mkdir(path.dirname(file), { recursive: true })
  const held = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'))
  if (archived) held[sessionId] = { archivedAt: '2026-09-02T00:00:00.000Z' }
  else delete held[sessionId]
  await writeFile(file, `${JSON.stringify(held, null, 2)}\n`)
}

async function updateProseRoster(transcripts) {
  const title = JSON.stringify({ type: 'custom-title', customTitle: 'Prose renamed in place' })
  const answer = JSON.stringify({
    type: 'assistant',
    cwd: proofCwd(transcripts, 'prose'),
    timestamp: '2098-01-01T00:00:00.000Z',
    uuid: 'p-renamed',
    parentUuid: 'p-turn-3',
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'The title changed.' },
        {
          type: 'tool_use',
          id: 'read-order',
          name: 'Read',
          input: { file_path: '/Users/x/order.ts' },
        },
      ],
    },
  })
  await appendFile(fixturePath(transcripts, 'prose'), `${title}\n${answer}\n`)
}

export function rosterOrderMutations({ userData, transcripts }) {
  return {
    update: () => updateProseRoster(transcripts),
    addReplacementChild: () => addReplacementChild(transcripts),
    addReplacementParent: () => addReplacementParent(transcripts),
    addRecent: () => addRecentSession(transcripts),
    removeRecent: () =>
      Promise.all([
        rm(fixturePath(transcripts, 'newSession')),
        rm(fixturePath(transcripts, 'newSessionTwo')),
      ]),
    archive: (sessionId, archived) => setArchived(userData, sessionId, archived),
  }
}
