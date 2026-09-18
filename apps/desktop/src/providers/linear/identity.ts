// Who a Linear grant belongs to. A Linear user belongs to one workspace, so the user id alone keys
// the Account, and the same person in two workspaces is two Accounts.
import { isIdentifier, isRecord } from '../../shared/validation'
import type { Identity } from '../grant'
import type { LinearEndpoints } from './endpoints'
import { failed, type LinearRead, query } from './http'

const VIEWER = 'query Viewer { viewer { id name email organization { name } } }'

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

export async function readViewer(
  endpoints: LinearEndpoints,
  token: string,
): Promise<LinearRead<Identity>> {
  const reply = await query({ endpoints, token }, VIEWER)
  if (!reply.ok) return reply
  const viewer = reply.value.viewer
  if (!isRecord(viewer) || !isIdentifier(viewer.id)) return failed('unreachable')
  const organization = isRecord(viewer.organization) ? text(viewer.organization.name) : null
  return {
    ok: true,
    value: {
      providerAccountId: viewer.id,
      // The name where Linear holds one and the email where it does not: a row needs a label.
      login: text(viewer.name) ?? text(viewer.email) ?? viewer.id,
      workspace: organization,
    },
  }
}
