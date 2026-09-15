// ADR-0041: Claude Code writes nothing while it compacts, so this user-level hook's marker is the only live signal.
import { realpath, stat } from 'node:fs/promises'
import { isRecord } from '@/boundary'
import { readDocument, writeDocument } from '@/core/storage/portable-file'

export type HookInstall = 'installed' | 'present' | 'refused'

const TAG = '# argo-compaction-marker'
const EVENT = 'PreCompact'

function shellQuote(text: string) {
  return `'${text.replaceAll("'", `'\\''`)}'`
}

// Exits 0 whatever happens: a hook that fails would put Argo's error in front of the person's compaction.
export function compactionHookCommand(markers: string): string {
  const folder = shellQuote(markers)
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

async function fileMode(file: string) {
  try {
    return (await stat(file)).mode & 0o777
  } catch {
    return 0o600
  }
}

export async function installCompactionHook(
  settingsPath: string,
  markers: string,
): Promise<HookInstall> {
  // A dotfiles manager links this file; replacing the link with a copy would cut it off.
  const target = await realpath(settingsPath).catch(() => settingsPath)
  const read = await readDocument(target)
  if (!read.ok && read.reason !== 'missing') return 'refused'
  const settings = read.ok ? read.document : {}
  if (!isRecord(settings)) return 'refused'
  const hooks = settings.hooks ?? {}
  if (!isRecord(hooks)) return 'refused'
  const current = hooks[EVENT] ?? []
  if (!Array.isArray(current)) return 'refused'
  const entry = {
    hooks: [{ type: 'command', command: compactionHookCommand(markers), timeout: 5 }],
  }
  const next = [...withoutArgo(current), entry]
  if (JSON.stringify(next) === JSON.stringify(current)) return 'present'
  const document = { ...settings, hooks: { ...hooks, [EVENT]: next } }
  return (await writeDocument(target, document, await fileMode(target))) ? 'installed' : 'refused'
}
