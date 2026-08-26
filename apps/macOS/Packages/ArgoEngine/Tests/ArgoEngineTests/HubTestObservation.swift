@testable import ArgoEngine
import Foundation
import Testing

func hubFixtureObservation(_ fixture: String) async throws -> TranscriptObservation {
    try await hubTestObservation(id: fixture, events: Fixture.events(fixture))
}

/// The same fixture, keyed by PATH the way the engine keys a real record — so the transcript's key
/// and the chain's uuid are visibly different values (#770).
func hubFixtureObservation(_ fixture: String, at url: URL) async throws -> TranscriptObservation {
    try await hubTestObservation(at: url, events: Fixture.events(fixture))
}

/// A transcript already fully written: one batch carrying the whole file, which is the shape a tail
/// hands the Hub when it drains a file nobody is appending to.
func hubTestObservation(
    id: String,
    events: [TranscriptEvent],
    modifiedAt: Date? = nil,
)
    -> TranscriptObservation {
    TranscriptObservation(
        id: id,
        sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
        modifiedAt: modifiedAt,
        events: oneBatch(events),
    )
}

/// The same, keyed the way the engine keys a real record: by PATH (`Engine.observation(at:)`). The
/// chain's own uuid is the FILE NAME inside that path, and the two are different keys — a fixture
/// that conflates them cannot see a claim filed under the wrong one (#731).
func hubTestObservation(at url: URL, events: [TranscriptEvent]) -> TranscriptObservation {
    TranscriptObservation(
        id: url.path,
        sourceURL: url,
        modifiedAt: nil,
        events: oneBatch(events),
    )
}

private func oneBatch(_ events: [TranscriptEvent]) -> AsyncStream<[TranscriptEvent]> {
    AsyncStream { continuation in
        continuation.yield(events)
        continuation.finish()
    }
}

/// The two records a handoff is read from, in the Project's own folder: the Session being handed
/// OFF and the one Argo spawned to take it over.
@MainActor
func handedOffSessionObservation(of fixture: SpawnFixture) -> TranscriptObservation {
    hubTestObservation(
        id: "full-session",
        events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "A long conversation", images: [], atMs: Date().epochMs),
            .turnEnded(.endTurn),
        ],
    )
}

/// The record the fixture's spawned CLI wrote. Both ids a Session is known by come out of this one
/// URL: the roster and the ownership ledger key it by `path`, `--resume` takes the file name.
let spawnedTranscriptURL = URL(fileURLWithPath: "/tmp/session-from-cli.jsonl")
/// What the roster carries the fixture's spawned Session as.
let spawnedSessionID = spawnedTranscriptURL.path
/// What `--resume` is given to continue it.
let spawnedChainID = "session-from-cli"

@MainActor
func spawnedSessionObservation(of fixture: SpawnFixture) -> TranscriptObservation {
    hubTestObservation(
        at: spawnedTranscriptURL,
        events: [
            .cwd(fixture.projectURL.path),
            .prompt(text: "First prompt", images: [], atMs: Date().epochMs),
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
/// into its task table.
@MainActor
func hubTailEnded(_ hub: Hub, transcriptID: String) async {
    let ended = await settle {
        hub.observations.contains { $0.id == transcriptID && $0.state == .stopped }
    }
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
        // `F_GETPATH` NUL-terminates inside the fixed-size buffer.
        let name = pathBuffer.prefix { $0 != 0 }
        return String(validating: name, as: UTF8.self) == path
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
/// It SLEEPS between checks rather than yielding, and that is load-bearing rather than a rounding
/// of the same idea. What most of these waits are waiting on is a `DispatchSource` on the main
/// QUEUE — a socket accepting a connection, a connection reading a line. `Task.yield()` re-enqueues
/// on the main actor without ever leaving it, so a tight yield loop can spin out the whole bound
/// while the queue's event handler never runs and the thing being waited for never happens.
@MainActor
@discardableResult
func settle(until condition: () -> Bool) async -> Bool {
    let deadline = ContinuousClock.now + .seconds(5)
    while ContinuousClock.now < deadline {
        if condition() {
            return true
        }
        try? await Task.sleep(for: .milliseconds(1))
    }
    return condition()
}
