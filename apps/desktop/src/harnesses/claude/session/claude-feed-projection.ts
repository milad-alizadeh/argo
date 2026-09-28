import { z } from 'zod'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { ClaudeSkillFile } from './claude-skill-files'

type Delegation = Extract<FeedContent, { kind: 'delegation' }>
type Tool = Extract<FeedContent, { kind: 'tool' }>

const agentInputSchema = z.object({
  description: z.string().optional(),
  subagent_type: z.string().optional(),
  prompt: z.string().optional(),
  model: z.string().optional(),
})
const skillInputSchema = z.object({ skill: z.string().min(1), args: z.string().optional() })
const AGENT_TOOLS = new Set(['Agent', 'Task'])
// The launch or reply text of an Agent call names the id its transcript is stored under.
const AGENT_ID = /^agentId: ([\w-]+)/m
const ASYNC_LAUNCH = 'Async agent launched'
const SLASH_COMMAND = /^\/(\S+)(?:\s+([\s\S]*))?$/

function resultText(content: Tool): string {
  return (content.output ?? [])
    .flatMap((part) => (part.kind === 'text' ? [part.text] : []))
    .join('\n')
}

function resultStatus(content: Tool, text: string): Delegation['status'] {
  if (content.status === 'failed') return 'failed'
  return text.startsWith(ASYNC_LAUNCH) ? 'running' : 'completed'
}

// Pairs each Agent call with its Subagent and each skill use with its SKILL.md, across one stream.
export class ClaudeFeedProjection {
  private calls = new Map<string, { call: Tool; delegation: Delegation | null }>()
  private skillCalls = new Set<string>()
  private skillFile: ClaudeSkillFile

  constructor(skillFile: ClaudeSkillFile) {
    this.skillFile = skillFile
  }

  project(content: FeedContent): FeedContent[] {
    switch (content.kind) {
      case 'tool':
        return this.tool(content)
      case 'task':
        return this.task(content)
      case 'command':
        return [this.command(content)]
      default:
        return [content]
    }
  }

  // History cannot tell a skill's slash command from a built-in one, so only a SKILL.md can.
  private command(content: Extract<FeedContent, { kind: 'command' }>): FeedContent {
    const invocation = content.command?.match(SLASH_COMMAND)
    const name = invocation?.[1]
    if (name === undefined) return content
    const target = this.skillFile(name)
    if (target === null) return content
    return {
      id: content.id,
      kind: 'reference',
      referenceType: 'skill',
      label: name,
      target,
      text: invocation?.[2] ?? null,
    }
  }

  private tool(content: Tool): FeedContent[] {
    if (content.input !== null) return this.call(content)
    if (this.skillCalls.has(content.callId)) return []
    const known = this.calls.get(content.callId)
    if (known === undefined) return [content]
    if (known.delegation !== null)
      return content.status === 'failed' ? [this.update(known, 'failed', null)] : []
    const text = resultText(content)
    const agentId = text.match(AGENT_ID)?.[1]
    if (agentId === undefined) return [known.call, content]
    return [this.start(known, agentId, resultStatus(content, text))]
  }

  private call(content: Tool): FeedContent[] {
    const skill = content.name === 'Skill' ? skillInputSchema.safeParse(content.input) : null
    if (skill?.success) {
      this.skillCalls.add(content.callId)
      return [
        {
          id: content.id,
          kind: 'reference',
          referenceType: 'skill',
          label: skill.data.skill,
          target: this.skillFile(skill.data.skill),
          text: skill.data.args ?? null,
        },
      ]
    }
    if (!AGENT_TOOLS.has(content.name) || !agentInputSchema.safeParse(content.input).success)
      return [content]
    this.calls.set(content.callId, { call: content, delegation: null })
    return []
  }

  private task(content: Extract<FeedContent, { kind: 'task' }>): FeedContent[] {
    const known =
      [...this.calls.values()].find(({ delegation }) => delegation?.agentId === content.taskId) ??
      (content.callId === null ? undefined : this.calls.get(content.callId))
    if (known === undefined) return [content]
    const status = content.status ?? 'running'
    if (known.delegation === null) return [this.start(known, content.taskId, status)]
    return [this.update(known, status, content.summary)]
  }

  private start(
    known: { call: Tool; delegation: Delegation | null },
    agentId: string,
    status: Delegation['status'],
  ): Delegation {
    const input = agentInputSchema.parse(known.call.input)
    known.delegation = {
      id: known.call.callId,
      kind: 'delegation',
      agentId,
      status,
      name: input.description ?? input.subagent_type ?? null,
      prompt: input.prompt ?? null,
      model: input.model ?? null,
      summary: null,
    }
    return known.delegation
  }

  private update(
    known: { call: Tool; delegation: Delegation | null },
    status: Delegation['status'],
    summary: string | null,
  ): Delegation {
    if (known.delegation === null) throw new Error('A Subagent update came before its start.')
    known.delegation = { ...known.delegation, status, summary: summary ?? known.delegation.summary }
    return known.delegation
  }
}
