// An anchored surface, so a hairline and no shadow (ADR-0038). The refusal says what happened and
// carries the action that answers it, when there is one.
import type { ReactNode } from 'react'
import { Alert, AlertTitle } from '../../../components/ui/alert'

export function ProjectRefusal({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <Alert
      data-component="ProjectRefusal"
      variant="destructive"
      className="flex flex-col items-start gap-2 rounded-lg border-border px-4 py-3"
    >
      <AlertTitle className="text-body font-medium">{message}</AlertTitle>
      {children}
    </Alert>
  )
}
