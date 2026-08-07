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

    /// A machine that has never run the CLI has no record directory to watch. That is a quiet
    /// stream that tears down on cancellation, not a crash on a null handle.
    @Test(.timeLimit(.minutes(1)))
    func `a missing record directory watches quietly`() async {
        let absent = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let changes = RecordDirectoryWatcher(rootURL: absent).changes()

        let woke = Task {
            for await _ in changes {
                return true
            }
            return false
        }
        woke.cancel()

        #expect(await woke.value == false)
    }
}
