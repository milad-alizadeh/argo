import { appendFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixturePath } from '../../../mocks/sessions/transcript-files'

function transcriptRecord({ id, prompt, timestamp, uuid }) {
  return `${JSON.stringify({
    type: 'user',
    session_id: id,
    cwd: '/Users/x/order',
    timestamp,
    uuid,
    parentUuid: null,
    message: { role: 'user', content: prompt },
  })}\n`
}

async function addReplacementChild(transcripts) {
  const link = JSON.stringify({ type: 'last-prompt', leafUuid: 'replacement-parent-answer' })
  const prompt = transcriptRecord({
    id: 'replacementParent',
    prompt: 'Continue replacement work',
    timestamp: '2098-02-01T00:00:00.000Z',
    uuid: 'replacement-child-prompt',
  })
  await writeFile(fixturePath(transcripts, 'replacementChild'), `${link}\n${prompt}`)
}

async function addReplacementParent(transcripts) {
  const prompt = transcriptRecord({
    id: 'replacementParent',
    prompt: 'Start replacement work',
    timestamp: '2097-01-01T00:00:00.000Z',
    uuid: 'replacement-parent-prompt',
  })
  const answer = JSON.stringify({
    type: 'assistant',
    session_id: 'replacementParent',
    cwd: '/Users/x/order',
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
      writeFile(fixturePath(transcripts, session.id), transcriptRecord(session)),
    ),
  )
}

async function setArchived(archive, sessionId, archived) {
  await writeFile(
    path.join(archive, 'workspace-one', 'project-one', `local_${sessionId}.json`),
    `${JSON.stringify({
      sessionId: `desktop-${sessionId}`,
      cliSessionId: sessionId,
      isArchived: archived,
    })}\n`,
  )
}

async function updateProseRoster(transcripts) {
  const title = JSON.stringify({ type: 'custom-title', customTitle: 'Prose renamed in place' })
  const answer = JSON.stringify({
    type: 'assistant',
    cwd: '/Users/x/prose',
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

export function rosterOrderMutations({ archive, transcripts }) {
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
    archive: (sessionId, archived) => setArchived(archive, sessionId, archived),
  }
}
