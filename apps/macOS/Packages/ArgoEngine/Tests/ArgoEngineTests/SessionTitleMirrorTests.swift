@testable import ArgoEngine
import Foundation
import Synchronization
import Testing

/// Mirroring the name Argo holds onto the CLI's own Session title (#1494).
///
/// The title Argo shows never left Argo, so the same Session read `milads-mac-mini-local-goofy-
/// river` in Claude's mobile, desktop and web apps. `claude` renames itself with `/rename <title>`,
/// typed at the prompt exactly as `/model` and `/effort` are — verified against 2.1.263, where the
/// command takes its name inline and the `customTitle` it writes outranks the `ai-title` the CLI's
/// own summariser writes.
///
/// One-way, and best effort throughout. The annotation store stays the roster's only source of
/// truth, and every refusal below is silence rather than a failed rename.
@Suite("Session title mirror")
@MainActor
struct SessionTitleMirrorTests {
    /// A title is a Ticket's words or a sentence somebody typed, so it can carry anything.
    /// `/rename`
    /// takes its name to the end of the LINE, which makes a second line a second thing typed at
    /// that prompt — with this line's own Return already on its way behind it.
    @Test
    func `a title carrying newlines is folded onto one line`() {
        #expect(ClaudeRunFacts.renameLine("Rename\nthe Session") == "/rename Rename the Session")
        #expect(ClaudeRunFacts.renameLine("Rename\r\n/clear") == "/rename Rename /clear")
        #expect(ClaudeRunFacts.renameLine("Tabbed\tacross") == "/rename Tabbed across")
        #expect(ClaudeRunFacts.renameLine("Bell\u{07}rung") == "/rename Bell rung")
    }

    /// Folded rather than deleted, so the words either side of a break stay two words — and the
    /// runs that folding leaves behind collapse, so a paragraph does not arrive as a gap.
    @Test
    func `the whitespace a folded title leaves behind collapses`() {
        #expect(ClaudeRunFacts.renameLine("  Trimmed  \n\n  and collapsed  ")
            == "/rename Trimmed and collapsed")
    }

    /// `/rename` with no argument is not this rename with an empty name: it is a different command,
    /// and it opens a dialog nobody would come back to close.
    @Test
    func `a title that folds down to nothing is no line at all`() {
        #expect(ClaudeRunFacts.renameLine("") == nil)
        #expect(ClaudeRunFacts.renameLine("   ") == nil)
        #expect(ClaudeRunFacts.renameLine("\n\t\u{0B}") == nil)
    }

    /// Nothing is truncated. A title long enough to be awkward is still one line, and a cut here
    /// would be Argo deciding how much of a Ticket's words Claude's own apps may show.
    @Test
    func `a title long enough to be awkward is still sent whole, on one line`() throws {
        let long = String(repeating: "Derive the link ", count: 40)

        let line = try #require(ClaudeRunFacts.renameLine(long))

        #expect(line.hasPrefix("/rename Derive the link "))
        #expect(line.count > 600)
        #expect(!line.contains("\n"))
    }

    /// The same paced paste and separate Return the other two lines take: `/` opens the command
    /// picker inside the input batch, and a Return in that batch is eaten by the picker (#682).
    @Test
    func `the rename arrives at the prompt as a paced paste and a separate Return`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let claim = try await fixture.hub.spawnSession(seed: SessionSeed(mode: .code))

        try await fixture.hub.driver.setTitle("Derive the link", for: claim.value)
        while (fixture.host.started.last?.written.count ?? 0) < 2 {
            await Task.yield()
        }

        let written = try #require(fixture.host.started.last?.written)
        #expect(written == ["\u{1B}[200~/rename Derive the link\u{1B}[201~", ClaudeTurn.submit])
    }

    /// Mid-Turn the CLI queues a typed line as the next prompt instead of running it, and under a
    /// Permission or a question the DIALOG takes the line and the Return behind it (#1217). Neither
    /// is a failed rename: the Argo-side name is already written and is what the roster draws.
    @Test
    func `no rename is typed while a Turn is in flight`() async throws {
        let live = Mutex<Set<String>>([])
        let fixture = try SpawnFixture(liveness: { live.withLock { $0 } })
        defer { fixture.remove() }
        live.withLock { $0 = [fixture.resolvedProjectPath] }
        _ = try await fixture.hub.spawnSession()
        await fixture.hub.refreshLiveness()
        await hubObserveToEnd(fixture.hub, hubTestObservation(
            id: "session-from-cli",
            events: [
                .cwd(fixture.projectURL.path),
                .mode(cli: "acceptEdits"),
                .prompt(text: "Off you go", images: [], atMs: Date().epochMs),
            ],
        ))
        #expect(fixture.hub.sessions.map(\.status) == [.running])

        await #expect(throws: SessionDriveError.titleBusy) {
            try await fixture.hub.driver.setTitle("Derive the link", for: "session-from-cli")
        }
        #expect(fixture.host.started.last?.written.isEmpty == true)
    }

    /// A Session Argo owns no terminal for — an external one, or a managed one whose process has
    /// gone — is refused on the same fact its provenance is read from.
    @Test
    func `a Session Argo holds no claim on takes no rename`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }

        await #expect(throws: SessionDriveError.notDrivable) {
            try await fixture.hub.driver.setTitle("Derive the link", for: "never-ours")
        }
    }

    /// `codex` has no `/rename` and no title of its own, and it parses `/` in a TUI composer Argo
    /// never touches — so the line would reach the model as prose asking it to rename something.
    @Test
    func `a Codex Session attempts no rename at all`() async throws {
        let fixture = try SpawnFixture()
        defer { fixture.remove() }
        let session = try await fixture.openCodexSession()

        await #expect(throws: SessionDriveError.titleUnsupported) {
            try await fixture.hub.driver.setTitle("Derive the link", for: session.id)
        }
        #expect(session.server.turns.isEmpty)
    }
}
