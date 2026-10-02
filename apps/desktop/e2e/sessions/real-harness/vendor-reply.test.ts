import { expect, test } from 'bun:test'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import { readCodexSessionHistory } from '@/harnesses/codex/session/codex-session-history'
import { recordedSession } from '../../../mocks/cli/claude/recorded-claude-sessions'
import {
  recordedThread,
  recordedThreadRequest,
} from '../../../mocks/cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '../../../mocks/cli/recorded-prompts'
import { replyAfterPrompt } from './vendor-reply'

test('recognizes a reply after the prompt in a recorded Claude Session read', () => {
  const content = decodeClaudeSessionMessages(recordedSession(RECORDED_PROMPTS.claudeProse))

  expect(replyAfterPrompt(content, RECORDED_PROMPTS.claudeProse)).toEqual({ size: content.length })
  expect(replyAfterPrompt(content, 'A prompt never sent')).toBeNull()
})

test('recognizes a reply after the prompt in a recorded Codex thread read', async () => {
  const thread = recordedThread(RECORDED_PROMPTS.codexReply)
  const content = await readCodexSessionHistory(recordedThreadRequest(thread), thread.id)

  expect(replyAfterPrompt(content, RECORDED_PROMPTS.codexReply)).toEqual({ size: content.length })
  expect(replyAfterPrompt(content, 'A prompt never sent')).toBeNull()
})
