import type { SessionAdapterRegistry } from '@/domains/sessions/next/main/session-adapter-registry'
import type { SessionIdentityService } from './session-identity-service'

export async function recoverSessionState(
  identity: SessionIdentityService,
  adapters: Pick<SessionAdapterRegistry, 'discoverLaunch' | 'readKnownSession'>,
): Promise<void> {
  await identity.recoverLaunches((intent) => adapters.discoverLaunch(intent))
  await identity.reconcileVendorReads((session) => adapters.readKnownSession(session))
}
