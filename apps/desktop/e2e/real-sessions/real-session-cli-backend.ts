import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, symlink } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import type {
  SessionCliBackend,
  SessionFixture,
  SessionReply,
} from '../../mocks/sessions/session-cli-backend'
import { findExecutableOnLoginShellPath } from '../../src/agents/executable-path'
import type { SessionCli } from '../../src/renderer/modules/sessions/harness/harnesses'
import { realClaudeCli } from './real-claude-cli'
import { realCodexCli } from './real-codex-cli'

const BUDGET_MS = 180_000
const POLL_MS = 250
const REAL_CLI_UNSET_ENV = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'ARGO_CLAUDE_TRANSCRIPTS',
  'ARGO_CODEX_TRANSCRIPTS',
  'ARGO_CLAUDE_ARCHIVE',
]
const REAL_CLIS = { claude: realClaudeCli, codex: realCodexCli }

type ExecutableFinder = (name: SessionCli) => string | null

function credentialPath(home: string, parts: string[]) {
  return path.join(home, ...parts)
}

export function resolveRealSessionExecutables(findExecutable: ExecutableFinder) {
  const executables = {} as Record<SessionCli, string>
  for (const cli of Object.keys(REAL_CLIS) as SessionCli[]) {
    const executable = findExecutable(cli)
    if (executable === null) throw new Error(`${cli} is not available on PATH.`)
    executables[cli] = executable
  }
  return executables
}

export async function prepareRealSessionHome(root: string, sourceHome: string) {
  const home = path.join(root, 'home')
  for (const cli of Object.keys(REAL_CLIS) as SessionCli[]) {
    const source = credentialPath(sourceHome, REAL_CLIS[cli].credential)
    const destination = credentialPath(home, REAL_CLIS[cli].credential)
    try {
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(source, destination)
    } catch {
      throw new Error(
        `${REAL_CLIS[cli].label} authentication is unavailable: ${source} is missing.`,
      )
    }
    for (const parts of REAL_CLIS[cli].linked) {
      const linked = credentialPath(home, parts)
      await mkdir(path.dirname(linked), { recursive: true })
      await symlink(credentialPath(sourceHome, parts), linked)
    }
    // A machine the CLI has run on holds this folder, and Argo reads its absence as unreachable (#2356).
    await mkdir(REAL_CLIS[cli].transcripts(home), { recursive: true })
  }
  return home
}

function verifyRealSessionAuthentication(executables: Record<SessionCli, string>, home: string) {
  for (const cli of Object.keys(REAL_CLIS) as SessionCli[]) {
    try {
      execFileSync(executables[cli], REAL_CLIS[cli].authentication, {
        env: Object.fromEntries(
          Object.entries({ ...process.env, HOME: home }).filter(
            ([name]) => !REAL_CLI_UNSET_ENV.includes(name),
          ),
        ),
        stdio: 'pipe',
      })
    } catch (error) {
      const output = String((error as { stderr?: Buffer }).stderr ?? '').trim()
      throw new Error(
        `${REAL_CLIS[cli].label} authentication is unavailable. Sign in and run e2e:real again.${output ? `\n${output}` : ''}`,
      )
    }
  }
}

function replyKey({ cli, prompt }: SessionReply) {
  return `${cli}:${prompt}`
}

export function createRealSessionCliBackend(
  options: {
    findExecutable?: ExecutableFinder
    home?: string
    verifyAuthentication?: (executables: Record<SessionCli, string>, home: string) => void
  } = {},
): SessionCliBackend {
  const findExecutable = options.findExecutable ?? findExecutableOnLoginShellPath
  const sourceHome = options.home ?? process.env.HOME ?? ''
  const transcriptRoots = {} as Record<SessionCli, string>
  const observedSizes = new Map<string, number>()
  const verifyAuthentication = options.verifyAuthentication ?? verifyRealSessionAuthentication

  const transcriptFor = (cli: SessionCli) => transcriptRoots[cli]
  const reply = (entry: SessionReply) =>
    REAL_CLIS[entry.cli].replyAfterPrompt(transcriptFor(entry.cli), entry.prompt)

  return {
    name: 'real',
    budgetMs: BUDGET_MS,
    start: async ({ root }: { root: string; fixture: SessionFixture }) => {
      const executables = resolveRealSessionExecutables(findExecutable)
      const home = await prepareRealSessionHome(root, sourceHome)
      verifyAuthentication(executables, home)
      for (const cli of Object.keys(REAL_CLIS) as SessionCli[])
        transcriptRoots[cli] = REAL_CLIS[cli].transcripts(home)
      return {
        executables,
        transcripts: null,
        launchEnv: () => ({ HOME: home }),
        unsetEnv: REAL_CLI_UNSET_ENV,
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
            `No assistant transcript record followed the ${entry.cli} prompt before timeout.`,
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
