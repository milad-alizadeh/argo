import path from 'node:path'

// Codex Desktop's own app state, the SQLite file it keeps beside `sessions/` and names a thread in.
// Argo itself stopped reading it at ADR-0047, so this lives with the stand-in `codex` rather than
// in `src`: the mock app-server answers `thread/list` from it the way the real CLI does, and a
// proof writes a name into it to stand for Codex Desktop renaming a thread.
// Path only, and no `node:sqlite` or `import.meta`: Playwright loads this file as CommonJS.
export function codexStatePath(transcriptsRoot: string): string {
  return path.join(path.dirname(transcriptsRoot), 'state_5.sqlite')
}
