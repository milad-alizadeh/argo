// Codex has no command list on the app-server. Skills are the directories under the user
// skill folder and each project's `.agents/skills`. The description is frontmatter only.
import { type FSWatcher, watch } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  type ComposerCommand,
  readComposerCommands,
} from '@/domains/sessions/api/composer-commands'
import { readSkillDirectoryRows, skillRoots } from '@/harnesses/skill-directories'

export function codexSkillHome(codexHome?: string) {
  return codexHome ?? process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex')
}

export function codexSkillRoots(cwd: string | null, codexHome: string): string[] {
  return skillRoots(cwd, path.join(codexHome, 'skills'), path.join('.agents', 'skills'))
}

export async function readCodexSkillCommands(input: {
  cwd: string | null
  codexHome?: string
  reject?: (shape: string) => void
}): Promise<ComposerCommand[]> {
  const reject = input.reject ?? (() => {})
  const rows = await readSkillDirectoryRows({
    roots: codexSkillRoots(input.cwd, codexSkillHome(input.codexHome)),
    reject,
    entryShape: 'codex-skill',
    rootShape: 'codex-skill-root',
  })
  return readComposerCommands(rows, reject)
}

export function followCodexSkillCommands(input: {
  cwd: string
  closed: () => boolean
  onCommands: (commands: ComposerCommand[]) => void
  reject?: (shape: string) => void
}): () => void {
  let stopped = false
  let stopWatch: (() => void) | null = null
  void readCodexSkillCommands(input).then((commands) => {
    if (stopped || input.closed()) return
    input.onCommands(commands)
    stopWatch = watchCodexSkillCommands({
      cwd: input.cwd,
      reject: input.reject,
      onChange: (next) => {
        if (!stopped && !input.closed()) input.onCommands(next)
      },
    })
  })
  return () => {
    stopped = true
    stopWatch?.()
  }
}

export function watchCodexSkillCommands(input: {
  cwd: string | null
  codexHome?: string
  reject?: (shape: string) => void
  onChange: (commands: ComposerCommand[]) => void
}): () => void {
  const codexHome = codexSkillHome(input.codexHome)
  const watchers: FSWatcher[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const refresh = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      void readCodexSkillCommands(input).then(input.onChange)
    }, 50)
  }
  for (const root of codexSkillRoots(input.cwd, codexHome)) {
    try {
      const watcher = watch(root, refresh)
      watcher.on('error', () => {})
      watchers.push(watcher)
    } catch {
      // A missing skill folder is an empty list, not a watch.
    }
  }
  return () => {
    if (timer !== undefined) clearTimeout(timer)
    for (const watcher of watchers) watcher.close()
  }
}
