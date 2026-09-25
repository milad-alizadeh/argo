export type SessionShellOutput = { state: 'available'; tail: string } | { state: 'absent' }
export type SubagentUsageFacts = { tokens: number | null; model?: string | null }
