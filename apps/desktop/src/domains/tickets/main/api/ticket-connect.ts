import { ticketError } from '@/domains/tickets/api/errors'
import { type Call, readAs } from '../read-as'
import { projectExists, saveConnection } from '../ticket-connection'

export async function connectSource(call: Call, target: { accountId: string; scope: string }) {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const check = await readAs(call, target.accountId, (source, reader) =>
    source.check(reader, target.scope),
  )
  if (!check.ok) return check.error
  const { scope, label } = check.value
  const { projectId } = call
  const { accountId } = target
  const { provider } = check
  return saveConnection(call, { projectId, port: 'ticket', provider, accountId, scope, label })
}
