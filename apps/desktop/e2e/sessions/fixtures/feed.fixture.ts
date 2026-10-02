// The disk state every packaged Session case launches the app against, and the mutations that
// prove a re-read reaches the file system rather than a cache.
import { appendFile, mkdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { claudeConfigDirectory } from '../../../mocks/cli/claude/mock-claude-transcripts'
import { writeCodexThreads } from '../../../mocks/sessions/mock-codex-thread-files'
import {
  fixturePath,
  fixtureSessionId,
  proofCwd,
  proofProject,
  writeFixtureTree,
} from '../../../mocks/sessions/mock-transcript-files'
import { makeProjectLocallyReady } from '../../projects/fixtures/locally-ready-project'
import { repository, seedSingleProject } from '../../projects/fixtures/project.fixture'
import { claudeSessionMessages } from '../real-harness/claude-vendor-reader'

export const FIXTURES = [
  'resumeParent',
  'resumeChild',
  '11111111-2222-4333-8444-555555555555',
  'unparseableBody',
  'askPending',
  'prose',
  // Resumes a leaf that is in no file here, which is what a chain looks like when the Session List's
  // file cap stops short of its origin. Its row has to say so.
  'strandedResume',
  // Archived once the app lists it, so the Session List has to keep it out of the list and in the
  // Archived section at its foot.
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

// The Sessions the reader archived before the case begins.
export const ARCHIVED_FIXTURES = ['plannedWork']

// One more turn on a Session already measured, written the way the Harness writes one: appended to
// the file it belongs to.
const grownTurn = (transcripts: string) =>
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

export async function growStranded(transcripts: string) {
  await appendFile(fixturePath(transcripts, 'strandedResume'), grownTurn(transcripts))
}

// The Harness reads a transcript as the parent chain from its newest record, so each append extends
// it. The Agent SDK's reader names that record.
async function newestRecord(transcripts: string, name: string) {
  const messages = await claudeSessionMessages(
    claudeConfigDirectory(transcripts),
    fixtureSessionId(name),
  )
  return messages.at(-1)?.uuid ?? null
}

export async function appendProse(transcripts: string, uuid: string, text: string) {
  const transcript = fixturePath(transcripts, 'prose')
  await appendFile(
    transcript,
    `${JSON.stringify({
      type: 'assistant',
      cwd: proofCwd(transcripts, 'prose'),
      timestamp: '2026-07-21T09:31:00.000Z',
      uuid,
      parentUuid: await newestRecord(transcripts, 'prose'),
      message: {
        role: 'assistant',
        stop_reason: 'end_turn',
        content: [{ type: 'text', text }],
      },
    })}\n`,
  )
}

// The Session List shows only for a selected Project (#2307), so only the empty-window case leaves it unset.
export async function prepare(
  root: string,
  application: string,
  { projectSelected }: { projectSelected: boolean },
) {
  // The Harnesses record a working directory with its links resolved, so every path here is too.
  const base = await realpath(root)
  const claudeTranscripts = path.join(base, 'claude-config', 'projects')
  const codexTranscripts = path.join(base, 'codex-home', 'sessions')
  await writeFixtureTree(claudeTranscripts, FIXTURES)
  await mkdir(codexTranscripts, { recursive: true })
  await writeCodexThreads(root, codexTranscripts)
  const userData = path.join(root, 'userData')
  await mkdir(userData, { recursive: true })
  const project = proofProject(claudeTranscripts)
  await repository(project)
  await makeProjectLocallyReady(project)
  if (projectSelected) seedProject(userData, project)
  return {
    application,
    claudeTranscripts,
    codexTranscripts,
    userData,
    project,
  }
}

const PROOF_PROJECT_ID = 'session-proof-project'

function seedProject(userData: string, project: string) {
  seedSingleProject(userData, { id: PROOF_PROJECT_ID, path: project })
}
