@testable import ArgoEngine
import Foundation
import Testing

/// The incremental half of discovery: the record directory itself is watched, because the file a
/// new Session writes does not exist at the moment the sweep runs.
@Suite("Record directory watcher")
struct RecordDirectoryWatcherTests {
    @Test(.timeLimit(.minutes(1)))
    func `a transcript written after the watch starts wakes it`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        // Built before the write, not inside the waiting task: `AsyncStream`'s body runs eagerly,
        // so the stream is watching by the time this line returns and the test is not racing it.
        let changes = RecordDirectoryWatcher(rootURL: fixture.rootURL).changes()
        let woke = Task {
            for await _ in changes {
                return true
            }
            return false
        }

        try fixture.write(FixtureTranscript(name: "started", cwd: fixture.path("checkout")))

        #expect(await woke.value)
    }

    /// A machine that has never run the CLI has no record directory yet, and `FSEventStreamCreate`
    /// accepts a path that is not there without ever reporting it appearing. The watch falls back
    /// to the nearest ancestor that exists, so the directory being CREATED is itself a change —
    /// otherwise the first Session ever recorded would need a relaunch to be seen.
    @Test(.timeLimit(.minutes(1)))
    func `a record directory created after the watch starts wakes it`() async throws {
        let parent = try RecordDirectoryFixture()
        defer { parent.remove() }
        let absentRoot = parent.rootURL.appending(path: "projects", directoryHint: .isDirectory)
        let changes = RecordDirectoryWatcher(rootURL: absentRoot).changes()
        let woke = Task {
            for await _ in changes {
                return true
            }
            return false
        }

        try FileManager.default.createDirectory(at: absentRoot, withIntermediateDirectories: true)

        #expect(await woke.value)
    }
}
