/**
 * Question 2 of #1793: can a row's height be computed from the diagram source, without
 * rendering it — "arithmetic over the same graph layout mermaid is already doing"?
 *
 * This is the honest attempt at yes. For the four kinds the mined corpus holds it reads the
 * source, builds the graph, and predicts the SVG's height from the same constants mermaid
 * lays out with. Nothing here renders, touches the DOM or awaits anything: given the source
 * string it returns a number synchronously, which is the whole point of asking.
 *
 * The two flowchart-family kinds are a layering of the DAG — the rank count is the height of a
 * top-down diagram and the widest rank is the height of a left-to-right one, which is how
 * `dagre` gets there too. A sequence
 * diagram is not a graph problem at all: its height is the message list, in order, so the
 * prediction is a sum over lines. A class diagram is dagre again over the compartment boxes,
 * with each box's own height set by how many members it declares.
 *
 * WHY THIS IS NOT THE SAME AS BEING RIGHT: mermaid's constants are configuration, and its
 * node heights depend on label text wrapping at `wrappingWidth`, which is a real text measure.
 * So a predictor is exact only where every label is short enough not to wrap. `score()` is
 * therefore the deliverable, not `predict()`: it reports the error against what the browser
 * actually drew, per diagram, so the report can say how far arithmetic gets rather than
 * claiming it arrives.
 */

/** The mermaid 11 defaults this predictor is calibrated against, read from its config. */
const FLOWCHART = { nodeHeight: 36, rankSep: 50, padding: 8 }
const SEQUENCE = { boxHeight: 65, messageMargin: 35, topMargin: 10, bottomMargin: 10 }
const CLASS = { headerHeight: 40, memberHeight: 22, rankSep: 50, padding: 8 }
const STATE = { nodeHeight: 43, rankSep: 50, padding: 8 }

export type Kind = 'flowchart' | 'sequence' | 'class' | 'state' | 'unknown'

export function kindOf(source: string): Kind {
  const head = source.trimStart().split('\n')[0].trim().toLowerCase()
  if (head.startsWith('flowchart') || head.startsWith('graph')) return 'flowchart'
  if (head.startsWith('sequencediagram')) return 'sequence'
  if (head.startsWith('classdiagram')) return 'class'
  if (head.startsWith('statediagram')) return 'state'
  return 'unknown'
}

/** `true` when the layout runs top-to-bottom, so the RANK COUNT is what sets the height. */
function isVertical(source: string): boolean {
  const head = source.trimStart().split('\n')[0].trim()
  const dir = head.split(/\s+/)[1]?.toUpperCase() ?? 'TB'
  return dir === 'TB' || dir === 'TD' || dir === 'BT'
}

/** Node ids on either side of every edge, ignoring labels, shapes and edge text. */
function edgesOf(source: string, pattern: RegExp): Array<[string, string]> {
  const edges: Array<[string, string]> = []
  for (const line of source.split('\n')) {
    const body = line.split('%%')[0].trim()
    for (const match of body.matchAll(pattern)) {
      const from = match[1]?.trim()
      const to = match[2]?.trim()
      if (from && to) edges.push([from, to])
    }
  }
  return edges
}

/**
 * The layering a layered engine assigns: every node's rank is one past its deepest predecessor,
 * which is dagre's longest-path layering after its acyclic pass. Cycles are broken by refusing
 * to revisit a node inside one walk, which is what breaking a back edge amounts to here.
 *
 * Both numbers are returned because BOTH are heights, depending on the direction the diagram
 * flows. In `TB` the height is the number of ranks; in `LR` the ranks run sideways and the
 * height is the widest rank. The first version of this predictor returned a single node's
 * height for every `LR` diagram and was 96% low on the corpus's worst case, which is the kind
 * of error that looks like a hard problem and is really just a missing case.
 */
function layering(edges: Array<[string, string]>): { ranks: number; widest: number } {
  if (edges.length === 0) return { ranks: 1, widest: 1 }
  const preds = new Map<string, string[]>()
  const nodes = new Set<string>()
  for (const [from, to] of edges) {
    nodes.add(from)
    nodes.add(to)
    preds.set(to, [...(preds.get(to) ?? []), from])
  }
  const rank = new Map<string, number>()
  const walk = (node: string, seen: Set<string>): number => {
    const cached = rank.get(node)
    if (cached !== undefined) return cached
    if (seen.has(node)) return 0
    seen.add(node)
    let deepest = -1
    for (const from of preds.get(node) ?? []) deepest = Math.max(deepest, walk(from, seen))
    seen.delete(node)
    const value = deepest + 1
    rank.set(node, value)
    return value
  }
  const perRank = new Map<number, number>()
  for (const node of nodes) {
    const r = walk(node, new Set())
    perRank.set(r, (perRank.get(r) ?? 0) + 1)
  }
  return { ranks: perRank.size, widest: Math.max(...perRank.values()) }
}

const FLOW_EDGE =
  /([A-Za-z0-9_.-]+)(?:[[({][^\]})]*[\])}])?\s*(?:-{2,3}|={2,3}|-\.-)[^>]*>\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_.-]+)/g
const STATE_EDGE = /(\[\*\]|[A-Za-z0-9_.-]+)\s*-{2,}>\s*(\[\*\]|[A-Za-z0-9_.-]+)/g
const CLASS_EDGE =
  /([A-Za-z0-9_.-]+)\s*(?:<\|--|--\|>|\*--|o--|-->|--|\.\.>|\.\.\|>|\.\.)\s*([A-Za-z0-9_.-]+)/g

function predictFlowchart(source: string): number {
  const { ranks, widest } = layering(edgesOf(source, FLOW_EDGE))
  const rows = isVertical(source) ? ranks : widest
  return rows * FLOWCHART.nodeHeight + (rows - 1) * FLOWCHART.rankSep + 2 * FLOWCHART.padding
}

/** Every line that draws a message, arrow or note — each one costs a row of height. */
function predictSequence(source: string): number {
  const MESSAGE = /^\s*[A-Za-z0-9_.-]+\s*(?:-|--)(?:>>?|\)|x)\s*[+-]?\s*[A-Za-z0-9_.-]+\s*:/
  const NOTE = /^\s*(?:note|Note)\s/
  let rows = 0
  for (const line of source.split('\n')) {
    if (MESSAGE.test(line) || NOTE.test(line)) rows += 1
  }
  return (
    SEQUENCE.topMargin + SEQUENCE.boxHeight + rows * SEQUENCE.messageMargin + SEQUENCE.bottomMargin
  )
}

/** Members per class, so a tall box counts as the rows it declares rather than as one node. */
function predictClass(source: string): number {
  const { ranks } = layering(edgesOf(source, CLASS_EDGE))
  const members = new Map<string, number>()
  let open: string | null = null
  for (const raw of source.split('\n')) {
    const line = raw.trim()
    const start = line.match(/^class\s+([A-Za-z0-9_.-]+)\s*\{/)
    if (start) {
      open = start[1]
      members.set(open, 0)
      continue
    }
    if (line === '}') {
      open = null
      continue
    }
    if (open && line) members.set(open, (members.get(open) ?? 0) + 1)
    const inline = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*\S/)
    if (!open && inline) members.set(inline[1], (members.get(inline[1]) ?? 0) + 1)
  }
  const counts = [...members.values()]
  const tallest = counts.length ? Math.max(...counts) : 0
  const box = CLASS.headerHeight + tallest * CLASS.memberHeight
  return ranks * box + (ranks - 1) * CLASS.rankSep + 2 * CLASS.padding
}

function predictState(source: string): number {
  const { ranks } = layering(edgesOf(source, STATE_EDGE))
  return ranks * STATE.nodeHeight + (ranks - 1) * STATE.rankSep + 2 * STATE.padding
}

/**
 * The predicted SVG height in CSS pixels, or `null` where nothing here can read the source.
 * `null` is a real answer: it is the case the Feed would have to fall back on.
 */
export function predict(source: string): number | null {
  switch (kindOf(source)) {
    case 'flowchart':
      return predictFlowchart(source)
    case 'sequence':
      return predictSequence(source)
    case 'class':
      return predictClass(source)
    case 'state':
      return predictState(source)
    default:
      return null
  }
}

export type Score = {
  readonly id: string
  readonly kind: Kind
  readonly predicted: number | null
  readonly actual: number
  /** Signed relative error. Positive means the prediction was too tall. */
  readonly error: number | null
}

export function score(id: string, source: string, actual: number): Score {
  const predicted = predict(source)
  return {
    id,
    kind: kindOf(source),
    predicted,
    actual,
    error: predicted === null ? null : (predicted - actual) / actual,
  }
}
