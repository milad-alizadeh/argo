import type { HarnessPresentation } from '@/harnesses/harness-presentation'
import { Icon } from '@/platform/renderer/components/icon/icon'

// Every ACP agent draws the same mark; its name beside the mark tells agents apart.
function AcpLogo() {
  return <Icon name="agent" className="size-3.5 shrink-0" />
}

export const acpPresentation: HarnessPresentation = {
  Logo: AcpLogo,
  planUsage: [],
  // ACP's allow_always option lasts for the Session.
  standingAllow: 'session',
  permissionPlugin: false,
}
