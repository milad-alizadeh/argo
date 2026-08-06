// The main-process hub (ADR-0005) and the IPC transport that carries its deltas to a renderer.
// The store is framework-free and Electron-free; `bridge.ts` is the only Electron-coupled layer
// on top of it, which is why the two sit together behind one entry rather than the transport
// living loose beside the domain it serves.

export { wireProjection } from './bridge'
export { createHub, type Hub, type ProjectionListener } from './hub'
