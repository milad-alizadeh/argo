// The disk state behind the background Shell proof (#1582): where the recorded output lives, what
// the running command has written, and the notification the CLI appends when it ends.
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixturePath, proofCwd } from './session-fixture-files'

// The receipts in `shellRunning` name an absolute output file, the way the CLI's own do. The
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

// What the running `npm run watch` has written so far.
export async function writeWatchOutput(root, text) {
  await writeFile(path.join(shellOutputRoot(root), 'watch.output'), text)
}

// The CLI's own word that the watcher ended, written the way it writes one: appended to the
// Session's file as a `task-notification` attachment.
export async function completeWatch(transcripts, root) {
  await appendFile(
    fixturePath(transcripts, 'shellRunning'),
    `${JSON.stringify({
      cwd: proofCwd(transcripts, 'shell'),
      type: 'attachment',
      timestamp: '2026-09-02T08:06:10.000Z',
      uuid: 'sh-n-2',
      parentUuid: 'sh-n-1',
      attachment: {
        type: 'queued_command',
        commandMode: 'task-notification',
        timestamp: '2026-09-02T08:06:10.000Z',
        prompt: [
          '<task-notification>',
          '<task-id>watch-task</task-id>',
          '<tool-use-id>sh-call-watch</tool-use-id>',
          `<output-file>${path.join(shellOutputRoot(root), 'watch.output')}</output-file>`,
          '<status>completed</status>',
          '<summary>Background command "npm run watch" completed (exit code 0)</summary>',
          '</task-notification>',
        ].join('\n'),
      },
    })}\n`,
  )
}
