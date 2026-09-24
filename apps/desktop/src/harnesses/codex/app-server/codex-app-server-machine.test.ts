import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { type ActorLogic, createActor, fromCallback, waitFor } from 'xstate'
import { adjacencyMapToArray, getAdjacencyMap, getShortestPaths } from 'xstate/graph'
import { codexModelCatalogFixture } from '../../../../test-fixtures/sessions/codex-model-catalog.fixture'
import { readCodexHarnessInfo } from '../catalog'
import type { CodexChannel } from './codex-app-server-machine'
import { createCodexAppServerMachine, processExitIsCurrent } from './codex-app-server-machine'

const modeledMachine = createCodexAppServerMachine(() => 'codex').machine.provide({
  actors: { processActor: fromCallback(() => () => {}) },
})
const modeledEvents = [
  { type: 'Process ready' as const, version: '0.147.0' },
  { type: 'Process failed' as const },
  { type: 'Process exited' as const },
  { type: 'Retry now' as const },
  { type: 'Executable changed' as const, executable: 'replacement-codex' },
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
  if (snapshot.matches('Backoff')) return 'Backoff'
  if (snapshot.matches({ Connected: 'Ready' })) return 'Connected.Ready'
  return 'Connected.Starting'
}

const traversal = {
  input: { executable: 'codex' },
  events: (snapshot: ModeledSnapshot) => {
    const name = stateName(snapshot)
    const node = modeledMachine.getStateNodeById(`${modeledMachine.id}.${name}`)
    const accepted = new Set<string>(node.ownEvents)
    if (name.startsWith('Connected')) accepted.add('Executable changed')
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
    new Set(['Connected.Starting', 'Connected.Ready', 'Backoff', 'Closed']),
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

test('ignores the exit of a superseded app-server channel', () => {
  const oldChannel = {} as CodexChannel
  const replacement = {} as CodexChannel

  assert.equal(processExitIsCurrent(oldChannel, replacement), false)
  assert.equal(processExitIsCurrent(replacement, replacement), true)
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
