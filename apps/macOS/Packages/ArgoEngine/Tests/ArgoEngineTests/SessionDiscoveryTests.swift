@testable import ArgoEngine
import Foundation
import Testing

/// The sweep: which of a CLI's transcripts belong to this Project, and which of those are recent
/// enough to be worth opening.
@Suite("Session discovery")
struct SessionDiscoveryTests {
    private static let wellOutsideTheWindow = SessionDiscovery.workingSetWindow * 2

    @Test
    func `the working set is this Project's recently written transcripts`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let live = try fixture.write(FixtureTranscript(name: "live", cwd: projectURL.path))
        try fixture.write(FixtureTranscript(
            name: "history",
            cwd: projectURL.path,
            modifiedAgo: Self.wellOutsideTheWindow,
        ))
        try fixture.write(FixtureTranscript(
            directory: "elsewhere",
            name: "another-project",
            cwd: fixture.path("other-checkout"),
        ))

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: projectURL)

        #expect(discovered == [live.standardizedFileURL])
    }

    /// A string prefix would say `checkout-two` is inside `checkout`. The comparison is over path
    /// components, so it does not.
    @Test
    func `a sibling sharing a name prefix is not inside the Project`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(FixtureTranscript(name: "sibling", cwd: fixture.path("checkout-two")))

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// A session started in a subdirectory — or in a worktree kept under the repo — is working on
    /// this Project.
    @Test
    func `a transcript below the Project root is inside it`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let worktree = try fixture.write(FixtureTranscript(
            name: "worktree",
            cwd: fixture.path("checkout/.claude/worktrees/feature"),
        ))

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: projectURL)

        #expect(discovered == [worktree.standardizedFileURL])
    }

    @Test
    func `a transcript reporting no working directory is attributed to no Project`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(FixtureTranscript(name: "silent", cwd: nil))

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// `subagents/` and `workflows/` hold a Session's sidechains, which are read through the
    /// delegating tool call rather than tailed as Sessions of their own.
    @Test
    func `a sidechain below a project directory is not a Session`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(FixtureTranscript(
            directory: "project/subagents",
            name: "delegate",
            cwd: projectURL.path,
        ))

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// What a Project falls back to when there is no working directory to take one from — an app
    /// launched from Finder has no cwd. Every path on the machine is under it, so reading the
    /// prefix literally would put every Session of every repo in one roster.
    @Test
    func `the filesystem root is a Project scoping to nothing`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        try fixture.write(FixtureTranscript(name: "somewhere", cwd: fixture.path("checkout")))

        let discovered = await SessionDiscovery(store: fixture.store)
            .workingSet(for: URL(fileURLWithPath: "/"))

        #expect(discovered.isEmpty)
    }

    /// A machine that has never run the CLI has no record directory. That is an empty roster, not a
    /// failure to report.
    @Test
    func `a missing record directory sweeps to nothing`() async {
        let absent = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let discovery = SessionDiscovery(store: TranscriptRecordStore(rootURL: absent))

        #expect(await discovery.workingSet(for: URL(fileURLWithPath: "/tmp/checkout")).isEmpty)
    }

    @Test
    func `the working set is newest first`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let older = try fixture.write(
            FixtureTranscript(name: "older", cwd: projectURL.path, modifiedAgo: 600),
        )
        let newer = try fixture.write(
            FixtureTranscript(name: "newer", cwd: projectURL.path, modifiedAgo: 60),
        )

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: projectURL)

        #expect(discovered == [newer.standardizedFileURL, older.standardizedFileURL])
    }
}
