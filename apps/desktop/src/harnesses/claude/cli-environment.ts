// Claude must not inherit an API key that switches its subscription sign-in to API billing.
export function claudeCliEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment = { ...base }
  delete environment.ANTHROPIC_API_KEY
  return environment
}
