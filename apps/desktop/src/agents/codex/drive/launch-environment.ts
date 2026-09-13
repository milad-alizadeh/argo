// The scrub ADR-0024 requires: an exported credential is the one way a spawned Session could be
// billed outside the ChatGPT sign-in Argo owns.
export function codexLaunchEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env }
  delete environment.OPENAI_API_KEY
  delete environment.CODEX_API_KEY
  return environment
}
