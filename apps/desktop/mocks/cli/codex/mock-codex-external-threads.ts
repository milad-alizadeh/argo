// Codex threads that another process runs, for the external Session poll tests: a real
// `CODEX_HOME` whose writer locks a child process holds, real rollout files, and a stand-in
// app-server request that answers with the recorded 0.157.0 replies.
import { type ChildProcess, spawn } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import type { CodexRequest } from '@/harnesses/codex/app-server'
import { recordedCodexExternalThreads as recorded } from '@/mocks/recordings/codex-app-server'
// A recorded newest Turn: finished, interrupted by the user, or left unfinished by a crash.
export type RecordedTurn = 'completed' | 'interrupted' | 'crashed'
type TurnsAnswer = { page: unknown } | { error: Error }

const HOLD_SCRIPT =
  'use Fcntl qw(:flock); open(my $h, ">>", $ARGV[0]) or die; flock($h, LOCK_EX) or die; $| = 1; print "locked\\n"; sleep 600'

// The recorded page, with the newest Turn still running: unfinished, as another process shows it.
function runningPage(): unknown {
  const page = structuredClone(recorded.interrupted.full)
  for (const turn of page.data) Object.assign(turn, { completedAt: null, durationMs: null })
  return page
}

export function recordedTurnsPage(turn: RecordedTurn | 'running'): unknown {
  return turn === 'running' ? runningPage() : structuredClone(recorded[turn].full)
}

// The app-server's answer for a thread no process has loaded.
export function notLoadedError(threadId: string): Error {
  return new Error(recorded.notLoaded.message.replace(/[0-9a-f-]{36}$/, threadId))
}

async function holdLock(file: string): Promise<ChildProcess> {
  const holder = spawn('/usr/bin/perl', ['-e', HOLD_SCRIPT, file])
  for await (const line of createInterface({ input: holder.stdout }))
    if (line === 'locked') return holder
  throw new Error('The lock holder exited before it took the lock.')
}

// A writer holding one thread's lock under `codexHome`, as an open Codex does, until it exits cleanly.
export async function holdCodexWriterLock(codexHome: string, threadId: string) {
  const file = path.join(codexHome, 'thread-writer-locks', `${threadId}.lock`)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, '')
  const holder = await holdLock(file)
  return async () => {
    const exited = new Promise((resolve) => holder.once('exit', resolve))
    holder.kill()
    await exited
    rmSync(file, { force: true })
  }
}

// The app-server's `thread/read` answer for a locked thread that has no rollout yet.
function readNotLoadedError(threadId: string): Error {
  return new Error(recorded.readNotLoaded.message.replace(/[0-9a-f-]{36}$/, threadId))
}

// The app-server's answers a poll asks for: a thread's stored rollout path, and its newest Turn.
function mockAppServerRequest(answers: {
  rollout: (threadId: string) => string
  readTurns: (threadId: string) => Promise<unknown>
}): CodexRequest {
  return (async (method: string, params: unknown, parse: (value: unknown) => unknown) => {
    const { threadId } = params as { threadId: string }
    if (method === 'thread/read') {
      const path = answers.rollout(threadId)
      if (!existsSync(path)) throw readNotLoadedError(threadId)
      return parse({ thread: { ...recorded.completed.read.thread, id: threadId, path } })
    }
    if (method === 'thread/turns/list') return parse(await answers.readTurns(threadId))
    throw new Error(`The mock app-server does not answer ${method}.`)
  }) as CodexRequest
}

export function mockCodexExternalThreads() {
  const codexHome = mkdtempSync(path.join(os.tmpdir(), 'argo-codex-external-'))
  const lockFolder = path.join(codexHome, 'thread-writer-locks')
  const sessions = path.join(codexHome, 'sessions')
  for (const folder of [lockFolder, sessions]) mkdirSync(folder, { recursive: true })
  const holders = new Map<string, ChildProcess>()
  const answers = new Map<string, TurnsAnswer>()
  const turnsReads: string[] = []
  const lockFile = (threadId: string) => path.join(lockFolder, `${threadId}.lock`)
  const rollout = (threadId: string) => path.join(sessions, `rollout-${threadId}.jsonl`)

  let answerTurns = async (threadId: string): Promise<unknown> => {
    const answer = answers.get(threadId) ?? { page: { data: [], nextCursor: null } }
    if ('error' in answer) throw answer.error
    return answer.page
  }

  const request = mockAppServerRequest({
    rollout,
    readTurns: (threadId) => {
      turnsReads.push(threadId)
      return answerTurns(threadId)
    },
  })

  return {
    codexHome,
    request,
    // Each thread a `thread/turns/list` asked about, in order.
    turnsReads,
    rollout,
    // A writer opens the thread: it takes the lock and writes the rollout, unless content is null.
    async open(threadId: string, content: string | null = 'session_meta\n') {
      if (content !== null) writeFileSync(rollout(threadId), content)
      writeFileSync(lockFile(threadId), '')
      holders.set(threadId, await holdLock(lockFile(threadId)))
    },
    append(threadId: string, content: string) {
      appendFileSync(rollout(threadId), content)
    },
    // The writer exits. A clean exit removes its lock file; a crash leaves it unheld.
    async close(threadId: string, { crash = false }: { crash?: boolean } = {}) {
      const holder = holders.get(threadId)
      holders.delete(threadId)
      if (holder !== undefined) {
        const exited = new Promise((resolve) => holder.once('exit', resolve))
        holder.kill()
        await exited
      }
      if (!crash) rmSync(lockFile(threadId), { force: true })
    },
    // A file in the lock folder that names no thread.
    stray(name: string) {
      writeFileSync(path.join(lockFolder, name), '')
    },
    answer(threadId: string, answer: RecordedTurn | 'running' | { page: unknown } | Error) {
      if (answer instanceof Error) answers.set(threadId, { error: answer })
      else if (typeof answer === 'string')
        answers.set(threadId, { page: recordedTurnsPage(answer) })
      else answers.set(threadId, answer)
    },
    // Replaces how turns reads answer, such as with one a test settles by hand.
    respondWith(next: (threadId: string) => Promise<unknown>) {
      answerTurns = next
    },
    dispose() {
      for (const holder of holders.values()) holder.kill()
      holders.clear()
      rmSync(codexHome, { recursive: true, force: true })
    },
  }
}
