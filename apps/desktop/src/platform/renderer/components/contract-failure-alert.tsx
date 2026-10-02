import { useContractText } from '../i18n/contract-text'
import type { ContractFailure } from '../lib/query-client'
import { Notice } from './design-system/notice'

export function ContractFailureAlert({ error }: { error: ContractFailure }) {
  const contractText = useContractText()
  return (
    <Notice icon="triangle-alert" tone="danger">
      {contractText(error)}
    </Notice>
  )
}
