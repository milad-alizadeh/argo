import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { TERMINAL_DELEGATION_STATUSES } from './claude-feed-envelopes'
import type { ClaudeSkillFile } from './claude-skill-files'

type Delegation = Extract<FeedContent, { kind: 'delegation' }>
type Tool = Extract<FeedContent, { kind: 'tool' }>
type KnownCall = { call: Tool; delegation: Delegation | null }

const AGENT_TOOLS = new Set(['Agent', 'Task'])
// The launch or reply text of an Agent call names the id its transcript is stored under.
const AGENT_ID = /^agentId: ([\w-]+)/m
const ASYNC_LAUNCH = 'Async agent launched'
const SLASH_COMMAND = /^\/(\S+)(?:\s+([\s\S]*))?$/

function inputField(input: Tool['input'], key: string): string | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input[key]
  return typeof value === 'string' ? value : null
}

function resultText(content: Tool): string {
  return (content.output ?? [])
    .flatMap((part) => (part.kind === 'text' ? [part.text] : []))
    .join('\n')
}

function resultStatus(content: Tool, text: string): Delegation['status'] {
  if (content.status === 'failed') return 'failed'
  return text.startsWith(ASYNC_LAUNCH) ? 'running' : 'completed'
}

// A foreground Agent's result is its reply, followed by the id line and usage the tool appends.
function replyText(text: string): string | null {
  const idLine = text.match(AGENT_ID)?.index ?? text.length
  const reply = text.slice(0, idLine).trim()
  return reply === '' ? null : reply
}

// Pairs each Agent call with its Subagent and each skill use with its SKILL.md, across one stream.
export class ClaudeFeedProjection {
  private calls = new Map<string, KnownCall>()
  // The last input each started agent was sent.
  private startedAgents = new Map<string, string | null>()
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
      case 'delegation':
        return this.delegation(content)
      default:
        return [content]
    }
  }

  // A repeated envelope for a started agent is a message only when its input is new; the same
  // input again is a progress report, which no event records.
  private delegation(content: Delegation): Delegation[] {
    const repeated = content.event === 'started' && this.startedAgents.has(content.agentId)
    if (repeated && this.startedAgents.get(content.agentId) === content.prompt) return []
    if (content.event !== 'responded') this.startedAgents.set(content.agentId, content.prompt)
    return [repeated ? { ...content, event: 'messaged' } : content]
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
      return content.status === 'failed' ? this.update(known, 'failed', null) : []
    const text = resultText(content)
    const agentId = text.match(AGENT_ID)?.[1]
    if (agentId === undefined) return [known.call, content]
    const started = this.start(known, agentId)
    const status = resultStatus(content, text)
    // A foreground Agent's one result is both its start and its reply.
    return TERMINAL_DELEGATION_STATUSES.has(status)
      ? [started, ...this.update(known, status, replyText(text))]
      : [started]
  }

  private call(content: Tool): FeedContent[] {
    const skill = content.name === 'Skill' ? inputField(content.input, 'skill') : null
    if (skill !== null && skill !== '') {
      this.skillCalls.add(content.callId)
      return [
        {
          id: content.id,
          kind: 'reference',
          referenceType: 'skill',
          label: skill,
          target: this.skillFile(skill),
          text: inputField(content.input, 'args'),
        },
      ]
    }
    if (
      !AGENT_TOOLS.has(content.name) ||
      content.input === null ||
      typeof content.input !== 'object' ||
      Array.isArray(content.input)
    )
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
    if (known.delegation !== null) return this.update(known, status, content.summary)
    const started = this.start(known, content.taskId)
    return TERMINAL_DELEGATION_STATUSES.has(status)
      ? [started, ...this.update(known, status, content.summary)]
      : [started]
  }

  private start(known: KnownCall, agentId: string): Delegation {
    this.startedAgents.set(agentId, inputField(known.call.input, 'prompt'))
    known.delegation = {
      id: known.call.callId,
      kind: 'delegation',
      event: 'started',
      agentId,
      status: 'running',
      name:
        inputField(known.call.input, 'description') ??
        inputField(known.call.input, 'subagent_type'),
      prompt: inputField(known.call.input, 'prompt'),
      model: inputField(known.call.input, 'model'),
      summary: null,
    }
    return known.delegation
  }

  // An end is its own response record; a running update records no event, so the start stays as sent.
  private update(
    known: KnownCall,
    status: Delegation['status'],
    summary: string | null,
  ): Delegation[] {
    const started = known.delegation
    if (started === null) throw new Error('A Subagent update came before its start.')
    if (!TERMINAL_DELEGATION_STATUSES.has(status)) return []
    return [
      {
        ...started,
        id: `${started.id}:response`,
        event: 'responded',
        status,
        prompt: null,
        summary,
      },
    ]
  }
}
