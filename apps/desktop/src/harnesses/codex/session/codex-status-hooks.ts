import { z } from 'zod'
import {
  type HookTableChanges,
  installedHookPort,
  installHooks,
  removeHooks,
  statusHookReader,
} from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import type { CodexRequest, ConfigWriteResponse, JsonValue } from '../app-server'

// `ConfigReadResponse.layers` with `includeLayers` (codex 0.157 generate-ts): each layer names its
// source, its version and its raw config.
const layersSchema = z.object({
  layers: z.array(
    z.looseObject({
      name: z.looseObject({ type: z.string() }),
      version: z.string(),
      config: z.looseObject({ hooks: z.unknown().optional() }),
    }),
  ),
})
const writeSchema = z.looseObject({ version: z.string() }) satisfies z.ZodType<
  Pick<ConfigWriteResponse, 'version'>
>

// The user layer's `hooks` table, with the version a write must name.
async function readUserHooks(request: CodexRequest) {
  const { layers } = await request('config/read', { includeLayers: true }, (value) =>
    layersSchema.parse(value),
  )
  const user = layers.find((layer) => layer.name.type === 'user')
  if (user === undefined) throw new Error('Codex named no user config layer.')
  return { version: user.version, hooks: user.config.hooks }
}

// Argo's status hooks in the user's `config.toml`, written only through app-server
// `config/value/write` with no `filePath`, which the generated types say means that file
// (https://developers.openai.com/codex/hooks). A question shows as PreToolUse of
// `request_user_input`, seen on codex 0.157; Codex sends no PermissionRequest for it.
export function createCodexStatusHooks(request: CodexRequest): ExternalSessionHooks {
  async function change(apply: (table: unknown) => HookTableChanges): Promise<void> {
    let { version, hooks } = await readUserHooks(request)
    for (const [event, groups] of apply(hooks)) {
      const written = await request(
        'config/value/write',
        {
          keyPath: `hooks.${event}`,
          value: groups as JsonValue,
          mergeStrategy: 'replace',
          expectedVersion: version,
        },
        (value) => writeSchema.parse(value),
      )
      version = written.version
    }
  }

  return {
    install: (port) => change((table) => installHooks(table, 'codex', port)),
    remove: () => change((table) => removeHooks(table, 'codex')),
    installedPort: async () => installedHookPort((await readUserHooks(request)).hooks, 'codex'),
    read: statusHookReader({ event: 'PreToolUse', toolName: 'request_user_input' }),
  }
}
