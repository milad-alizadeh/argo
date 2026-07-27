/**
 * Council fan-out. Seven votes per trial (five axes; three voters on `contradicted`), run
 * concurrently, aggregated per axis.
 *
 * MIXED-VENDOR PANEL. The three contradiction voters are drawn round-robin from a panel of
 * backends rather than being three calls to one model. Two judges from one vendor are one
 * lens with extra steps: they share training data, refusal habits and blind spots, so
 * redundancy buys noise reduction and not error detection. `vendorOf` is what makes the
 * distinction real — the report prints the panel so a run judged by a single vendor cannot be
 * read as though it were adversarial.
 *
 * This also disposes of the self-preference problem the ticket would otherwise have inherited.
 * The router is Claude by ADR-0007; with a mixed panel the hard invariant is never scored
 * solely by the family that produced the text.
 */

import { type Axis, AXES, type AxisId, JUDGE_SYSTEM_PROMPT, judgePrompt, parseVerdict, type Verdict } from './judges'
import { type Backend, complete, mapLimit, vendorOf } from './llm'

export type AxisResult = {
  readonly axis: AxisId
  /** Majority of voters. A tie cannot occur: voter counts are odd by construction. */
  readonly violation: boolean
  readonly voters: number
  readonly violationVotes: number
  readonly unparsableVotes: number
  /** Vendors that actually voted on this axis — the audit trail for the claim above. */
  readonly vendors: readonly string[]
  readonly evidence: readonly string[]
  /** True when the panel split. A contested verdict is a different object from a unanimous one. */
  readonly contested: boolean
}

export type CouncilResult = {
  readonly axes: readonly AxisResult[]
  readonly ms: number
  readonly errors: readonly string[]
}

const judgeOnce = async (
  backend: Backend,
  axis: Axis,
  pair: { source: string; spoken: string },
): Promise<Verdict & { error?: string }> => {
  const res = await complete(backend, JUDGE_SYSTEM_PROMPT, judgePrompt(axis, pair.source, pair.spoken))
  if (res.error) return { violation: false, evidence: '', unparsable: true, error: res.error }
  return parseVerdict(res.text)
}

export async function convene(
  panel: readonly Backend[],
  source: string,
  spoken: string,
  concurrency = 8,
): Promise<CouncilResult> {
  const t0 = performance.now()
  if (panel.length === 0) throw new Error('council needs at least one backend')

  // One work item per VOTE, so the three contradiction voters run alongside the other axes
  // rather than queueing behind them. Voter i of an axis takes panel[i % panel.length]:
  // single-backend panels degrade to the obvious thing, and a two-vendor panel guarantees the
  // three-voter axis is never unanimous-by-construction.
  const ballots = AXES.flatMap((axis) =>
    Array.from({ length: axis.voters }, (_, i) => ({ axis, backend: panel[i % panel.length] as Backend })),
  )
  const cast = await mapLimit(ballots, concurrency, (b) => judgeOnce(b.backend, b.axis, { source, spoken }))

  const errors: string[] = []
  const axes = AXES.map((axis) => {
    const idx = ballots.map((b, i) => (b.axis.id === axis.id ? i : -1)).filter((i) => i >= 0)
    const mine = idx.map((i) => cast[i]).filter((v): v is Verdict & { error?: string } => v !== undefined)
    for (const m of mine) if (m.error) errors.push(`${axis.id}: ${m.error}`)
    const violationVotes = mine.filter((m) => m.violation).length
    return {
      axis: axis.id,
      // Unparsable votes fall to "no violation" for the majority and are reported separately,
      // so a run where the judges failed cannot masquerade as a clean run.
      violation: violationVotes * 2 > mine.length,
      voters: mine.length,
      violationVotes,
      unparsableVotes: mine.filter((m) => m.unparsable).length,
      vendors: [...new Set(idx.map((i) => vendorOf((ballots[i] as { backend: Backend }).backend)))],
      evidence: mine.filter((m) => m.evidence).map((m) => m.evidence),
      contested: violationVotes > 0 && violationVotes < mine.length,
    }
  })
  return { axes, ms: performance.now() - t0, errors }
}
