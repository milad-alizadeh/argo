// One call a real CLI or SDK answered, as a vendor recording under `fixtures/` holds it.
export type RecordedCall = { method: string; params: Record<string, unknown>; result: unknown }
