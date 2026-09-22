import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import type { CodexChannel } from '@/harnesses/codex/drive/supervision/codex-channel'
import { openCodexChannel } from '@/harnesses/codex/drive/supervision/codex-channel'

export function openAppServer(options: {
  executable: string
  cwd?: string
  env: NodeJS.ProcessEnv
}): { process: ChildProcessWithoutNullStreams; channel: CodexChannel } {
  const child = spawn(
    options.executable,
    ['app-server', '--listen', 'stdio://', '-c', 'features.default_mode_request_user_input=true'],
    { cwd: options.cwd, env: options.env, stdio: ['pipe', 'pipe', 'pipe'] },
  )
  child.stderr.on('data', (chunk: Buffer) => {
    console.error(`codex app-server stderr: ${chunk.toString('utf8').trimEnd()}`)
  })
  return { process: child, channel: channelForAppServerProcess(child) }
}

export function channelForAppServerProcess(process: ChildProcessWithoutNullStreams): CodexChannel {
  return openCodexChannel({
    stdout: process.stdout,
    write: (line) => process.stdin.write(line),
    kill: () => process.kill(),
    onExit: (listener) => {
      process.on('close', listener)
      process.on('error', listener)
    },
  })
}
