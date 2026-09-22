import type { OtherFacts } from '../transcript'

// `mcp__<server>__<tool>`, the name both harnesses give an MCP tool; a tool name may hold `__`
// itself, so only the first split counts.
const MCP_NAME = /^mcp__([^_](?:[^_]|_(?!_))*)__(.+)$/

// The row of an MCP call: where it went is a fact, and the label names both parts.
export function mcpOther(name: string): OtherFacts | null {
  const [, server, tool] = MCP_NAME.exec(name) ?? []
  if (server === undefined || tool === undefined) return null
  return { kind: 'other', label: `${server} · ${tool}`, text: null, source: { server, tool } }
}
