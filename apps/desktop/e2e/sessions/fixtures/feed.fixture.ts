// The disk state every packaged Session case launches the app against, and the mutations that
// prove a re-read reaches the file system rather than a cache.
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pointShellOutputAtRoot } from '../../../mocks/sessions/mock-shell-output'
import {
  CODEX_FIXTURES,
  fixturePath,
  proofCwd,
  proofProject,
  writeArchiveStore,
  writeFixtureTree,
} from '../../../mocks/sessions/mock-transcript-files'
import { createProjectStore } from '../../../src/domains/projects/main/sqlite-store'
import { sharedDatabasePath } from '../../../src/platform/main/storage/shared-database'
import { makeProjectLocallyReady } from '../../projects/fixtures/locally-ready-project'

export const FIXTURES = [
  'resumeParent',
  'resumeChild',
  'externalBasic',
  'unparseableBody',
  'askPending',
  'prose',
  'toolCalls',
  // Resumes a leaf that is in no file here, which is what a chain looks like when the Roster's
  // file cap stops short of its origin. Its row has to say so.
  'strandedResume',
  // Archived in the desktop app's store below, so the Roster has to keep it out of the list and
  // in the Archived section at its foot.
  'plannedWork',
  // Names a Model, Effort and Mode the composer has to state.
  'setupAnswered',
  // Current Claude harness records: the first visible name must be the reconstructed command.
  'harnessNoise',
  // Two background Shells, one still running and one the Harness already notified about (#1582).
  'shellRunning',
  // One Subagent with a transcript of its own beside the Session's file, whose Feed the header
  // opens in the inspector beside the Session's (#1582).
  'subagentTail',
]
export const CODEX_FIXTURE_NAMES = ['rollout-codexParent', 'rollout-codexChild']

// The Sessions Argo's own archive document says the reader archived.
const ARCHIVED = ['plannedWork']

// One more turn on a Session already measured, written the way the Harness writes one: appended to
// the file it belongs to.
const grownTurn = (transcripts) =>
  `${JSON.stringify({
    type: 'assistant',
    cwd: proofCwd(transcripts, 'stranded'),
    gitBranch: 'main',
    timestamp: '2026-08-20T09:30:00.000Z',
    uuid: 'sr-asst-2',
    parentUuid: 'sr-asst-1',
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'And one more turn, written while Argo was looking.' }],
    },
  })}\n`

export async function growStranded(transcripts) {
  await appendFile(fixturePath(transcripts, 'strandedResume'), grownTurn(transcripts))
}

export async function removeProse(transcripts) {
  await rm(fixturePath(transcripts, 'prose'))
}

export async function appendProse(transcripts, uuid, text) {
  await appendFile(
    fixturePath(transcripts, 'prose'),
    `${JSON.stringify({
      type: 'assistant',
      cwd: proofCwd(transcripts, 'prose'),
      timestamp: '2026-07-21T09:31:00.000Z',
      uuid,
      parentUuid: 'p-turn-3',
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text }],
      },
    })}\n`,
  )
}

// Claude can add to a message while its Turn is still running. The projected row keeps its id,
// but its prose and height change, which is the live Result case ADR-0033 rule 5 calls out.
export async function streamProse(transcripts, text) {
  const transcript = fixturePath(transcripts, 'prose')
  const before = await readFile(transcript, 'utf8')
  await writeFile(
    transcript,
    before.replace(/"text":\s*"(?:[^"\\]|\\.)*"/, `"text": ${JSON.stringify(text)}`),
  )
}

// The Roster shows only for a selected Project (#2307), so only the empty-window case leaves it unset.
export async function prepare(root, application, { projectSelected }) {
  const claudeTranscripts = path.join(root, 'claude-transcripts')
  const codexTranscripts = path.join(root, 'codex-transcripts')
  await writeFixtureTree(claudeTranscripts, FIXTURES, { inProofProject: true })
  await pointShellOutputAtRoot(claudeTranscripts, root)
  await writeFixtureTree(codexTranscripts, CODEX_FIXTURE_NAMES, {
    directory: '2026/09/10',
    fixtures: CODEX_FIXTURES,
    inProofProject: true,
  })
  const userData = path.join(root, 'userData')
  await mkdir(userData, { recursive: true })
  await writeArchiveStore(userData, ARCHIVED)
  const project = proofProject(claudeTranscripts)
  await mkdir(project)
  await makeProjectLocallyReady(project)
  await writeProjectStore(userData, project, projectSelected ? PROOF_PROJECT_ID : null)
  return { application, claudeTranscripts, codexTranscripts, userData, project }
}

const PROOF_PROJECT_ID = 'session-proof-project'

async function writeProjectStore(userData, project, selectedId) {
  const projects = createProjectStore(new DatabaseSync(sharedDatabasePath(userData)))
  projects.replace({
    projects: [
      { id: PROOF_PROJECT_ID, path: project, commonDirectory: path.join(project, '.git') },
    ],
    selectedId,
  })
  projects.close()
}

export async function growCodexTranscript(transcripts) {
  await appendFile(
    path.join(transcripts, '2026', '09', '10', 'rollout-codexParent.jsonl'),
    `${JSON.stringify({
      timestamp: '2099-01-01T00:00:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'agent_message',
        thread_id: 'rollout-codexParent',
        item: {
          type: 'AgentMessage',
          id: 'live-codex-message',
          content: [{ type: 'text', text: 'The Codex transcript changed while Argo was open.' }],
        },
      },
    })}\n`,
  )
}
