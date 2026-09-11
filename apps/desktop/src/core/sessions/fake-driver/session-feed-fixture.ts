// The fixture half of the packaged Session proof: the disk state `prove-session-feed.ts` launches
// the app against, and the two mutations that prove a re-read reaches the file system rather than
// a cache. Split out of that file to stay under the per-file line ceiling (AGENTS.md).
import { execFile } from 'node:child_process'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { packagedTestCopy } from '../../desktop-proof/packaged-test-copy'
import {
  CODEX_FIXTURES,
  fixturePath,
  writeArchiveStore,
  writeFixtureTree,
} from './session-fixture-files'

export const FIXTURES = [
  'resumeParent',
  'resumeChild',
  'externalBasic',
  'unparseableBody',
  'askPending',
  'prose',
  // Resumes a leaf that is in no file here, which is what a chain looks like when the Roster's
  // file cap stops short of its origin. Its row has to say so.
  'strandedResume',
  // Archived in the desktop app's store below, so the Roster has to keep it out of the list and
  // in the Archived section at its foot.
  'plannedWork',
]
export const CODEX_FIXTURE_NAMES = ['rollout-codexParent', 'rollout-codexChild']

// The Sessions the fixture store says the reader archived.
const ARCHIVED = ['plannedWork']

const shotsIndex = process.argv.indexOf('--shots')
export const shots = shotsIndex === -1 ? null : (process.argv[shotsIndex + 1] ?? null)

// One more turn on a Session already measured, written the way the CLI writes one: appended to
// the file it belongs to.
const GROWN_TURN = `${JSON.stringify({
  type: 'assistant',
  cwd: '/Users/x/stranded',
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

const git = promisify(execFile)

// A Project is the window's subject: with none open the cockpit shows the gate and no surface is
// reachable, so the proof registers one before it launches. The folder is a real repository
// because opening a Project is what proves it is one.
async function selectedProject(root) {
  const projectPath = path.join(root, 'project')
  await mkdir(projectPath, { recursive: true })
  await git('git', ['-C', projectPath, 'init', '--quiet'])
  const userData = path.join(root, 'userData')
  await mkdir(path.join(userData, 'portable-v1'), { recursive: true })
  await writeFile(
    path.join(userData, 'portable-v1', 'projects.json'),
    `${JSON.stringify({
      version: 1,
      projects: [{ id: 'project-1', path: projectPath }],
      selectedId: 'project-1',
    })}\n`,
  )
  return { userData, projectPath }
}

export async function growStranded(transcripts) {
  await appendFile(fixturePath(transcripts, 'strandedResume'), GROWN_TURN)
}

export async function appendProse(transcripts, uuid, text) {
  await appendFile(
    fixturePath(transcripts, 'prose'),
    `${JSON.stringify({
      type: 'assistant',
      cwd: '/Users/x/prose',
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
    before.replace(/"text":"(?:[^"\\]|\\.)*"/, `"text":${JSON.stringify(text)}`),
  )
}

export async function prepare(root) {
  const application = await packagedTestCopy(root)
  const claudeTranscripts = path.join(root, 'claude-transcripts')
  const codexTranscripts = path.join(root, 'codex-transcripts')
  await writeFixtureTree(claudeTranscripts, FIXTURES)
  await writeFixtureTree(codexTranscripts, CODEX_FIXTURE_NAMES, {
    directory: '2026/09/10',
    fixtures: CODEX_FIXTURES,
  })
  const archive = path.join(root, 'archive')
  await writeArchiveStore(archive, ARCHIVED)
  const { userData, projectPath } = await selectedProject(root)
  return { application, claudeTranscripts, codexTranscripts, archive, userData, projectPath }
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

// The sidebar exists because the fixture opened a Project, and Sessions is reached through it
// rather than by assuming the opening destination. Everything below reads the Roster and the Feed
// off that screen.
export async function openSessionsScreen(page) {
  await page.click('nav[aria-label="Surfaces"] button:has-text("Sessions")')
  await page.waitForSelector('nav[aria-label="Sessions"] button')
}
