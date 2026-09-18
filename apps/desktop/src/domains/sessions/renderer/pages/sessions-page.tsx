import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

export function SessionsPage({ children }: { children?: ReactNode }) {
  return <div className="h-full min-h-0">{children ?? <Outlet />}</div>
}
