// A vendor recording: each call a real CLI or SDK answered, under a file named for its version.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export type RecordedCall = { method: string; params: Record<string, unknown>; result: unknown }

// A run always starts in `apps/desktop`; Playwright loads this as CommonJS, without `import.meta`.
function readRecording(file: string[]) {
  const recording = path.join(process.cwd(), 'mocks', 'cli', ...file)
  return JSON.parse(readFileSync(recording, 'utf8')) as { version: string; calls: RecordedCall[] }
}

export function readRecordedCalls(...file: string[]): RecordedCall[] {
  return readRecording(file).calls
}

export function readRecordingVersion(...file: string[]): string {
  return readRecording(file).version
}
