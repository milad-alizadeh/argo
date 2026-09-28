// The reply gap a packaged proof gives the mock Harnesses. Omitted means their current, immediate
// reply behavior, so the ordinary proof cases retain their existing timing.
export const SESSION_MOCK_REPLY_DELAY_MS_ENV = 'ARGO_MOCK_REPLY_DELAY_MS'

export function readMockReplyDelayMs(): number {
  const delay = Number(process.env[SESSION_MOCK_REPLY_DELAY_MS_ENV] ?? '0')
  return Number.isFinite(delay) && delay > 0 ? delay : 0
}

// Opts a packaged proof into a replayable adverse transport plan; unset keeps ordinary mock behavior.
export const SESSION_MOCK_ADVERSARIAL_SEED_ENV = 'ARGO_MOCK_ADVERSARIAL_SEED'
