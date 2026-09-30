export async function waitFor(condition, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('The mock claude never wrote its transcript.')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}
