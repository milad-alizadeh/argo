// The disk state every packaged Session case launches the app against, and the mutations that
// prove a re-read reaches the file system rather than a cache.
import { appendFile, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pointShellOutputAtRoot } from '../../../mocks/sessions/mock-shell-output'
import {
  fixturePath,
  fixtureSessionId,
  proofCwd,
  proofProject,
  writeFixtureTree,
} from '../../../mocks/sessions/mock-transcript-files'
import { makeProjectLocallyReady } from '../../projects/fixtures/locally-ready-project'
import { repository, seedSingleProject } from '../../projects/fixtures/project.fixture'

export const FIXTURES = [
  'resumeParent',
  'resumeChild',
  '11111111-2222-4333-8444-555555555555',
  'unparseableBody',
  'askPending',
  'prose',
  'toolCalls',
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

type CodexItem =
  | { id: string; type: 'userMessage'; content: { type: 'text'; text: string }[] }
  | { id: string; type: 'agentMessage'; text: string }

// One Codex thread the mock app-server lists and reads, in `thread/read`'s shape.
function codexThread(request: {
  name: string
  cwd: string
  updatedAt: string
  title: string
  turns: { id: string; prompt: string; reply: string }[]
}) {
  return {
    id: fixtureSessionId(request.name),
    cwd: request.cwd,
    updatedAt: Math.floor(Date.parse(request.updatedAt) / 1000),
    name: request.title,
    turns: request.turns.map((turn) => ({
      id: turn.id,
      status: 'completed',
      items: [
        {
          id: `${turn.id}-user`,
          type: 'userMessage',
          content: [{ type: 'text', text: turn.prompt }],
        },
        { id: `${turn.id}-assistant`, type: 'agentMessage', text: turn.reply },
      ] satisfies CodexItem[],
    })),
  }
}

export const CODEX_PARENT = 'codexParent'
export const CODEX_FIXTURES = [CODEX_PARENT, 'codexChild']

// The Codex threads the mock app-server starts with, in the state file its executable reads.
async function writeCodexThreads(root, codexTranscripts) {
  const cwd = proofCwd(codexTranscripts, 'codex')
  const threads = [
    codexThread({
      name: CODEX_PARENT,
      cwd,
      updatedAt: '2026-01-10T08:00:05.000Z',
      title: 'Run Codex check',
      turns: [{ id: 'turn-1', prompt: 'Run Codex check', reply: 'Checking...' }],
    }),
    codexThread({
      name: CODEX_FIXTURES[1],
      cwd,
      updatedAt: '2026-01-10T08:30:05.000Z',
      title: 'Continue the check',
      turns: [{ id: 'turn-2', prompt: 'Continue the check', reply: 'Continuing' }],
    }),
  ]
  await writeFile(path.join(root, 'codex-state.json'), JSON.stringify(threads))
}

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

// The Harness reads a transcript as the parent chain from its newest record, so each append extends it.
async function newestRecord(transcript) {
  const lines = (await readFile(transcript, 'utf8')).split('\n').filter((line) => line !== '')
  const uuids = lines.map((line) => JSON.parse(line).uuid).filter((uuid) => uuid !== undefined)
  return uuids.at(-1) ?? null
}

export async function appendProse(transcripts, uuid, text) {
  const transcript = fixturePath(transcripts, 'prose')
  await appendFile(
    transcript,
    `${JSON.stringify({
      type: 'assistant',
      cwd: proofCwd(transcripts, 'prose'),
      timestamp: '2026-07-21T09:31:00.000Z',
      uuid,
      parentUuid: await newestRecord(transcript),
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
  root,
  application,
  { projectSelected }: { projectSelected: boolean },
) {
  // The Harnesses record a working directory with its links resolved, so every path here is too.
  const base = await realpath(root)
  const claudeTranscripts = path.join(base, 'claude-config', 'projects')
  const codexTranscripts = path.join(base, 'codex-home', 'sessions')
  await writeFixtureTree(claudeTranscripts, FIXTURES)
  await pointShellOutputAtRoot(claudeTranscripts, root)
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

function seedProject(userData, project) {
  seedSingleProject(userData, { id: PROOF_PROJECT_ID, path: project })
}
