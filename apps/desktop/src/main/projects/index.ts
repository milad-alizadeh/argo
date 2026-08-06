// Registration and activation — the only two acts Argo owns above the Session (ADR-0017): the
// per-machine registry file, the IPC wiring for the two acts, and the folder lookup every act
// that runs somewhere resolves its cwd through.

export { wireProjects } from './bridge'
export { projectFolder } from './projectFolder'
export { REGISTRY_FILENAME, readRegistry, toProjectEvents } from './registry'
