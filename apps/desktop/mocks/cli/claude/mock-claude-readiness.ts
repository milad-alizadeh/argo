// A stand-in `claude` for the Harness readiness/sign-in proof (#2579), run by node's type
// stripping. Answers `auth status --json` per `claude-readiness.ts`'s own parse
// (loggedIn/apiProvider/subscriptionType), and `auth login --claudeai` either by completing
// immediately or hanging until killed, for a canceled/expired sign-in proof.
import process from 'node:process'

type ReadinessState = 'signed-out' | 'ready' | 'policy-blocked'

const args = process.argv.slice(2)
const state = (process.env.MOCK_CLAUDE_READINESS_STATE ?? 'signed-out') as ReadinessState
const loginHangs = process.env.MOCK_CLAUDE_READINESS_LOGIN_HANGS === '1'

function statusPayload(): Record<string, unknown> {
  if (state === 'ready')
    return { loggedIn: true, apiProvider: 'firstParty', subscriptionType: 'pro' }
  if (state === 'policy-blocked') {
    return { loggedIn: true, apiProvider: 'bedrock', subscriptionType: null }
  }
  return { loggedIn: false }
}

if (args[0] === 'auth' && args[1] === 'status') {
  process.stdout.write(JSON.stringify(statusPayload()))
  process.exit(0)
} else if (args[0] === 'auth' && args[1] === 'login') {
  if (loginHangs) {
    // Exits only when killed: the sign-in driver's Cancel path, or the app tearing down.
    setInterval(() => {}, 1000)
  } else {
    process.exit(0)
  }
} else {
  process.exit(2)
}
