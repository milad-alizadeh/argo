import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import type { AdversarialTurn } from '../../sessions/adversarial-turns.ts'
import type { MockTurnIds } from './mock-claude-sdk-stream.ts'
import { replyForMockClaudeTurn } from './mock-claude-turn.ts'

type SdkReplyOptions = {
  prompt: string
  waitForPermission: () => Promise<void>
  compact: () => void
  rename: RegExp
  transcript: string
  recordUser: (prompt: string, uuid: string) => void
  nextPlan: () => AdversarialTurn | null
  replyDelayMs: number
  writeReply: (text: string, plan: AdversarialTurn | null, messageId?: string) => string
  ids: MockTurnIds
}

export async function replyToSdkPrompt(options: SdkReplyOptions): Promise<string> {
  const {
    compact,
    ids,
    nextPlan,
    prompt,
    recordUser,
    rename,
    replyDelayMs,
    transcript,
    waitForPermission,
    writeReply,
  } = options
  if (prompt === '/compact') {
    compact()
    return 'Conversation compacted'
  }
  const renamed = rename.exec(prompt)
  if (renamed !== null) {
    mkdirSync(path.dirname(transcript), { recursive: true })
    appendFileSync(
      transcript,
      `${JSON.stringify({ type: 'custom-title', customTitle: renamed[1] })}\n`,
    )
    return 'Conversation renamed'
  }
  recordUser(prompt, ids.user)
  const plan = nextPlan()
  if (plan?.permissionBeforeReply) await waitForPermission()
  if (plan?.outcome === 'stall') return new Promise<string>(() => undefined)
  return replyForMockClaudeTurn({
    text: prompt,
    plan,
    replyDelayMs,
    writeReply: (text, turnPlan) => writeReply(text, turnPlan, ids.reply),
  })
}
