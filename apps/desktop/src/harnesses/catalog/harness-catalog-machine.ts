import { assign, fromPromise, setup } from 'xstate'
import { z } from 'zod'
import { harnessSchema } from '@/harnesses/harness'

const readingSchema = z.strictObject({
  exact: z.array(z.string()),
  prefixes: z.array(z.string()),
})
const modelChoiceSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
  detail: z.string().optional(),
  efforts: z.array(z.string()),
  defaultEffort: z.string().min(1),
  supportedModes: z.array(z.string().min(1)).optional(),
  readings: readingSchema,
})
const catalogModeSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
  detail: z.string(),
  icon: z.enum([
    'mode-auto',
    'mode-manual',
    'mode-accept-edits',
    'mode-plan',
    'mode-dont-ask',
    'mode-bypass-permissions',
    'mode-approve-safely',
  ]),
  readings: readingSchema,
})
const setupChoiceSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
  readings: readingSchema,
})
const availableHarnessSchema = z.strictObject({
  harness: harnessSchema,
  availability: z.literal('available'),
  agent: z.string().min(1),
  label: z.string().min(1),
  defaultModelId: z.string().min(1),
  modes: z.array(catalogModeSchema),
  models: z.array(modelChoiceSchema),
  efforts: z.array(setupChoiceSchema),
  opening: z.strictObject({
    model: z.string(),
    effort: z.string(),
    mode: z.string(),
  }),
})
const unavailableHarnessSchema = z.strictObject({
  harness: harnessSchema,
  availability: z.literal('unavailable'),
  reason: z.enum([
    'not-installed',
    'not-signed-in',
    'invalid-response',
    'unavailable',
  ]),
  detail: z.string().optional(),
})
export const harnessInfoSchema = z.union([
  availableHarnessSchema,
  unavailableHarnessSchema,
])
export const harnessCatalogSchema = z.strictObject({
  harnesses: z.tuple([
    harnessInfoSchema,
    harnessInfoSchema,
  ]),
})
export type HarnessInfo = z.infer<typeof harnessInfoSchema>
export type HarnessCatalog = z.infer<typeof harnessCatalogSchema>
export type HarnessCatalogLoad = () => Promise<HarnessCatalog>
export type CatalogReading = z.infer<typeof readingSchema>
export type AvailableHarness = Extract<
  HarnessInfo,
  {
    availability: 'available'
  }
>

type HarnessCatalogEvent =
  | {
      type: 'Catalog requested'
    }
  | {
      type: 'Refresh'
    }
  | {
      type: 'Retry'
    }
  | {
      type: 'xstate.done.actor.loadCatalog'
      output: HarnessCatalog
    }
  | {
      type: 'xstate.error.actor.loadCatalog'
      error: unknown
    }

export function unavailable(harness: HarnessInfo['harness']): HarnessInfo {
  return {
    harness,
    availability: 'unavailable',
    reason: 'unavailable',
  }
}
export function invalidCatalogResponse(
  harness: HarnessInfo['harness'],
  error: z.ZodError,
): HarnessInfo {
  return {
    harness,
    availability: 'unavailable',
    reason: 'invalid-response',
    detail: error.message,
  }
}
export function createHarnessCatalogMachine(load: HarnessCatalogLoad) {
  const loadCatalog = fromPromise(load)
  return setup({
    types: {
      context: {} as {
        catalog: HarnessCatalog
        failure: string | null
        invalidResponseCount: number
      },
      events: {} as HarnessCatalogEvent,
    },
    actors: {
      loadCatalog,
    },
    actions: {
      clearFailure: assign({
        failure: () => null,
      }),
    },
  }).createMachine({
    id: 'harnessCatalog',
    initial: 'Idle',
    context: {
      catalog: {
        harnesses: [
          unavailable('claude'),
          unavailable('codex'),
        ],
      },
      failure: null,
      invalidResponseCount: 0,
    },
    states: {
      Idle: {
        on: {
          'Catalog requested': 'Loading',
          Refresh: 'Loading',
          Retry: 'Loading',
        },
      },
      Loading: {
        entry: 'clearFailure',
        invoke: {
          src: 'loadCatalog',
          onDone: {
            target: 'Ready',
            actions: assign({
              catalog: ({ event }) => event.output,
              invalidResponseCount: ({ context, event }) =>
                context.invalidResponseCount +
                event.output.harnesses.filter(
                  (info) =>
                    info.availability === 'unavailable' && info.reason === 'invalid-response',
                ).length,
            }),
          },
          onError: {
            target: 'Failed',
            actions: assign({
              failure: ({ event }) => String(event.error),
            }),
          },
        },
        on: {
          Refresh: 'Loading',
          Retry: 'Loading',
          'Catalog requested': {},
        },
      },
      Ready: {
        on: {
          Refresh: 'Loading',
          Retry: 'Loading',
        },
      },
      Failed: {
        on: {
          Refresh: 'Loading',
          Retry: 'Loading',
        },
      },
    },
  })
}
