# Codex IDE session lifecycle research

Source inspected: `/Users/milad/.cursor/extensions/openai.chatgpt-26.601.20914-darwin-arm64`.
The extension bundles the native Codex client at `bin/macos-aarch64/codex`. The binary is
stripped, so the evidence below uses stable strings and embedded Rust source paths with byte
offsets from `strings -t d`.

## Q15: idle managed threads

The client shuts down an idle managed thread when it has no subscribers. The exact diagnostic
string is `has no subscribers and is idle; shutting down` at binary offset `147038956`.
The bundle also contains `thread/unsubscribe` and the error string
`thread/unsubscribe failed during shutdown:` at offset `147007960`. This shows that shutdown is
subscriber driven and that unsubscribe is part of shutdown. The inspected bundle does not expose
a fixed grace-period value or a timer name.

The official app-server documentation supplies the missing value. If the last subscriber leaves,
app-server keeps an inactive thread loaded for 30 minutes. It then emits a `notLoaded` status and
`thread/closed`. Source: [Codex app-server, Unsubscribe from a loaded thread](https://developers.openai.com/codex/app-server/#unsubscribe-from-a-loaded-thread).

The same binary exposes the app-server methods `thread/list`, `thread/read`, `thread/loaded/list`,
and `thread/unsubscribe` in its method-name table. This supports listing and reading threads from
the server and tracking which threads are loaded. Stable search term: `thread/loaded/list`.

## Q16: input during a turn and recovery

The native client has an input queue. The embedded source path is `core/src/session/input_queue.rs`
at offset `147004756`. The client reports `canceling queued request with connection error:` at
offset `147010819`. This means queued work is canceled when the connection fails. It is not
evidence of automatic replay or drain.

The supported way to add user input during an active Turn is `turn/steer`. It returns the accepted
Turn ID and fails when the target Turn is not active. Source:
[Codex app-server, Steer an active turn](https://developers.openai.com/codex/app-server/#steer-an-active-turn).

The client has reconnect handling. Stable strings include `Reconnecting...` at offset `147001023`,
`refreshing server token before reconnect` at offset `147067404`, and `retrying after auth recovery`.
The client also reports `failed to enqueue running thread resume for thread`, which indicates that
resume can be enqueued as recovery work. The bundle does not prove that a user message is replayed
after an uncertain send. The safe migration rule is to preserve unsent input and require explicit
retry unless the server confirms acceptance.

## Q17: feed and read authority

The client names `thread/read`, `thread/turns/list`, and `thread/items/list` in the native
app-server method table. It also reports `thread/read failed while backfilling turn items for turn
completion:` at offset `147008686`. These strings show that the client reads and backfills turn
items from app-server state.

The official protocol says that `thread/read` reads stored history without loading or subscribing
to the thread. The Turn and item list methods paginate the same persisted history. Source:
[Codex app-server, Read a stored thread](https://developers.openai.com/codex/app-server/#read-a-stored-thread-without-resuming).

The inspected bundle contains no app-owned event-log method or transcript-event store that replaces
the server read model. The evidence supports a vendor-authoritative model: app-server events update
the local view, and reconnect uses thread read/list operations to restore state. The binary also
contains `subscribe_cursor_present` and reconnect transport source paths, which support cursor-based
event resubscription. Stable search terms: `thread/read failed while backfilling`,
`subscribe_cursor_present`, `thread/loaded/list`.

## Limits

This is bundle evidence, not a source checkout. The minified extension and stripped native binary
do not provide line-level Rust source or a documented idle grace period. The offsets above are
stable byte offsets from the installed binary version inspected on 2026-09-21.
