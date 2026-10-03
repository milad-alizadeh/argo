export function providerLabelColors(invalidColor: string) {
  return [
    { name: 'black', color: '000000' },
    { name: 'white', color: '#FFFFFF' },
    { name: 'missing' },
    { name: 'nullable', color: null },
    { name: 'private-label', color: invalidColor },
    { name: 'number-color', color: 7 },
  ]
}

export const normalizedLabelColors = [
  { name: 'black', color: '000000' },
  { name: 'white', color: 'FFFFFF' },
  { name: 'missing', color: null },
  { name: 'nullable', color: null },
  { name: 'private-label', color: null },
  { name: 'number-color', color: null },
]

export function interceptLabelReadResponses(
  accepts: (address: string) => boolean,
  replaceLabels: (body: unknown) => void,
) {
  const originalFetch = globalThis.fetch
  const originalWarning = console.warn
  const warnings: string[] = []
  console.warn = (...values: unknown[]) => warnings.push(values.join(' '))
  globalThis.fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const response = await originalFetch(input, init)
      if (!accepts(String(input))) return response
      const body: unknown = await response.json()
      replaceLabels(body)
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: response.headers,
      })
    },
    { preconnect: originalFetch.preconnect },
  )
  return {
    warnings,
    restore: () => {
      globalThis.fetch = originalFetch
      console.warn = originalWarning
    },
  }
}
