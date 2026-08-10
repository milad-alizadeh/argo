@testable import ArgoEngine
import Foundation
import Testing

func hubFixtureObservation(_ fixture: String) async throws -> TranscriptObservation {
    try await hubTestObservation(id: fixture, events: Fixture.events(fixture))
}

/// A transcript already fully written: one batch carrying the whole file, which is the shape a tail
/// hands the Hub when it drains a file nobody is appending to.
func hubTestObservation(
    id: String,
    events: [TranscriptEvent],
    modifiedAt: Date? = nil,
)
    -> TranscriptObservation {
    let stream = AsyncStream<[TranscriptEvent]> { continuation in
        continuation.yield(events)
        continuation.finish()
    }
    return TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        modifiedAt: modifiedAt,
        events: stream,
    )
}

/// The two records a handoff is read from, in the Project's own folder: the Session being handed
/// OFF and the one Argo spawned to take it over.
///
/// Here rather than in either suite because both read them — a copy per suite is the same eight
/// lines twice, and the two would drift the first time one of them needed a different event.
@MainActor
func handedOffSessionObservation(of fixture: SpawnFixture) -> TranscriptObservation {
    hubTestObservation(
        id: "full-session",
        events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "A long conversation", atMs: Date().epochMs),
            .turnEnded(.endTurn),
        ],
    )
}

@MainActor
func spawnedSessionObservation(of fixture: SpawnFixture) -> TranscriptObservation {
    hubTestObservation(
        id: "session-from-cli",
        events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "First prompt", atMs: Date().epochMs),
            .turnEnded(.endTurn),
        ],
    )
}

/// Observe a finite stream to its end — the shape every test that drives events by hand wants, and
/// one no caller of the engine has, because a real transcript's stream never ends.
@MainActor
func hubObserveToEnd(_ hub: Hub, _ observation: TranscriptObservation) async {
    await hub.startObserving(observation)
    await hubTailEnded(hub, transcriptID: observation.id)
}

/// Wait until a transcript's tail is over, read off the Hub's own projection rather than a handle
/// into its task table: the projection is what a caller can see, so it is what a test asserts on.
@MainActor
func hubTailEnded(_ hub: Hub, transcriptID: String) async {
    let ended = await settle {
        hub.observations.contains { $0.id == transcriptID && $0.state == .stopped }
    }
    // A tail that never ends is its own failure, rather than the assertions after it quietly
    // reading a roster that is only half-applied.
    #expect(ended, "the tail on \(transcriptID) never ended")
}

/// An observation whose stream stays open until the test closes it, which is the shape a live
/// transcript has: the finite helper above can only ever test a session that is already over.
///
/// The continuation carries BATCHES, and the first one is the backfill — a test that yields nothing
/// is a transcript that has not been read yet, which is exactly the state the roster holds back.
func hubLiveObservation(
    id: String,
)
    -> (TranscriptObservation, AsyncStream<[TranscriptEvent]>.Continuation) {
    let (events, continuation) = AsyncStream<[TranscriptEvent]>.makeStream()
    let observation = TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        events: events,
    )
    return (observation, continuation)
}

/// Wait until the Hub's roster is standing. A `connect` returns before its file-backed tails have
/// read anything, and the roster is deliberately held back until they have — so a test asserting on
/// `sessions` straight after one is reading the emptiness it was given, not the answer.
///
/// A roster that never arrives is its own failure, rather than the assertion after it reporting
/// whatever stale value was there when the wait gave up.
@MainActor
func hubSettle(until condition: () -> Bool) async {
    let settled = await settle(until: condition)
    #expect(settled, "the roster never reached the state the test is waiting for")
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

/// Yield until a condition holds, up to a bound, and answer whether it did. Some work is detached
/// and cannot be awaited from the call that triggered it; this waits for it without sleeping on a
/// guessed duration, and gives up rather than hanging.
///
/// The bound is wall-clock rather than a count of turns, because the whole suite shares one main
/// actor: a fixed number of yields is spent by whatever else is running, and the wait ends before
/// the thing being waited for has had a turn at all.
///
/// The answer is returned rather than swallowed so that giving up is a caller's failed expectation
/// — a silent `return` after the bound reads as a settled condition.
@MainActor
@discardableResult
func settle(until condition: () -> Bool) async -> Bool {
    let deadline = ContinuousClock.now + .seconds(5)
    while ContinuousClock.now < deadline {
        if condition() {
            return true
        }
        await Task.yield()
    }
    return condition()
}
