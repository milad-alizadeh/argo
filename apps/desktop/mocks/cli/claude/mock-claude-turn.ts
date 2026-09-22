import type { AdversarialTurn } from '../../sessions/adversarial-turns.ts'

type SettleMockClaudeTurnOptions = {
  text: string
  plan: AdversarialTurn | null
  projectSetupScenario: string | undefined
  replyDelayMs: number
  waitForPermission: () => Promise<void>
  writeReply: (text: string, plan: AdversarialTurn | null) => string
  displayReply: (text: string) => Promise<void>
}

type ReplyForMockClaudeTurnOptions = Pick<
  SettleMockClaudeTurnOptions,
  'plan' | 'replyDelayMs' | 'text' | 'writeReply'
>

export async function replyForMockClaudeTurn(options: ReplyForMockClaudeTurnOptions) {
  const { plan, replyDelayMs, text, writeReply } = options
  const delay = plan?.firstReplyDelayMs ?? replyDelayMs
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay))
  if (plan?.outcome === 'failure') {
    process.stdout.write('Mock Claude failed a Turn.\r\n')
    process.exit(1)
  }
  return writeReply(text, plan)
}

export async function settleMockClaudeTurn(options: SettleMockClaudeTurnOptions) {
  const {
    displayReply,
    plan,
    projectSetupScenario,
    replyDelayMs,
    text,
    waitForPermission,
    writeReply,
  } = options
  if (
    plan?.permissionBeforeReply ||
    (projectSetupScenario === 'permission' && text.includes('ARGO_SETUP_PLAN'))
  )
    await waitForPermission()
  if (plan?.outcome === 'stall') return
  await displayReply(await replyForMockClaudeTurn({ text, plan, replyDelayMs, writeReply }))
}
