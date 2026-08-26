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

    /// The graph is the backstop for the moment between the move and the sweep that notices it:
    /// two paths carrying one uuid are one Session, and the live half is the one the row reads.
    @Test
    @MainActor
    func `two paths carrying one uuid are one Session`() async {
        let hub = testHub(projectURL: URL(fileURLWithPath: "/tmp/argo-relocation"))
        let left = hubTestObservation(
            at: WorktreeRelocationTests.recordURL("-proj", "a82ecaae"),
            events: [.originSession(id: "a82ecaae"), .message(markdown: "Before the move")],
        )
        let moved = hubTestObservation(
            at: WorktreeRelocationTests.recordURL("-proj-worktree", "a82ecaae"),
            events: [
                .originSession(id: "a82ecaae"),
                .message(markdown: "After the move"),
                .branch("ticket-766"),
            ],
        )

        await hubObserveToEnd(hub, left)
        await hubObserveToEnd(hub, moved)

        #expect(hub.sessions.count == 1)
        #expect(hub.sessions.first?.branch == "ticket-766")
    }
}
