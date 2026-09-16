// One request to the mock GitHub, and the state every route reads and writes.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MockOutage, MockRepository, MockSignIn, MockUser } from './mock-github'

export type MockState = {
  origin: string
  signIn: MockDevice
  devices: Map<string, MockDevice>
  tokens: Map<string, MockUser>
  repositories: Map<string, MockRepository>
  outage: MockOutage
  serial: number
}

// A held device stays pending until someone opens the device page, as a person entering the code.
export type MockDevice = { answer: MockSignIn; pending: number; held: boolean }

export type Exchange = {
  state: MockState
  request: IncomingMessage
  response: ServerResponse
  url: URL
}

// A header set on the response before this call is merged into the one written here.
export function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}
