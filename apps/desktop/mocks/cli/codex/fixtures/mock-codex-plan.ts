const plan = [
  { step: 'Read the Session protocol', status: 'completed' },
  { step: 'Project the live Plan into the Roster', status: 'inProgress' },
]

export function sendPlanUpdate(options: {
  text: string
  threadId: unknown
  turnId: string
  send: (message: Record<string, unknown>) => void
  beforeTurnStart: boolean
}) {
  const { beforeTurnStart, send, text, threadId, turnId } = options
  const isEarly = text.includes('PLAN_EARLY')
  if (isEarly !== beforeTurnStart || (!isEarly && !text.includes('PLAN'))) return
  send({ method: 'turn/plan/updated', params: { threadId, turnId, explanation: null, plan } })
}
