import { expect, test } from 'bun:test'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import { readCodexSessionHistory } from '@/harnesses/codex/session/codex-session-history'
import { recordedSession } from '../../../mocks/cli/claude/recorded-claude-sessions'
import { recordedThread, threadReadRequest } from '../../../mocks/cli/codex/recorded-codex-threads'
import { replyAfterPrompt } from './vendor-reply'

test('recognizes a reply after the prompt in a recorded Claude Session read', () => {
  const content = decodeClaudeSessionMessages(recordedSession('Say hello, then confirm.'))

  expect(replyAfterPrompt(content, 'Say hello, then confirm.')).toEqual({ size: content.length })
  expect(replyAfterPrompt(content, 'A prompt never sent')).toBeNull()
})

test('recognizes a reply after the prompt in a recorded Codex thread read', async () => {
  const thread = recordedThread('Continue the check')
  const content = await readCodexSessionHistory(threadReadRequest(thread), thread.id)

  expect(replyAfterPrompt(content, 'Continue the check')).toEqual({ size: content.length })
  expect(replyAfterPrompt(content, 'A prompt never sent')).toBeNull()
})
