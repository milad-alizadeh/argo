// PTY ownership: launching a CLI (⌘N), the terminals Argo owns, and the IPC wiring that attaches
// a renderer pane to one. Spawn and attach are one domain because the CLAIM is the same object in
// both halves — claiming the folder is what makes a Session `managed`, and the PTY exiting is what
// releases it (CONTEXT.md L2).
export { type AgentLauncher, createAgentLauncher, type Launched } from './agentLauncher'
export {
  type AgentPty,
  type AgentTerminals,
  type AttachedTerminal,
  createAgentTerminals,
} from './agentTerminals'
export { type DockWindow, wireTerminal } from './bridge'
export { wireSpawn } from './spawnSession'
