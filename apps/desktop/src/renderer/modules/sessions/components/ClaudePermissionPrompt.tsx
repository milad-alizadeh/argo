import { useState } from 'react'
import type { ClaudePermission } from '@/core/sessions/contract'
import { Button } from '../../../components/ui/button'

export function ClaudePermissionPrompt({
  permission,
  onDecide,
}: {
  permission: ClaudePermission
  onDecide: (decision: 'allow' | 'deny') => Promise<boolean>
}) {
  const [deciding, setDeciding] = useState(false)
  const decide = async (decision: 'allow' | 'deny') => {
    setDeciding(true)
    if (!(await onDecide(decision))) setDeciding(false)
  }
  return (
    <section
      aria-label="Claude permission"
      className="mx-auto my-3 max-w-4xl rounded-lg border bg-card p-3"
    >
      <h3 className="type-heading font-medium">Allow {permission.toolName}?</h3>
      <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 type-code">
        {JSON.stringify(permission.input, null, 2)}
      </pre>
      <div className="mt-3 flex justify-end gap-2">
        <Button disabled={deciding} variant="outline" onClick={() => void decide('deny')}>
          Deny
        </Button>
        <Button disabled={deciding} onClick={() => void decide('allow')}>
          Allow
        </Button>
      </div>
    </section>
  )
}
