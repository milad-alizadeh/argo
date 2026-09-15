import { TAG } from '../../compaction/compaction-hook'

const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
// The CLI's own report of a `/compact`, which the Feed's compaction divider already makes.
const COMPACTED = /^Compacted( \(.*\))?$/

// The CLI dims its report with terminal colour codes, and reports every hook `/compact` ran,
// Argo's own included (ADR-0041).
export function readableCommandOutput(stdout: string): string {
  return stdout
    .replace(COLOUR, '')
    .split('\n')
    .filter((line) => !line.includes(`${TAG}]`) && !COMPACTED.test(line.trim()))
    .join('\n')
    .trim()
}
