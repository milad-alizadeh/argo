import { Alert, AlertDescription } from './ui/alert'
import { useContractText } from '../i18n/contract-text'
import type { ContractFailure } from '../lib/query-client'
import { Icon } from './icon'

export function ContractFailureAlert({ error }: { error: ContractFailure }) {
  const contractText = useContractText()
  return (
    <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
      <Icon name="triangle-alert" />
      <AlertDescription>{contractText(error)}</AlertDescription>
    </Alert>
  )
}
