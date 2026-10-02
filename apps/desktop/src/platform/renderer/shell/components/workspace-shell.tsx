import type { ReactNode } from 'react'
import { AppShell } from '../../app/components/app-shell'

type WorkspaceShellProps = {
  rail?: ReactNode
  sidebar: ReactNode
  header: ReactNode
  footer?: ReactNode
  children: ReactNode
}

export function WorkspaceShell({ header, ...props }: WorkspaceShellProps) {
  return (
    <div data-component="WorkspaceShell" className="panel-stack">
      <AppShell leftHeader={header} {...props} />
    </div>
  )
}
