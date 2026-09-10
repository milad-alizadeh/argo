import type { SessionFeedRow as SessionFeedRowData } from '../types'

type SessionFeedRowProps = { row: SessionFeedRowData }

export function SessionFeedRow({ row }: SessionFeedRowProps) {
  return <article className="border-b border-rule/60 px-5 py-4 last:border-b-0"><pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-ink">{JSON.stringify(row, null, 2)}</pre></article>
}
