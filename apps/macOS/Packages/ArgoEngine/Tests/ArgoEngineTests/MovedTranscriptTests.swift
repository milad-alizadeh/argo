@testable import ArgoEngine
import Foundation
import Testing

/// The other shape a worktree relocation takes: the CLI MOVES the transcript into the worktree's
/// own record directory rather than opening a second file. One uuid, one file, two paths — and the
/// path it left can never say anything again (#770).
@Suite("Moved transcripts")
struct MovedTranscriptTests {
    /// A transcript in the join whose file is gone loses its row, where one that merely aged out of
    /// the window keeps it. Otherwise the row it left stands frozen beside the live one until Argo
    /// is relaunched.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `a transcript whose file moved leaves one row`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let started = try fixture.write(FixtureTranscript(name: "moved", cwd: projectURL.path))
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))
        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))
        await hubSettle { !hub.sessions.isEmpty }

        let moved = try fixture.write(FixtureTranscript(
            directory: "worktree-project",
            name: "moved",
            cwd: projectURL.path,
        ))
        try FileManager.default.removeItem(at: started)
        await hub.refreshWorkingSet()

        await hubSettle { hub.sessions.map(\.sourceURL) == [moved.standardizedFileURL] }
        #expect(hub.sessions.count == 1)
        await hub.disconnect()
    }

    /// The path the CLI left, frozen at the moment of the move.
    @MainActor
    private func abandonedHalf() -> TranscriptObservation {
        hubTestObservation(at: recordURL("-proj", "a82ecaae"), events: [
            .originSession(id: "a82ecaae"),
            .prompt(text: "Start", images: [], atMs: 1000),
            .message(markdown: "Before the move"),
        ])
    }

    /// The same uuid under the worktree's own record directory, still being written.
    @MainActor
    private func liveHalf() -> TranscriptObservation {
        hubTestObservation(at: recordURL("-proj-worktree", "a82ecaae"), events: [
            .originSession(id: "a82ecaae"),
            .prompt(text: "Continue", images: [], atMs: 2000),
            .message(markdown: "After the move"),
            .branch("ticket-766"),
        ])
    }

    /// The graph is the backstop for the moment between the move and the sweep that notices it:
    /// two paths carrying one uuid are one Session, and the live half is the one the row reads.
    @Test
    @MainActor
    func `two paths carrying one uuid are one Session`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-relocation"))

        await hubObserveToEnd(hub, abandonedHalf())
        await hubObserveToEnd(hub, liveHalf())

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions.first?.branch == "ticket-766")
    }

    /// Discovery hands transcripts over NEWEST-mtime first, so on a connect that catches both paths
    /// the live half arrives FIRST. Which one the row reads is decided by when each last ran, never
    /// by where it sits in the working set.
    @Test
    @MainActor
    func `the live half wins whichever order it arrived in`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-relocation"))

        await hubObserveToEnd(hub, liveHalf())
        await hubObserveToEnd(hub, abandonedHalf())

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions.first?.branch == "ticket-766")
    }
}
