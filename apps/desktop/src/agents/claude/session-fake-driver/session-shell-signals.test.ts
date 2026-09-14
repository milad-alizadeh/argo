import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fixtureRosterRow as rowOf } from './session-fixtures'

// A foreground call that came back is history, but a background one only ever gets a receipt,
// so it stays in the Shell list and its notification is what ends it (#1582).
test('keeps every running command and every background one, and drops the rest', async () => {
  assert.deepEqual((await rowOf(['shellRunning'])).shell, [
    {
      id: 'sh-call-suite',
      command: 'bun run --cwd apps/desktop test',
      background: false,
      state: 'running',
      startedAt: '2026-09-02T08:00:09.000Z',
      endedAt: null,
      outputPath: null,
      result: null,
    },
    {
      id: 'sh-call-watch',
      command: 'npm run watch',
      background: true,
      state: 'running',
      startedAt: '2026-09-02T08:00:09.000Z',
      endedAt: null,
      outputPath: '/tmp/argo-shell/watch.output',
      result: null,
    },
    {
      id: 'sh-call-build',
      command: 'bun run build',
      background: true,
      state: 'completed',
      startedAt: '2026-09-02T08:00:12.000Z',
      endedAt: '2026-09-02T08:01:43.000Z',
      outputPath: '/tmp/argo-shell/build.output',
      result: 'Background command "bun run build" completed (exit code 0)',
    },
  ])
  assert.deepEqual((await rowOf(['externalBasic'])).shell, [])
})
