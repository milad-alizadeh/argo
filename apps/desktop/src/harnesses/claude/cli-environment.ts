// Claude's own CLI must never see an inherited API key: an org's ANTHROPIC_API_KEY would silently
// swap Argo's subscription sign-in for API billing, which the Claude Harness refuses to offer
// (#2579). Every spawn of `claude` — a drive session or a readiness/sign-in probe — starts here.
export function claudeCliEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment = { ...base }
  delete environment.ANTHROPIC_API_KEY
  return environment
}
