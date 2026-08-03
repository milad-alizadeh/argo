/**
 * The three arms. Without a control a "14% contradiction rate" has no referent, and #222's
 * promise was to be "reversible with evidence" — reversibility is a property of a comparison,
 * not of a number.
 *
 *   control   the design #222 REPLACED: the reshaper writes a spoken line (its prompt is
 *             `../marker-drop-rate/contract.ts`, unmodified), and the audio model then speaks
 *             it — re-generating, because #221 says it always does. That last part matters:
 *             the honest control is not "the reshaper's line as scored on paper", it is that
 *             line as it would ACTUALLY have reached an ear.
 *   spans     #222's design without §3's clause.
 *   spans+c1  #222's design with it.
 *
 * The last two are the A/B on the single biggest untested bet in the design. #203 finding 4
 * showed a prompt clause can silently fail to take, which is precisely why it cannot ship
 * unmeasured.
 */

import { systemPrompt, userPrompt } from '../marker-drop-rate/contract'
import { type Backend, complete } from './llm'
import {
  parseRouterReply,
  type ReducedPayload,
  ROUTER_SYSTEM_PROMPT,
  renderForSpeaker,
  routerUserPrompt,
} from './spans'

export type ArmId = 'control-reshaper' | 'spans' | 'spans+clause1'

export type ArmSpec = {
  readonly id: ArmId
  readonly label: string
  /** #222 §3's clause 1, the A/B variable. Irrelevant to the control, which is why it is here. */
  readonly preReducedClause: boolean
}

export const ARMS: readonly ArmSpec[] = [
  { id: 'control-reshaper', label: 'reshaper → audio (pre-#222)', preReducedClause: false },
  { id: 'spans', label: 'spans → audio, no §3 clause', preReducedClause: false },
  { id: 'spans+clause1', label: 'spans → audio, WITH §3 clause', preReducedClause: true },
]

export type RouterOutput = {
  /** What goes to the speaker as its conversation item. */
  readonly payload: string
  /** Present for span arms only; the control produces a written line, not spans. */
  readonly reduced?: ReducedPayload
  readonly problems: readonly string[]
  readonly ms: number
  readonly error?: string
}

/**
 * The control's uncapped arm. #203 measured uncapped at 15.7% (floor) / 21.3% (cloud) and
 * showed every cap below ~30 words makes it worse, so pitting #222's design against a
 * deliberately hobbled predecessor would be rigging the comparison. The control gets the best
 * configuration #203 found.
 */
const CONTROL_CAP = null

export async function runRouter(
  arm: ArmSpec,
  backend: Backend,
  source: string,
): Promise<RouterOutput> {
  if (arm.id === 'control-reshaper') {
    const res = await complete(backend, systemPrompt(CONTROL_CAP), userPrompt(source))
    return { payload: res.text, problems: [], ms: res.ms, error: res.error }
  }
  const res = await complete(backend, ROUTER_SYSTEM_PROMPT, routerUserPrompt(source))
  if (res.error)
    return { payload: '', problems: ['router call failed'], ms: res.ms, error: res.error }
  const { payload, problems } = parseRouterReply(res.text)
  return { payload: renderForSpeaker(payload), reduced: payload, problems, ms: res.ms }
}
