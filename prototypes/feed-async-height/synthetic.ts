/**
 * The scaling half of question 1: "how it scales with diagram size".
 *
 * The mined corpus cannot answer that on its own. Its twelve diagrams span 1.5–3.4 KB, which
 * is a narrow band, and they differ in KIND as well as in size — so a cost difference between
 * two of them is not a size effect. These generators hold the kind fixed and move exactly one
 * variable, which is the only way a curve comes out of it.
 *
 * Two shapes, because a layered layout is sensitive to the difference. A CHAIN is one node per
 * rank: the rank count grows with n, so a top-down layout gets taller and the crossing-
 * reduction pass has almost nothing to do. A FAN is a fixed number of ranks with n nodes spread
 * across them: the layout gets wider, and dagre's ordering pass — the expensive one — has real
 * work. A cost that is linear in the chain and superlinear in the fan is a layout cost; one
 * that tracks source bytes in both is a parse cost.
 *
 * The sizes deliberately run past anything in the corpus. The tail is what the ≤3s pass has to
 * survive, and nobody has yet emitted the diagram that breaks it.
 */

export const SIZES = [5, 10, 20, 40, 80, 160, 320] as const

/** n nodes in one line: n ranks, one node each. Height grows, width does not. */
export function chain(n: number): string {
  const lines = ['flowchart TB']
  for (let i = 0; i < n - 1; i++) lines.push(`  N${i}["Step ${i}"] --> N${i + 1}["Step ${i + 1}"]`)
  return lines.join('\n')
}

/** n nodes over four ranks. Width grows, height does not, and the ordering pass has work. */
export function fan(n: number): string {
  const lines = ['flowchart TB', '  ROOT["Root"]']
  const perRank = Math.max(1, Math.ceil(n / 3))
  for (let i = 0; i < n; i++) {
    const rank = Math.floor(i / perRank)
    const parent = rank === 0 ? 'ROOT' : `N${i - perRank}`
    lines.push(`  ${parent} --> N${i}["Node ${i}"]`)
  }
  return lines.join('\n')
}

export type Synthetic = { readonly id: string; readonly source: string; readonly nodes: number }

export function synthetics(): Synthetic[] {
  const out: Synthetic[] = []
  for (const n of SIZES) {
    out.push({ id: `chain-${n}`, source: chain(n), nodes: n })
    out.push({ id: `fan-${n}`, source: fan(n), nodes: n })
  }
  return out
}
