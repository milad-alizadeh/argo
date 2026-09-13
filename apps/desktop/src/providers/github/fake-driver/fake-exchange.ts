// One request to the fake GitHub, and the state every route reads and writes.
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FakeOutage, FakeRepository, FakeSignIn, FakeUser } from './fake-github'

export type FakeState = {
  origin: string
  signIn: FakeDevice
  devices: Map<string, FakeDevice>
  tokens: Map<string, FakeUser>
  repositories: Map<string, FakeRepository>
  outage: FakeOutage
  serial: number
}

// A held device stays pending until someone opens the device page, as a person entering the code.
export type FakeDevice = { answer: FakeSignIn; pending: number; held: boolean }

export type Exchange = {
  state: FakeState
  request: IncomingMessage
  response: ServerResponse
  url: URL
}

// A header set on the response before this call is merged into the one written here.
export function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}
