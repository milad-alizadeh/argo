// The reply gap a packaged proof gives the mock Harnesses. Omitted means their current, immediate
// reply behavior, so the ordinary proof cases retain their existing timing.
export const SESSION_MOCK_REPLY_DELAY_MS_ENV = 'ARGO_MOCK_REPLY_DELAY_MS'

export function readMockReplyDelayMs(): number {
  const delay = Number(process.env[SESSION_MOCK_REPLY_DELAY_MS_ENV] ?? '0')
  return Number.isFinite(delay) && delay > 0 ? delay : 0
}

// While this file exists, the mock claude holds each reply, so a case reads the wait state with no
// race against time (#3027).
export const SESSION_MOCK_REPLY_HOLD_FILE_ENV = 'ARGO_MOCK_REPLY_HOLD_FILE'

// Opts a packaged proof into a replayable adverse transport plan; unset keeps ordinary mock behavior.
export const SESSION_MOCK_ADVERSARIAL_SEED_ENV = 'ARGO_MOCK_ADVERSARIAL_SEED'
