// The words one handoff is made of: what Argo types at the full Session's prompt, where the brief
// it asks for lands, and what the fresh Session opens on. Ported from the deprecated Swift app's
// `HandoffScript` (`apps/macOS`, read-only).
//
// The `handoff` skill (vendored via `skills-lock.json`) saves to a path given as its argument, so
// a bare path is read as a subject to go looking for rather than an address to write to — the
// command below spells out the instruction in full.
import path from 'node:path'

// A Session id is a Harness's own string and may carry separators. Cut to what a filename can hold,
// rather than trusted into a path.
function fileToken(sessionId: string): string {
  const kept = sessionId.replace(/[^A-Za-z0-9-]/g, '')
  return kept.length === 0 ? 'session' : kept.slice(-24)
}

// The file extension is markdown because the brief is prose an agent wrote for an agent. The
// brief lives in Argo's own per-machine data and never in the Project.
export function briefPath(options: { root: string; sessionId: string; atMs: number }): string {
  return path.join(options.root, `handoff-${fileToken(options.sessionId)}-${options.atMs}.md`)
}

// What is typed at the prompt, with no terminator. The path goes last so the sentence cannot
// swallow it.
export function handoffCommand(absoluteBriefPath: string): string {
  return (
    '/handoff Write the handoff document to this exact absolute path, ' +
    'creating any missing parent directories. Do not choose a folder or a filename of your own, ' +
    `and do not write it anywhere else. The path is: ${absoluteBriefPath}`
  )
}

// What the fresh Session opens on. It points at the brief rather than pasting it, or the new
// Session spends its context on the thing it was opened to escape.
export function handoffOpening(absoluteBriefPath: string): string {
  return `Read the handoff brief at ${absoluteBriefPath}. Continue the work it describes.`
}
