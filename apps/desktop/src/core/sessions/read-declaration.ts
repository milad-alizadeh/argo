// What every Session read does the same way, written once: resolve the target source, degrade
// where no source has the capability, turn a thrown filesystem failure into the contract's own
// code, and put the body's payload in its envelope. The version check and the schema parse are
// not here at all — the IPC operation table does both before a body runs (ADR-0039) — so a body
// takes its parsed request type and `reads.ts` declares nothing but resolution and body.

import { isRecord } from '../../shared/validation'
import type { SessionArchiveStore } from './archive-store'
import { sessionError } from './contract'
import type { SessionSource } from './session-source'

export type OwnerFor = (sessionId: string) => Promise<SessionSource | undefined>

export type ReadContext = {
  sources: SessionSource[]
  ownerFor: OwnerFor
  // Argo's own Session state, shared by every adapter rather than resolved from one (#2315).
  archive: SessionArchiveStore
}

// A filesystem failure, said in the contract's own words.
export function readFailure(error: unknown) {
  if (isRecord(error) && (error.code === 'EACCES' || error.code === 'EPERM')) return 'access-denied'
  if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
    return 'transcripts-unavailable'
  }
  return 'internal-error'
}

// What a body answers with instead of a payload when the Session it was handed is not there to
// read. Every other failure it raises by throwing, and the envelope below names it. The key is a
// symbol so that a payload field can never be read as this marker, whatever a reply comes to hold.
const MISSING = Symbol('missing-session')
type Failure = { [MISSING]: true }
export const MISSING_SESSION: Failure = { [MISSING]: true }

// The optional members of the observation seam: the capabilities only some CLIs supply.
type CapabilityName = {
  [Key in keyof SessionSource]-?: undefined extends SessionSource[Key] ? Key : never
}[keyof SessionSource]
type WithCapability<Name extends CapabilityName> = SessionSource &
  Required<Pick<SessionSource, Name>>

type Envelope<Name extends string, Payload> = {
  version: 1
  type: Name
  requestId: string
} & Payload

async function envelope<Name extends string, Result extends object>(
  name: Name,
  requestId: string,
  body: () => Promise<Result>,
) {
  try {
    const result = await body()
    if (MISSING in result) return sessionError('missing-session', requestId)
    return { version: 1 as const, type: name, requestId, ...result } as Envelope<
      Name,
      Exclude<Result, Failure>
    >
  } catch (error) {
    return sessionError(readFailure(error), requestId)
  }
}

// Target resolution, one function per kind. Each returns the read itself: the context and the
// parsed request in, the operation's whole reply out.

// The owner of the named Session. A Session no adapter claims reads as missing.
export function fromOwner<
  Name extends string,
  Request extends { requestId: string; sessionId: string },
  Result extends object,
>(name: Name, body: (owner: SessionSource, request: Request) => Promise<Result>) {
  return (context: ReadContext, request: Request) =>
    envelope(name, request.requestId, async () => {
      const owner = await context.ownerFor(request.sessionId)
      return owner === undefined ? MISSING_SESSION : await body(owner, request)
    })
}

// The first source with the named capability. Where no source has it the read degrades to the
// declared reply rather than failing: a CLI with no archive of its own has an empty one.
export function fromCapability<
  Name extends string,
  Capability extends CapabilityName,
  Request extends { requestId: string },
  Result extends object,
>(
  declaration: { name: Name; capability: Capability; absent: (request: Request) => Result },
  body: (source: WithCapability<Capability>, request: Request) => Promise<Result>,
) {
  return (context: ReadContext, request: Request) =>
    envelope(declaration.name, request.requestId, async () => {
      const source = context.sources.find(
        (candidate) => candidate[declaration.capability] !== undefined,
      )
      return source === undefined
        ? declaration.absent(request)
        : await body(source as WithCapability<Capability>, request)
    })
}

// The reader's own shared state, no adapter behind it. A read whose answer is Argo's rather than
// any one CLI's resolves no target and takes the whole context (#2315).
export function fromContext<
  Name extends string,
  Request extends { requestId: string },
  Result extends object,
>(name: Name, body: (context: ReadContext, request: Request) => Promise<Result>) {
  return (context: ReadContext, request: Request) =>
    envelope(name, request.requestId, () => body(context, request))
}

// No source at all: the request names everything the body needs.
export function fromNothing<
  Name extends string,
  Request extends { requestId: string },
  Result extends object,
>(name: Name, body: (request: Request) => Promise<Result>) {
  return (_context: ReadContext, request: Request) =>
    envelope(name, request.requestId, () => body(request))
}
