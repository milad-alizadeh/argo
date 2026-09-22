// A stand-in `codex` for the Harness readiness/sign-in proof (#2579), run by node's type
// stripping. Answers `login status` per `codex-readiness.ts`'s own parse (plain text, "Logged in"
// vs "Not logged in"), and `login` either by completing immediately or hanging until killed, for a
// canceled/expired sign-in proof.
import process from 'node:process'

type ReadinessState = 'signed-out' | 'ready'

const args = process.argv.slice(2)
const state = (process.env.MOCK_CODEX_READINESS_STATE ?? 'signed-out') as ReadinessState
const loginHangs = process.env.MOCK_CODEX_READINESS_LOGIN_HANGS === '1'

if (args[0] === 'login' && args[1] === 'status') {
  if (state === 'ready') {
    process.stdout.write('Logged in using ChatGPT\n')
    process.exit(0)
  }
  process.stderr.write('Not logged in\n')
  process.exit(1)
} else if (args[0] === 'login' && args.length === 1) {
  if (loginHangs) {
    // Exits only when killed: the sign-in driver's Cancel path, or the app tearing down.
    setInterval(() => {}, 1000)
  } else {
    process.exit(0)
  }
} else {
  process.exit(2)
}
