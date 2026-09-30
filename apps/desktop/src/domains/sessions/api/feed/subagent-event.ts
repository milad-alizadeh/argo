// One step in a Subagent's life, as its adapter read it. `responded` alone carries an end state,
// and every fact is absent where the harness does not give it (CONTEXT.md L3 · Subagent).
export const SUBAGENT_EVENTS = ['started', 'messaged', 'responded'] as const
