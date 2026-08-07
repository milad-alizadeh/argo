@testable import ArgoEngine
import Foundation
import Testing

func hubFixtureObservation(_ fixture: String) async throws -> TranscriptObservation {
    try await hubTestObservation(id: fixture, events: Fixture.events(fixture))
}

func hubTestObservation(
    id: String,
    events: [TranscriptEvent],
)
    -> TranscriptObservation {
    let stream = AsyncStream<TranscriptEvent> { continuation in
        for event in events {
            continuation.yield(event)
        }
        continuation.finish()
    }
    return TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        events: stream,
    )
}

/// Observe a finite stream to its end — the shape every test that drives events by hand wants, and
/// one no caller of the engine has, because a real transcript's stream never ends.
@MainActor
func hubObserveToEnd(_ hub: Hub, _ observation: TranscriptObservation) async {
    await hub.startObserving(observation)
    await hub.waitForObservation(transcriptID: observation.id)
}

/// An observation whose stream stays open until the test closes it, which is the shape a live
/// transcript has: the finite helper above can only ever test a session that is already over.
func hubLiveObservation(
    id: String,
)
    -> (TranscriptObservation, AsyncStream<TranscriptEvent>.Continuation) {
    let (events, continuation) = AsyncStream<TranscriptEvent>.makeStream()
    let observation = TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        events: events,
    )
    return (observation, continuation)
}

/// A real transcript on disk, so the tail under test is the file-backed one rather than a stream
/// the test hands it.
func hubFixtureURL(_ name: String) throws -> URL {
    try #require(
        Bundle.module.url(forResource: name, withExtension: "jsonl", subdirectory: "Fixtures"),
    )
}

/// How many of this process's descriptors are open on one file.
///
/// A tail holds two — the cursor's handle and the watcher's `O_EVTONLY` — so counting them is how
/// "the file was released" is asserted rather than assumed. Asking about ONE path rather than
/// totalling the table is what keeps the answer stable while other suites open files of their own.
/// The descriptor table is asked which entries are open rather than every possible number being
/// probed: the soft limit here is over a million, and walking it is slow enough to look like a
/// hang when a test polls.
func openDescriptorCount(for url: URL) -> Int {
    let path = realPath(of: url)
    var pathBuffer = [CChar](repeating: 0, count: Int(MAXPATHLEN))
    return openDescriptors().count { descriptor in
        guard fcntl(descriptor, F_GETPATH, &pathBuffer) != -1 else { return false }
        return String(cString: pathBuffer) == path
    }
}

/// `F_GETPATH` answers with every symlink resolved, and `URL.resolvingSymlinksInPath` does not:
/// Foundation leaves `/tmp` and `/var` alone, which is exactly where a test writes. Both sides go
/// through `realpath` so the comparison is of the same name.
private func realPath(of url: URL) -> String {
    guard let resolved = realpath(url.path, nil) else { return url.path }
    defer { free(resolved) }
    return String(cString: resolved)
}

private func openDescriptors() -> [Int32] {
    let stride = Int32(MemoryLayout<proc_fdinfo>.stride)
    let size = proc_pidinfo(getpid(), PROC_PIDLISTFDS, 0, nil, 0)
    guard size > 0 else { return [] }
    var entries = [proc_fdinfo](repeating: proc_fdinfo(), count: Int(size / stride))
    let read = proc_pidinfo(getpid(), PROC_PIDLISTFDS, 0, &entries, size)
    guard read > 0 else { return [] }
    return entries.prefix(Int(read / stride)).map(\.proc_fd)
}

/// Yield until a condition holds, up to a bound. Some teardown is detached and cannot be awaited
/// from the call that triggered it; this waits for it without sleeping on a guessed duration, and
/// gives up rather than hanging so the failure is the caller's assertion.
func settle(until condition: @Sendable () -> Bool) async {
    for _ in 0 ..< 200 {
        if condition() {
            return
        }
        await Task.yield()
    }
}
