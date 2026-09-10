// A full-width band on the window ground with one hairline at its foot, and the traffic lights
// inset into its leading edge by the 84px inset (ADR-0038).
import type { ReactNode } from 'react'

export function ChromeBar({ subject, children }: { subject: string; children: ReactNode }) {
  return (
    <header
      data-component="ChromeBar"
      className="drag-region flex items-center gap-3 border-b bg-background pr-3 pl-[var(--inset-traffic-lights)]"
    >
      <div className="flex-1 text-body font-medium">
        Argo <span className="font-normal text-muted-foreground">{subject}</span>
      </div>
      <div className="no-drag-region">{children}</div>
    </header>
  )
}
