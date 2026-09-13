// A status category drawn the way Linear draws it: a dashed ring, a ring, a ring filling with a
// pie, and a disc with its check or cross cut out, so the shape carries the category.
import { type ReactNode, useId } from 'react'
import type { TicketStatus } from '@/core/tickets/contract'

type Category = TicketStatus['category']

const RING = { cx: 7, cy: 7, r: 6, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }

// A disc with `cut` punched through it, so the ground shows in either appearance.
function Disc({ cut }: { cut: ReactNode }) {
  // React's id carries characters a url() fragment does not take.
  const mask = `status-cut-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  return (
    <>
      <mask id={mask}>
        <rect fill="white" height="14" width="14" />
        <g
          fill="none"
          stroke="black"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        >
          {cut}
        </g>
      </mask>
      <circle cx="7" cy="7" fill="currentColor" mask={`url(#${mask})`} r="7" />
    </>
  )
}

// `share` is how far round the pie is filled, from 0 to 1.
function Pie({ share }: { share: number }) {
  return (
    <>
      <circle {...RING} />
      <circle
        cx="7"
        cy="7"
        fill="none"
        pathLength="100"
        r="2"
        stroke="currentColor"
        strokeDasharray={`${share * 100} 100`}
        strokeWidth="4"
        transform="rotate(-90 7 7)"
      />
    </>
  )
}

const SHAPES: Record<Exclude<Category, 'started'>, () => ReactNode> = {
  // Two opposed arrows: the Ticket is waiting to be sorted.
  triage: () => <Disc cut={<path d="M4 5.5h6M8.5 4 10 5.5 8.5 7M10 8.5H4M5.5 7 4 8.5 5.5 10" />} />,
  // Eight dashes round the ring.
  backlog: () => <circle {...RING} pathLength="16" strokeDasharray="1.2 0.8" />,
  unstarted: () => <circle {...RING} />,
  completed: () => <Disc cut={<path d="M4.25 7.25 6.1 9.1 9.75 5.25" />} />,
  canceled: () => <Disc cut={<path d="M5 5l4 4M9 5l-4 4" />} />,
}

export function StatusGlyph({
  category,
  share,
  className,
}: {
  category: Category
  share: number
  className: string
}) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 14 14">
      {category === 'started' ? <Pie share={share} /> : SHAPES[category]()}
    </svg>
  )
}
