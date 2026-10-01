import { expect, test } from 'bun:test'

const baseline = await Bun.file(
  new URL('../../../../tests/styling/registry-baseline.json', import.meta.url),
).json()
const configuration = await Bun.file(new URL('../../../../components.json', import.meta.url)).json()

function sourceHash(source: string) {
  return new Bun.CryptoHasher('sha256').update(source).digest('hex')
}

test('reviewed Button and Input retain their generated identity', async () => {
  for (const item of baseline.items) {
    const source = await Bun.file(new URL(`../../../../${item.target}`, import.meta.url)).text()
    expect(sourceHash(source)).toBe(item.sourceSha256)
    expect(sourceHash(`${source}\n// Deliberate unreviewed source mutation\n`)).not.toBe(
      item.sourceSha256,
    )
  }
})

test('recorded generation configuration matches the selected registry', () => {
  const selected = baseline.configuration
  expect(configuration.style).toBe(selected.style)
  expect(configuration.tailwind.baseColor).toBe(selected.baseColor)
  expect(configuration.tailwind.cssVariables).toBe(selected.cssVariables)
  expect(configuration.iconLibrary).toBe(selected.iconLibrary)
  expect(configuration.rsc).toBe(selected.rsc)
  expect(configuration.tsx).toBe(selected.tsx)
  expect(configuration.rtl).toBe(selected.rtl)
  expect(configuration.tailwind.prefix).toBe(selected.prefix)
})
