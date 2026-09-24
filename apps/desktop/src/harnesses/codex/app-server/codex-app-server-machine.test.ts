import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { type ActorLogic, createActor, fromCallback, waitFor } from 'xstate'
import { adjacencyMapToArray, getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { codexModelCatalogFixture } from '../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { readCodexHarnessInfo } from '../catalog'
import { createCodexAppServerMachine } from './codex-app-server-machine'

const modeledMachine = createCodexAppServerMachine(() => 'codex').machine.provide({
  actors: { processActor: fromCallback(() => () => {}) },
  actions: {
    openProcess: () => {},
    closeProcess: () => {},
    queueRequest: () => {},
    dispatchRequest: () => {},
    dispatchWaiting: () => {},
    rejectChangedRequests: () => {},
  },
})
const modeledEvents = [
  { type: 'Process ready' as const, version: '0.147.0' },
  { type: 'Process failed' as const },
  { type: 'Process exited' as const },
  { type: 'Retry now' as const },
  {
    type: 'Request' as const,
    executable: 'replacement-codex',
    version: '0.147.0',
    run: () => {},
    reject: () => {},
  },
  { type: 'Shutdown' as const },
  { type: 'xstate.after.retryDelay.codexAppServerMachine.Backoff' as const },
]
type ModeledSnapshot = ReturnType<typeof modeledMachine.getInitialSnapshot>
const modeledLogic = modeledMachine as unknown as ActorLogic<
  ModeledSnapshot,
  (typeof modeledEvents)[number],
  { executable: string | null }
>

function stateName(snapshot: ModeledSnapshot): string {
  if (snapshot.matches('Closed')) return 'Closed'
  if (snapshot.matches({ Active: 'Backoff' })) return 'Active.Backoff'
  if (snapshot.matches({ Active: { Connected: 'Ready' } })) return 'Active.Connected.Ready'
  return 'Active.Connected.Starting'
}

const traversal = {
  input: { executable: 'codex' },
  events: (snapshot: ModeledSnapshot) => {
    const name = stateName(snapshot)
    const node = modeledMachine.getStateNodeById(`${modeledMachine.id}.${name}`)
    const accepted = new Set<string>(node.ownEvents)
    if (name.startsWith('Active')) accepted.add('Request')
    if (name !== 'Closed') accepted.add('Shutdown')
    return modeledEvents.filter(({ type }) => accepted.has(type))
  },
  serializeEvent: (event: (typeof modeledEvents)[number]) => event.type,
  serializeState: stateName,
}

test('models the Codex process states and their transitions', () => {
  const paths = getShortestPaths(modeledLogic, traversal)
  assert.deepEqual(
    new Set(paths.map(({ state }) => stateName(state))),
    new Set(['Active.Connected.Starting', 'Active.Connected.Ready', 'Active.Backoff', 'Closed']),
  )
  const pathByState = new Map(paths.map((path) => [stateName(path.state), path]))
  const transitions = adjacencyMapToArray(getAdjacencyMap(modeledLogic, traversal))
  for (const { state, event, nextState } of transitions) {
    const prefix = pathByState.get(stateName(state))
    assert.ok(prefix)
    const actor = createActor(modeledLogic, { input: { executable: 'codex' } }).start()
    try {
      for (const step of [...prefix.steps, { event, state: nextState }]) {
        actor.send(step.event)
        assert.deepEqual(actor.getSnapshot().value, step.state.value)
        const context = actor.getSnapshot().context
        assert.deepEqual(JSON.parse(JSON.stringify(context)), context)
        if (step.event.type === 'Process ready') assert.equal(context.version, step.event.version)
        if (step.event.type === 'Process failed') assert.ok(context.retryCount > 0)
      }
    } finally {
      actor.stop()
    }
  }
})

test('records process failure before retrying', () => {
  const actor = createActor(modeledMachine, { input: { executable: 'codex' } }).start()
  try {
    actor.send({ type: 'Process failed', detail: 'handshake rejected' })
    assert.equal(actor.getSnapshot().matches({ Active: 'Backoff' }), true)
    assert.equal(actor.getSnapshot().context.failure, 'handshake rejected')
  } finally {
    actor.stop()
  }
})

test('starts after an executable appears and rejects a request without one', () => {
  const machine = createCodexAppServerMachine(() => 'codex').machine.provide({
    actors: { processActor: fromCallback(() => () => {}) },
  })
  const actor = createActor(machine, { input: { executable: null } }).start()
  const failures: string[] = []
  try {
    assert.equal(actor.getSnapshot().matches({ Active: 'Unavailable' }), true)
    actor.send({
      type: 'Request',
      executable: null,
      version: null,
      run: () => {},
      reject: (error) => failures.push(error.message),
    })
    assert.deepEqual(failures, ['Codex executable is unavailable.'])
    actor.send({
      type: 'Request',
      executable: 'codex',
      version: '0.147.0',
      run: () => {},
      reject: (error) => failures.push(error.message),
    })
    assert.equal(actor.getSnapshot().matches({ Active: { Connected: 'Starting' } }), true)
    assert.equal(actor.getSnapshot().context.executable, 'codex')
  } finally {
    actor.stop()
  }
})

test('restarts when the executable version changes', () => {
  const machine = createCodexAppServerMachine(() => 'codex').machine.provide({
    actors: { processActor: fromCallback(() => () => {}) },
  })
  const actor = createActor(machine, { input: { executable: 'codex' } }).start()
  try {
    actor.send({ type: 'Process ready', version: '0.147.0' })
    actor.send({
      type: 'Request',
      executable: 'codex',
      version: '0.148.0',
      run: () => {},
      reject: () => {},
    })
    assert.equal(actor.getSnapshot().matches({ Active: { Connected: 'Starting' } }), true)
    assert.equal(actor.getSnapshot().context.version, null)
  } finally {
    actor.stop()
  }
})

test('rejects waiting requests when the app-server actor stops', () => {
  const machine = createCodexAppServerMachine(() => '/nonexistent-codex').machine
  const actor = createActor(machine, { input: { executable: '/nonexistent-codex' } }).start()
  const failures: string[] = []
  actor.send({
    type: 'Request',
    executable: '/nonexistent-codex',
    version: '0.148.0',
    run: () => {},
    reject: (error) => failures.push(error.message),
  })
  actor.send({ type: 'Shutdown' })
  assert.deepEqual(failures, ['Codex app-server closed before the request was sent.'])
})

test('does not dispatch a queued request to an older process version', () => {
  const machine = createCodexAppServerMachine(() => 'codex').machine.provide({
    actors: { processActor: fromCallback(() => () => {}) },
  })
  const actor = createActor(machine, { input: { executable: 'codex' } }).start()
  const failures: string[] = []
  let dispatched = false
  try {
    actor.send({
      type: 'Request',
      executable: 'codex',
      version: '0.148.0',
      run: () => {
        dispatched = true
      },
      reject: (error) => failures.push(error.message),
    })
    actor.send({ type: 'Process ready', version: '0.147.0' })
    assert.equal(actor.getSnapshot().matches({ Active: 'Backoff' }), true)
    assert.match(actor.getSnapshot().context.failure ?? '', /did not match 0.148.0/)
    assert.equal(dispatched, false)
  } finally {
    actor.stop()
  }
})

test('rejects a request sent after shutdown', async () => {
  const runtime = createCodexAppServerMachine(() => null)
  const actor = createActor(runtime.machine, { input: { executable: null } }).start()
  actor.send({ type: 'Shutdown' })
  await assert.rejects(
    runtime.request(actor)('model/list', {}, (value) => value),
    /Codex app-server is closed/,
  )
})

test('reports an executable lookup failure through the machine', async () => {
  const runtime = createCodexAppServerMachine(() => {
    throw new Error('Executable lookup failed.')
  })
  const actor = createActor(runtime.machine, { input: { executable: null } }).start()
  try {
    await assert.rejects(
      runtime.request(actor)('model/list', {}, (value) => value),
      /Executable lookup failed/,
    )
    assert.match(actor.getSnapshot().context.failure ?? '', /Executable lookup failed/)
  } finally {
    actor.stop()
  }
})

test('owns model/list and closes its child process on shutdown', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-codex-catalog-'))
  const executable = path.join(directory, 'codex')
  const server = path.join(directory, 'server.mjs')
  const closed = path.join(directory, 'closed')
  const script = `import { createInterface } from 'node:readline'; import { writeFileSync } from 'node:fs';
const catalog = ${JSON.stringify(codexModelCatalogFixture())};
process.on('SIGTERM', () => { writeFileSync(${JSON.stringify(closed)}, 'closed'); process.exit(0); });
createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  const result = request.method === 'model/list' ? catalog : {};
  process.stdout.write(JSON.stringify({ id: request.id, result }) + '\\n');
});`
  await writeFile(server, script)
  await writeFile(
    executable,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then echo 'codex 0.147.0'; exit 0; fi\nexec "${process.execPath}" "${server}"\n`,
  )
  await chmod(executable, 0o755)
  const runtime = createCodexAppServerMachine(() => executable)
  const actor = createActor(runtime.machine, { input: { executable } }).start()
  try {
    const info = await readCodexHarnessInfo(runtime.request(actor))
    assert.equal(info.availability, 'available')
    assert.equal(info.harness, 'codex')
    actor.send({ type: 'Shutdown' })
    await waitFor(actor, (snapshot) => snapshot.matches('Closed'))
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(await readFile(closed, 'utf8'), 'closed')
  } finally {
    actor.stop()
    await rm(directory, { recursive: true, force: true })
  }
})
