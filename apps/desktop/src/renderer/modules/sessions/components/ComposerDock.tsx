import type { ReactNode } from 'react'

export function ComposerDock({ children }: { children: ReactNode }) {
  return (
    <div className="session-page__composer-dock" data-component="ComposerDock">
      <div className="session-page__column">{children}</div>
    </div>
  )
}
