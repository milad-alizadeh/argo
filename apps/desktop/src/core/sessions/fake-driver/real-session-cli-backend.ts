import { execFileSync } from 'node:child_process'
import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { findExecutableOnLoginShellPath } from '../../../agents/executable-path'
import type { SessionCli } from '../../../renderer/modules/sessions/harness/harnesses'
import { assistantAfterPrompt } from './real-session-transcript'
import type { SessionCliBackend, SessionFixture, SessionReply } from './session-cli-backend'

const BUDGET_MS = 180_000
const POLL_MS = 250
const CREDENTIALS: Record<SessionCli, { source: string[]; destination: string[] }> = {
  claude: { source: ['.claude.json'], destination: ['.claude.json'] },
  codex: { source: ['.codex', 'auth.json'], destination: ['.codex', 'auth.json'] },
}

type ExecutableFinder = (name: SessionCli) => string | null

function credentialPath(home: string, parts: string[]) {
  return path.join(home, ...parts)
}

export function resolveRealSessionExecutables(findExecutable: ExecutableFinder) {
  const executables = {} as Record<SessionCli, string>
  for (const cli of Object.keys(CREDENTIALS) as SessionCli[]) {
    const executable = findExecutable(cli)
    if (executable === null) throw new Error(`${cli} is not available on PATH.`)
    executables[cli] = executable
  }
  return executables
}

export async function prepareRealSessionHome(root: string, sourceHome: string) {
  const home = path.join(root, 'home')
  for (const cli of Object.keys(CREDENTIALS) as SessionCli[]) {
    const credential = CREDENTIALS[cli]
    const source = credentialPath(sourceHome, credential.source)
    const destination = credentialPath(home, credential.destination)
    try {
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(source, destination)
    } catch {
      const name = cli === 'claude' ? 'Claude' : 'Codex'
      throw new Error(`${name} authentication is unavailable: ${source} is missing.`)
    }
  }
  return home
}

function authenticationStatus(cli: SessionCli): string[] {
  return cli === 'claude' ? ['auth', 'status'] : ['login', 'status']
}

function verifyRealSessionAuthentication(executables: Record<SessionCli, string>, home: string) {
  for (const cli of Object.keys(CREDENTIALS) as SessionCli[]) {
    try {
      execFileSync(executables[cli], authenticationStatus(cli), {
        env: { ...process.env, HOME: home },
        stdio: 'ignore',
      })
    } catch {
      const name = cli === 'claude' ? 'Claude' : 'Codex'
      throw new Error(`${name} authentication is unavailable. Sign in and run e2e:real again.`)
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
    assistantAfterPrompt(transcriptFor(entry.cli), entry.prompt)

  return {
    name: 'real',
    budgetMs: BUDGET_MS,
    start: async ({ root }: { root: string; fixture: SessionFixture }) => {
      const executables = resolveRealSessionExecutables(findExecutable)
      const home = await prepareRealSessionHome(root, sourceHome)
      verifyAuthentication(executables, home)
      transcriptRoots.claude = path.join(home, '.claude', 'projects')
      transcriptRoots.codex = path.join(home, '.codex', 'sessions')
      return {
        executables,
        transcripts: null,
        launchEnv: () => ({ HOME: home }),
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
