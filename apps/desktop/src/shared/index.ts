// The cross-process contract, one folder per thing it is a contract ABOUT. Leaves are exported
// directly rather than through six one-line barrels — `feed/` has its own only because it has a
// member to keep private (`callRole`), which is the case a barrel exists for.
export * from './delivery/lifecycleModel'
export * from './feed'
export * from './git/facts'
export * from './ipc/channels'
export * from './projection/cockpitState'
export * from './projection/projection'
export * from './projects/model'
export * from './session/facts'
export * from './session/honesty'
export * from './session/posture'
export * from './session/runtimeTree'
export * from './workItems/model'
