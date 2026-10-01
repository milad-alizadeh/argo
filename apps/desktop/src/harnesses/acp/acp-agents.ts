// Every ACP agent Argo offers, shaped like the ACP registry's launch fields; HARNESSES reads it.
export type AcpAgentEntry<Id extends string = string> = {
  id: Id
  label: string
  // A name found on the login shell's PATH, or an absolute path used as it is.
  command: string
  args: readonly string[]
  // Reader text naming how to install the agent, shown while it is not found.
  installStep: string
  env?: Readonly<Record<string, string>>
  // Inherited variables the agent must not see.
  unsetEnv?: readonly string[]
}

export const ACP_AGENTS = [
  {
    id: 'claude-acp',
    label: 'Claude ACP',
    command: 'claude-agent-acp',
    args: [],
    installStep:
      'Install it with npm install -g @agentclientprotocol/claude-agent-acp, then refresh models.',
    // An inherited API key would switch the subscription sign-in to API billing.
    unsetEnv: ['ANTHROPIC_API_KEY'],
  },
] as const satisfies readonly AcpAgentEntry[]

type AcpAgent = (typeof ACP_AGENTS)[number]
export type AcpHarness = AcpAgent['id']
type AcpHarnessTuple<Agents> = {
  -readonly [Index in keyof Agents]: Agents[Index] extends { id: infer Id } ? Id : never
}

export const ACP_HARNESSES = ACP_AGENTS.map(({ id }) => id) as AcpHarnessTuple<typeof ACP_AGENTS>

// One value per ACP agent, keyed by its Harness ID.
export function byAcpAgent<Value>(value: (agent: AcpAgent) => Value): Record<AcpHarness, Value> {
  return Object.fromEntries(ACP_AGENTS.map((agent) => [agent.id, value(agent)])) as Record<
    AcpHarness,
    Value
  >
}
