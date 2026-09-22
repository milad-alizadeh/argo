import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type { SessionHarness } from '../../../src/domains/sessions/renderer/harness/harnesses'
import { findExecutableOnLoginShellPath } from '../../../src/harnesses/executable-path'
import type {
  SessionFixture,
  SessionHarnessBackend,
  SessionReply,
} from '../session-harness-backend'
import { realClaudeCli } from './real-claude-harness'
import { realCodexCli } from './real-codex-harness'

const BUDGET_MS = 180_000
const POLL_MS = 250
const REAL_HARNESS_UNSET_ENV = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'ARGO_CLAUDE_TRANSCRIPTS',
  'ARGO_CODEX_TRANSCRIPTS',
  'ARGO_CLAUDE_ARCHIVE',
]
const REAL_HARNESSES = { claude: realClaudeCli, codex: realCodexCli }

type ExecutableFinder = (name: SessionHarness) => string | null

function credentialPath(home: string, parts: string[]) {
  return path.join(home, ...parts)
}

export function resolveRealSessionExecutables(findExecutable: ExecutableFinder) {
  const executables = {} as Record<SessionHarness, string>
  for (const harness of Object.keys(REAL_HARNESSES) as SessionHarness[]) {
    const executable = findExecutable(harness)
    if (executable === null) throw new Error(`${harness} is not available on PATH.`)
    executables[harness] = executable
  }
  return executables
}

export async function prepareRealSessionHome(root: string, sourceHome: string) {
  const home = path.join(root, 'home')
  for (const harness of Object.keys(REAL_HARNESSES) as SessionHarness[]) {
    const source = credentialPath(sourceHome, REAL_HARNESSES[harness].credential)
    const destination = credentialPath(home, REAL_HARNESSES[harness].credential)
    try {
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(source, destination)
    } catch {
      throw new Error(
        `${REAL_HARNESSES[harness].label} authentication is unavailable: ${source} is missing.`,
      )
    }
    for (const parts of REAL_HARNESSES[harness].linked) {
      const linked = credentialPath(home, parts)
      await mkdir(path.dirname(linked), { recursive: true })
      await symlink(credentialPath(sourceHome, parts), linked)
    }
    // A machine the Harness has run on holds this folder, and Argo reads its absence as unreachable (#2356).
    await mkdir(REAL_HARNESSES[harness].transcripts(home), { recursive: true })
  }
  return home
}

function verifyRealSessionAuthentication(
  executables: Record<SessionHarness, string>,
  home: string,
) {
  for (const harness of Object.keys(REAL_HARNESSES) as SessionHarness[]) {
    try {
      execFileSync(executables[harness], REAL_HARNESSES[harness].authentication, {
        env: Object.fromEntries(
          Object.entries({ ...process.env, HOME: home }).filter(
            ([name]) => !REAL_HARNESS_UNSET_ENV.includes(name),
          ),
        ),
        stdio: 'pipe',
      })
    } catch (error) {
      const output = error instanceof Error && 'stderr' in error ? String(error.stderr).trim() : ''
      throw new Error(
        `${REAL_HARNESSES[harness].label} authentication is unavailable. Sign in and run e2e:real again.${output ? `\n${output}` : ''}`,
      )
    }
  }
}

function replyKey({ harness, prompt }: SessionReply) {
  return `${harness}:${prompt}`
}

export function createRealSessionHarnessBackend(
  options: {
    findExecutable?: ExecutableFinder
    home?: string
    verifyAuthentication?: (executables: Record<SessionHarness, string>, home: string) => void
  } = {},
): SessionHarnessBackend {
  const findExecutable = options.findExecutable ?? findExecutableOnLoginShellPath
  const sourceHome = options.home ?? process.env.HOME ?? ''
  const transcriptRoots = {} as Record<SessionHarness, string>
  const observedSizes = new Map<string, number>()
  const verifyAuthentication = options.verifyAuthentication ?? verifyRealSessionAuthentication

  const transcriptFor = (harness: SessionHarness) => transcriptRoots[harness]
  const reply = (entry: SessionReply) =>
    REAL_HARNESSES[entry.harness].replyAfterPrompt(transcriptFor(entry.harness), entry.prompt)

  return {
    name: 'real',
    budgetMs: BUDGET_MS,
    start: async ({ root }: { root: string; fixture: SessionFixture }) => {
      const executables = resolveRealSessionExecutables(findExecutable)
      const home = await prepareRealSessionHome(root, sourceHome)
      verifyAuthentication(executables, home)
      for (const harness of Object.keys(REAL_HARNESSES) as SessionHarness[])
        transcriptRoots[harness] = REAL_HARNESSES[harness].transcripts(home)
      return {
        executables,
        transcripts: null,
        launchEnv: () => ({ HOME: home }),
        unsetEnv: REAL_HARNESS_UNSET_ENV,
      }
    },
    waitForReply: async (_page, entry) => {
      const deadline = Date.now() + BUDGET_MS
      const key = replyKey(entry)
      for (;;) {
        const matched = await reply(entry)
        if (matched !== null) {
          const before = observedSizes.get(key) ?? 0
          if (matched.size > before) return
        }
        if (Date.now() >= deadline) {
          throw new Error(
            `No assistant transcript record followed the ${entry.harness} prompt before timeout.`,
          )
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      }
    },
    replied: async (_page, entry) => {
      const matched = await reply(entry)
      if (matched !== null) observedSizes.set(replyKey(entry), matched.size)
      return matched !== null
    },
    recorded: async (entry) => (await reply(entry)) !== null,
  }
}
