import assert from 'node:assert/strict'
import { test } from 'node:test'

import { compactionProgress, footerMode } from '@/harnesses/claude/drive/claude-setup.ts'

// Bytes Claude Code 2.1.270 drew across two Shift+Tab presses.
const CYCLED_SCREEN =
  '\u001b[2C\u001b[29B\u001b[38;2;175;135;255m⏵⏵ accept edits on\u001b[22G\u001b[38;2;153;153;153m (shift+tab to cycle) · ← 17 agents\u001b[39m\u001b[30;1H\u001b[27;3H\u001b[?25h\u001b[?2026l\u001b[?2026h\u001b[?25l\u001b[H\n\u001b[2C\u001b[29B\u001b[38;2;72;150;140m⏸ plan mode on\u001b[38;2;153;153;153m (shift+tab to cycle)'

test('reads the Mode the Claude footer drew last', () => {
  assert.equal(footerMode(CYCLED_SCREEN), 'plan')
})

test('reads no Mode off a screen with no Mode footer', () => {
  assert.equal(footerMode('\u001b[2mOpus Medium  |  Ctx n/a\u001b[22m'), null)
})

test('reads the percentage and token count Claude draws while compacting', () => {
  assert.deepEqual(
    compactionProgress(
      '\u001b[38;2;178;199;255mCompacting conversation…\u001b[39m (2m 55s · ↓ 10.1k tokens) 22%',
    ),
    { percentage: 22, tokens: '10.1k tokens' },
  )
})
