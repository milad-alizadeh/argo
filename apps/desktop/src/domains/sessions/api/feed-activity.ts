import { z } from 'zod'
import { type FeedContent, toolPresentationKindSchema } from './feed-content'
import copy from './locales/en.json'

export const feedActivityBaseSchema = z.strictObject({
  label: z.string(),
  kind: z.union([toolPresentationKindSchema, z.literal('thought')]),
  open: z.boolean(),
  agentDescription: z.boolean().optional(),
})
export const feedActivitySchema = feedActivityBaseSchema.extend({
  tool: z.string(),
  target: z.string().nullable(),
})
type FeedActivity = z.infer<typeof feedActivitySchema>

export type FeedActivityState = { activity: FeedActivity | null; callId: string | null }
export const EMPTY_FEED_ACTIVITY: FeedActivityState = { activity: null, callId: null }

function callActivity(content: FeedContent): { id: string; activity: FeedActivity } | null {
  switch (content.kind) {
    case 'tool':
      return {
        id: content.callId,
        activity: {
          label: content.presentation?.label ?? content.summary ?? (content.name || content.callId),
          kind: content.presentation?.kind ?? 'tool',
          ...(content.presentation?.agentDescription === undefined
            ? {}
            : { agentDescription: content.presentation.agentDescription }),
          open:
            content.status === 'pending' ||
            content.status === 'running' ||
            content.status === 'paused',
          tool: content.name,
          target: null,
        },
      }
    case 'command':
      return {
        id: content.id,
        activity: {
          label: commandActivityLabel(content.command),
          kind: 'command',
          open:
            content.status === 'pending' ||
            content.status === 'running' ||
            content.status === 'paused',
          tool: 'command',
          target: null,
        },
      }
    case 'fileChange':
      return {
        id: content.id,
        activity: {
          label: content.changes.at(-1)?.path ?? content.id,
          kind: 'edited',
          open:
            content.status === 'pending' ||
            content.status === 'running' ||
            content.status === 'paused',
          tool: 'fileChange',
          target: content.changes.at(-1)?.path ?? null,
        },
      }
    default:
      return null
  }
}

export function commandActivityLabel(command: string | null): string {
  return copy.activity.command.replace('{{command}}', command ?? copy.activity.unknownCommand)
}

export function advanceFeedActivity(
  state: FeedActivityState,
  content: FeedContent,
): FeedActivityState {
  if (content.kind === 'message' && content.role === 'user') return EMPTY_FEED_ACTIVITY
  let thought: string | null = null
  if (content.kind === 'reasoning') thought = content.text
  if (content.kind === 'message' && content.phase === 'commentary') thought = content.text
  if (thought?.trim())
    return {
      activity: {
        label: thought.trim(),
        kind: 'thought',
        open: true,
        tool: 'thought',
        target: null,
      },
      callId: null,
    }
  const call = callActivity(content)
  if (call === null) return state
  if (!call.activity.open && state.activity?.kind === 'thought') return state
  if (!call.activity.open && state.callId !== null && state.callId !== call.id) return state
  if (state.callId === call.id && state.activity !== null)
    return { activity: { ...state.activity, open: call.activity.open }, callId: call.id }
  return { activity: call.activity, callId: call.id }
}

export function settleFeedActivity(state: FeedActivityState): FeedActivityState {
  return state.activity === null
    ? state
    : { ...state, activity: { ...state.activity, open: false } }
}
