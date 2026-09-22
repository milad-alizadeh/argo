import { appendFileSync } from 'node:fs'
import type { AdversarialTurn } from '../../sessions/adversarial-turns.ts'
import { replyForMockClaudeTurn } from './mock-claude-turn.ts'

type SdkReplyOptions = {
  prompt: string
  waitForPermission: () => Promise<void>
  compact: () => void
  rename: RegExp
  transcript: string
  recordUser: (prompt: string) => void
  nextPlan: () => AdversarialTurn | null
  projectSetupScenario: string | undefined
  replyDelayMs: number
  writeReply: (text: string, plan: AdversarialTurn | null) => string
}

export async function replyToSdkPrompt(options: SdkReplyOptions): Promise<string> {
  const {
    compact,
    nextPlan,
    projectSetupScenario,
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
    appendFileSync(
      transcript,
      `${JSON.stringify({ type: 'custom-title', customTitle: renamed[1] })}\n`,
    )
    return 'Conversation renamed'
  }
  recordUser(prompt)
  const plan = nextPlan()
  if (
    plan?.permissionBeforeReply ||
    (projectSetupScenario === 'permission' && prompt.includes('ARGO_SETUP_PLAN'))
  )
    await waitForPermission()
  if (plan?.outcome === 'stall') return new Promise<string>(() => undefined)
  return replyForMockClaudeTurn({ text: prompt, plan, replyDelayMs, writeReply })
}
