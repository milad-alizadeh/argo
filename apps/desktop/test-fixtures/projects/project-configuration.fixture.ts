type Commands = { build: string; run: string; setup: string; test: string }

const DEFAULT_COMMANDS: Commands = {
  setup: 'bun install',
  run: 'bun run dev',
  build: 'bun run build',
  test: 'bun test',
}

export function projectConfigurationSource(commands: Partial<Commands> = {}) {
  return JSON.stringify({
    version: 1,
    targets: {
      app: { default: true, path: '.', ...DEFAULT_COMMANDS, ...commands },
    },
  })
}
