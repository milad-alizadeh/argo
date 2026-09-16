// The fixture half of the packaged Session proof: the disk state `feed.e2e.ts` launches
// the app against, and the two mutations that prove a re-read reaches the file system rather than
// a cache. Split out of that file to stay under the per-file line ceiling (AGENTS.md).
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pointShellOutputAtRoot } from '../../../mocks/sessions/shell.fixture'
import {
  CODEX_FIXTURES,
  fixturePath,
  proofCwd,
  proofProject,
  writeArchiveStore,
  writeFixtureTree,
} from '../../../mocks/sessions/mock-transcript-files'
import { packagedTestCopy } from '../../packaged-app'

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
  // Two background Shells, one still running and one the CLI already notified about (#1582).
  'shellRunning',
  // One Subagent with a transcript of its own beside the Session's file, whose Feed the header
  // opens in the inspector beside the Session's (#1582).
  'subagentTail',
]
export const CODEX_FIXTURE_NAMES = ['rollout-codexParent', 'rollout-codexChild']

// The Sessions the fixture store says the reader archived.
const ARCHIVED = ['plannedWork']

// A Session the desktop app already tracks but has not archived (#2194): its store row exists so
// a bulk-archive round trip has a real file to flip, the way the write only ever mutates a row the
// app already wrote rather than inventing one.
const TRACKED_UNARCHIVED = ['harnessNoise']

// A directory for a person's own screenshots. The Playwright test runner owns `process.argv`, so
// this reads an environment variable rather than a flag: `ARGO_SESSION_SHOTS=<dir> bunx playwright test`.
export const shots = process.env.ARGO_SESSION_SHOTS ?? null

// One more turn on a Session already measured, written the way the CLI writes one: appended to
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

export async function prepare(root) {
  const application = await packagedTestCopy(root)
  const claudeTranscripts = path.join(root, 'claude-transcripts')
  const codexTranscripts = path.join(root, 'codex-transcripts')
  await writeFixtureTree(claudeTranscripts, FIXTURES, { inProofProject: true })
  await pointShellOutputAtRoot(claudeTranscripts, root)
  await writeFixtureTree(codexTranscripts, CODEX_FIXTURE_NAMES, {
    directory: '2026/09/10',
    fixtures: CODEX_FIXTURES,
    inProofProject: true,
  })
  const archive = path.join(root, 'archive')
  await writeArchiveStore(archive, ARCHIVED)
  await writeArchiveStore(archive, TRACKED_UNARCHIVED, { archived: false })
  const userData = path.join(root, 'userData')
  await mkdir(userData, { recursive: true })
  const project = proofProject(claudeTranscripts)
  await mkdir(project)
  await mkdir(path.join(userData, 'portable-v1'), { recursive: true })
  // No Project is selected yet, so the first case sees the cockpit with none (#2307).
  await writeProjectStore(userData, project, null)
  return { application, claudeTranscripts, codexTranscripts, archive, userData, project }
}

const PROOF_PROJECT_ID = 'session-proof-project'

async function writeProjectStore(userData, project, selectedId) {
  await writeFile(
    path.join(userData, 'portable-v1', 'projects.json'),
    JSON.stringify({
      version: 1,
      projects: [{ id: PROOF_PROJECT_ID, path: project, bindings: [] }],
      selectedId,
    }),
  )
}

// Written to the store rather than picked in the switcher, whose choice a restart does not keep.
export async function selectProofProject(userData, project) {
  await writeProjectStore(userData, project, PROOF_PROJECT_ID)
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

// The packaged visual evidence. The window is shown from here rather than by the app, so every
// contract case above still runs against the same hidden window the other proofs use.
export async function capture(page, application, name) {
  if (shots === null) return
  await mkdir(shots, { recursive: true })
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show())
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(shots, name) })
}
