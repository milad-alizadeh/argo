import claudeSpark from '@/harnesses/claude/presentation/claude-spark.svg?url'
import type { HarnessPresentation } from '@/harnesses/harness-presentation'

// The agent is Claude behind ACP, so it wears Claude's mark; its name tells the two apart.
function ClaudeAcpLogo() {
  return <img aria-hidden="true" alt="" className="size-3.5 shrink-0" src={claudeSpark} />
}

export const claudeAcpPresentation: HarnessPresentation = {
  Logo: ClaudeAcpLogo,
  planUsage: [],
  // ACP's allow_always option lasts for the Session.
  standingAllow: 'session',
  permissionPlugin: false,
}
