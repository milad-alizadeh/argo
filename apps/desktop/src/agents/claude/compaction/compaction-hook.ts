// ADR-0041: Claude Code writes nothing while it compacts, so the file this user-level hook leaves is the only live signal.
import { lstat, realpath, stat } from 'node:fs/promises'
import { isRecord } from '@/boundary'
import { readDocument, writeDocument } from '@/core/storage/portable-file'

export type HookInstall = 'installed' | 'present' | 'refused'

export const TAG = '# argo-compaction-start'
const EVENT = 'PreCompact'

function shellQuote(text: string) {
  return `'${text.replaceAll("'", `'\\''`)}'`
}

// Exits 0 whatever happens: a hook that fails would put Argo's error in front of the person's compaction.
export function compactionHookCommand(starts: string): string {
  const folder = shellQuote(starts)
  return `{ mkdir -p ${folder} && cat > ${folder}/"$$".json; } 2>/dev/null || cat >/dev/null; exit 0 ${TAG}`
}

function isArgoHook(hook: unknown) {
  return isRecord(hook) && typeof hook.command === 'string' && hook.command.endsWith(TAG)
}

// Every entry with Argo's hooks taken out, and an entry left empty by that dropped.
function withoutArgo(entries: unknown[]) {
  return entries.flatMap((entry) => {
    if (!isRecord(entry) || !Array.isArray(entry.hooks) || !entry.hooks.some(isArgoHook))
      return [entry]
    const hooks = entry.hooks.filter((hook) => !isArgoHook(hook))
    return hooks.length === 0 ? [] : [{ ...entry, hooks }]
  })
}

// A dotfiles manager links this file, so the write goes through the link; a dangling link is refused.
async function settingsTarget(settingsPath: string) {
  const resolved = await realpath(settingsPath).catch(() => null)
  if (resolved !== null) return resolved
  const linked = await lstat(settingsPath).then(
    (entry) => entry.isSymbolicLink(),
    () => false,
  )
  return linked ? null : settingsPath
}

async function fileMode(file: string) {
  try {
    return (await stat(file)).mode & 0o777
  } catch {
    return 0o600
  }
}

export async function installCompactionHook(
  settingsPath: string,
  folder: string,
): Promise<HookInstall> {
  const target = await settingsTarget(settingsPath)
  if (target === null) return 'refused'
  const read = await readDocument(target)
  if (!read.ok && read.reason !== 'missing') return 'refused'
  const settings = read.ok ? read.document : {}
  if (!isRecord(settings)) return 'refused'
  const hooks = settings.hooks ?? {}
  if (!isRecord(hooks)) return 'refused'
  const current = hooks[EVENT] ?? []
  if (!Array.isArray(current)) return 'refused'
  const hook = { type: 'command', command: compactionHookCommand(folder), timeout: 5 }
  const argo = current.flatMap((entry) =>
    isRecord(entry) && Array.isArray(entry.hooks) ? entry.hooks.filter(isArgoHook) : [],
  )
  if (argo.length === 1 && JSON.stringify(argo[0]) === JSON.stringify(hook)) return 'present'
  const next = [...withoutArgo(current), { hooks: [hook] }]
  const document = { ...settings, hooks: { ...hooks, [EVENT]: next } }
  return (await writeDocument(target, document, await fileMode(target))) ? 'installed' : 'refused'
}
