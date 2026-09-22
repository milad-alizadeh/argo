import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/platform/renderer/components/ui/alert'
import { useContractText } from '@/platform/renderer/i18n/contract-text'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'

export function ContractFailureAlert({ error }: { error: ContractFailure }) {
  const contractText = useContractText()
  return (
    <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertDescription>{contractText(error)}</AlertDescription>
    </Alert>
  )
}
