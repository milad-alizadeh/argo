import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

export function SessionDisclosure({
  children,
  icon,
  label,
  separated = false,
}: {
  children: ReactNode
  icon: ReactNode
  label: ReactNode
  separated?: boolean
}) {
  return (
    <details className={`group/disclosure ${separated ? 'border-t pt-2' : ''}`}>
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-(length:--text-control) font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground [&::-webkit-details-marker]:hidden [&>svg]:size-(--size-icon-metadata)">
        {icon}
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown className="ml-auto shrink-0 transition-transform group-open/disclosure:rotate-180" />
      </summary>
      {children}
    </details>
  )
}
