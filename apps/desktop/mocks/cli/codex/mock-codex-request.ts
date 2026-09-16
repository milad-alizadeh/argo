export type MockCodexRequest = {
  id?: unknown
  method?: string
  params?: Record<string, unknown>
  result?: unknown
}

export function readMockCodexRequest(line: string) {
  return JSON.parse(line) as MockCodexRequest
}
