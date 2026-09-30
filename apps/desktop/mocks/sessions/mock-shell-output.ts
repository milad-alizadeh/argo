// The disk state behind the background Shell proof (#1582): where the recorded output lives, what
// the running command has written, and the notification the Harness appends when it ends.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixturePath } from './mock-transcript-files'

// The receipts in `shellRunning` name an absolute output file, the way the Harness's own do. The
// fixture's path is rewritten into this run's own root, so two runs never share one file.
export function shellOutputRoot(root) {
  return path.join(root, 'shell-output')
}

export async function pointShellOutputAtRoot(transcripts, root) {
  const transcript = fixturePath(transcripts, 'shellRunning')
  const before = await readFile(transcript, 'utf8')
  await writeFile(transcript, before.replaceAll('/tmp/argo-shell', shellOutputRoot(root)))
  await mkdir(shellOutputRoot(root), { recursive: true })
}
