import type { ReactNode } from 'react'

// Text for work still running carries the Feed's work shimmer.
export function RunningText({ running, children }: { running: boolean; children: ReactNode }) {
  return running ? <span className="feed-work-shimmer">{children}</span> : children
}
