# Desktop development launch

Start an Electron check from the root of the worktree:

```sh
bun run dev
```

Wait for the renderer to load. Then read the machine record:

```sh
bun run desktop:status
```

The JSON record names the exact window title, port, loopback debugging port, Electron process ID,
launcher process ID, state directory, and ready file. Use its `title` field when you locate the native window. Do not
select a window with only the generic Argo name.

To stop only this worktree's run, use:

```sh
bun run desktop:stop
```

The default port is stable for the worktree. A busy port stops the launcher. Select a free port
only for this run:

```sh
ARGO_DESKTOP_DEV_PORT=<free-port> bun run dev
```

The ready record stays at `readyFile` until the app exits. The launcher deletes a stale record
before it starts a new run.
