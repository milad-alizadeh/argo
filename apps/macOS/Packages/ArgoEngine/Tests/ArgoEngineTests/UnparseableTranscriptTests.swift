@testable import ArgoEngine
import Foundation
import Testing

/// The rule spelled a second way, so the fixtures below are not built by the code under test.
private func recordDirectoryName(of path: String) -> String {
    path
        .replacingOccurrences(of: "/", with: "-")
        .replacingOccurrences(of: ".", with: "-")
}

/// `cockpit-failure-states-spec.md` §8 — observation failure is not work failure. A transcript that
/// will not parse is a failure of Argo's READING: the Session still has a file, possibly a live
/// process, and the row stands with its derived facts absent rather than disappearing.
@Suite("Unparseable transcript")
struct UnparseableTranscriptTests {
    /// The `cwd` that places a Session is read out of the file's head, so a file whose records do
    /// not parse reports none — and the directory the CLI itself filed it in is what is left to
    /// place it by. Dropping the row instead is the one rendering that cannot be told apart from
    /// there being no Session at all.
    @Test
    func `an unparseable transcript belongs to the Project whose record directory holds it`()
        async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let corrupt = try fixture.write(FixtureTranscript(
            directory: recordDirectoryName(of: projectURL.path),
            name: "corrupt",
            isUnparseable: true,
        ))

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: projectURL)

        #expect(discovered == [corrupt.standardizedFileURL])
    }

    /// The fallback only ever places a transcript on the roster of the Project it was filed under.
    /// Placing an unreadable one everywhere would be the louder claim, and degrade-down forbids it.
    @Test
    func `an unparseable transcript filed under another Project stays off this roster`()
        async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        try fixture.write(FixtureTranscript(
            directory: recordDirectoryName(of: fixture.path("other-checkout")),
            name: "corrupt",
            isUnparseable: true,
        ))

        #expect(await SessionDiscovery(store: fixture.store).workingSet(for: projectURL).isEmpty)
    }

    /// The row, end to end: it exists, and the one DIRECT fact a file with nothing readable in it
    /// still carries — its path — is what names it.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an unparseable transcript keeps its row, named by its own file`() async throws {
        try await withCorruptTranscript { corrupt, hub in
            #expect(hub.sessions.map(\.sourceURL) == [corrupt])
            #expect(hub.sessions.map(\.title) == ["corrupt"])
        }
    }

    /// The dot follows liveness, not parse success — and with nothing corroborating a process, the
    /// honest reading is `unknown`, which takes no colour role at all. Never `stopped`, which is
    /// the one status the roster spends its failure ink on and belongs to the WORK hitting a wall.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an unparseable transcript establishes no status rather than a stopped one`() async throws {
        try await withCorruptTranscript { _, hub in
            #expect(hub.sessions.map(\.status) == [.unknown])
        }
    }

    /// The `~n%` reading's input, absent rather than zero: a Session no usage was read off is one
    /// Argo cannot say the context of, and `0` would be the opposite claim.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an unparseable transcript reports no context to render a percentage from`() async throws {
        try await withCorruptTranscript { _, hub in
            #expect(hub.sessions.map(\.context) == [.unread])
        }
    }

    /// "Its derived facts go absent", in the one fact that stands for all of them: nothing the
    /// plan line, the turn spine or the feed draws was ever established, because no record parsed.
    /// An unreadable line says a file was WRITTEN, never who wrote it.
    @Test(.timeLimit(.minutes(1)))
    @MainActor
    func `an unparseable transcript establishes no agent activity to draw from`() async throws {
        try await withCorruptTranscript { _, hub in
            #expect(hub.sessions.map(\.hasAgentActivity) == [false])
        }
    }

    /// Where the fallback stops being exact, stated rather than discovered later: it places by the
    /// NAME, and `/a/b` and `/a.b` encode to one name. The price is a row that can land on the
    /// roster of a Project encoding alike; the alternative priced against it is a Session with no
    /// row anywhere, which §8 rules out and which no reader could tell from no Session at all.
    @Test
    func `the fallback places by the name, so two paths encoding alike share it`() async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let dotted = URL(fileURLWithPath: fixture.path("a.b"))
        let nested = try fixture.write(FixtureTranscript(
            directory: recordDirectoryName(of: fixture.path("a/b")),
            name: "corrupt",
            isUnparseable: true,
        ))

        let discovered = await SessionDiscovery(store: fixture.store).workingSet(for: dotted)

        #expect(discovered == [nested.standardizedFileURL])
    }

    /// One Project, one transcript with nothing readable in it, and a Hub swept onto it — the state
    /// every case above asks a different question of.
    @MainActor
    private func withCorruptTranscript(_ assert: (URL, Hub) -> Void) async throws {
        let fixture = try RecordDirectoryFixture()
        defer { fixture.remove() }
        let projectURL = URL(fileURLWithPath: fixture.path("checkout"))
        let corrupt = try fixture.write(FixtureTranscript(
            directory: recordDirectoryName(of: projectURL.path),
            name: "corrupt",
            isUnparseable: true,
        ))
        let hub = testHub(projectURL: projectURL, discovery: SessionDiscovery(store: fixture.store))

        await hub.connect(to: LaunchConfiguration(projectURL: projectURL, transcriptURLs: []))

        await hubSettle { !hub.sessions.isEmpty }
        assert(corrupt.standardizedFileURL, hub)
        await hub.disconnect()
    }
}
