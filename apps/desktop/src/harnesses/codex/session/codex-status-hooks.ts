import { z } from 'zod'
import { STATUS_HOOK_EVENTS } from '@/harnesses/host/status-hooks'
import type { ExternalSessionHooks } from '@/harnesses/registration'
import type {
  CodexRequest,
  ConfigLayer,
  ConfiguredHookHandler,
  ConfigWriteResponse,
  JsonValue,
  ManagedHooksRequirements,
} from '../app-server'

STATUS_HOOK_EVENTS satisfies readonly Exclude<
  keyof ManagedHooksRequirements,
  'managedDir' | 'windowsManagedDir'
>[]

// `config/read` with `includeLayers`: each layer names its source, its version and its raw config.
const layersSchema = z.object({
  layers: z.array(
    z.looseObject({
      name: z.looseObject({ type: z.string() }),
      version: z.string(),
      config: z.looseObject({ hooks: z.unknown().optional() }),
    }) satisfies z.ZodType<Pick<ConfigLayer, 'version'>>,
  ),
})
const writeSchema = z.looseObject({ version: z.string() }) satisfies z.ZodType<
  Pick<ConfigWriteResponse, 'version'>
>

type CommandHandler = Pick<
  Extract<ConfiguredHookHandler, { type: 'command' }>,
  'type' | 'command' | 'async'
>

// Argo's status hooks in the user's `config.toml`, written only through app-server
// `config/value/write` with no `filePath`, which the generated types say means that file
// (https://developers.openai.com/codex/hooks). Each changed event is its own write, since a write
// of the whole `hooks` table reformats the user's other events and drops their comments (codex
// 0.157). A question shows as PreToolUse of `request_user_input`.
export function createCodexStatusHooks(request: CodexRequest): ExternalSessionHooks {
  return {
    async open() {
      const { layers } = await request('config/read', { includeLayers: true }, (value) =>
        layersSchema.parse(value),
      )
      const user = layers.find((layer) => layer.name.type === 'user')
      if (user === undefined) throw new Error('Codex named no user config layer.')
      let { version } = user
      return {
        table: user.config.hooks,
        async write(changes) {
          for (const [event, groups] of changes) {
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
        },
      }
    },
    group: (command) => ({
      hooks: [{ type: 'command', command, async: true } satisfies CommandHandler],
    }),
    questionTool: 'request_user_input',
    activityTool: { name: 'Bash', input: z.looseObject({ command: z.string().min(1).optional() }) },
  }
}
