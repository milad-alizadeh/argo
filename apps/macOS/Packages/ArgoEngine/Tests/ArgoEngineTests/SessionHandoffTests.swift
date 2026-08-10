@testable import ArgoEngine
import Foundation
import Testing

@Suite("Session handoff")
@MainActor
struct SessionHandoffTests {
    /// Story 47's whole sequence: type `/handoff`, wait for what it writes, open a Session seeded
    /// with it. Asserted as an order and not as three calls, because the order IS the feature — a
    /// spawn that ran before the brief landed would open a fresh Session on nothing.
    @Test
    func `a handoff types the command, waits for the brief, then opens a Session on it`(
    ) async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        // The brief appears while Argo is waiting, which is the real shape: `/handoff` is a whole
        // turn of work and is never done by the first look.
        fixture.host.onPause = { fixture.writeBriefOnce() }

        let outcome = try await fixture.handoff.run(fixture.request)

        let typed = try #require(fixture.host.typed.first)
        #expect(fixture.host.typed.count == 1)
        #expect(typed.sessionID == "full-session")
        #expect(typed.text.hasPrefix("/handoff "))
        // The newline is the Return that submits it: a line left in the composer is a handoff
        // nobody started.
        #expect(typed.text.hasSuffix("\n"))
        #expect(typed.text.contains(outcome.briefPath))
        #expect(outcome.sessionID == "fresh-session")
    }

    /// Story 48. The fresh Session runs in the SAME folder, which is what makes it the same branch
    /// — and everything derived from a branch derives the same way for both rows.
    @Test
    func `the fresh Session inherits the folder and is opened on the brief and the issue`(
    ) async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        fixture.host.onPause = { fixture.writeBriefOnce() }

        let outcome = try await fixture.handoff.run(fixture.request)

        let seed = try #require(fixture.host.seeds.first)
        #expect(seed.cwd == "/Users/milad/Developer/argo")
        let opening = try #require(seed.opening)
        #expect(opening.contains(outcome.briefPath))
        #expect(opening.contains("#513"))
    }

    /// The edge that makes the two rows a chain. Recorded by the sequence that produced it, so a
    /// handoff cannot succeed and leave the link to whoever remembered to ask for one.
    @Test
    func `a completed handoff records which Session the work went to`() async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        fixture.host.onPause = { fixture.writeBriefOnce() }

        let outcome = try await fixture.handoff.run(fixture.request)

        let chained = try #require(fixture.host.chained.first)
        #expect(fixture.host.chained.count == 1)
        #expect(chained.sessionID == "full-session")
        #expect(chained.fresh == outcome.sessionID)
    }

    /// And a handoff that did not happen records nothing. A link naming a Session no refusal ever
    /// opened would point at a row that does not exist — the fabrication the whole orchestration is
    /// built to refuse.
    @Test
    func `a refused handoff records no chain at all`() async throws {
        let fixture = HandoffFixture(patience: HandoffPatience(pollMs: 100, limitMs: 300))
        defer { fixture.remove() }

        await #expect(throws: SessionHandoff.Failure.self) {
            try await fixture.handoff.run(fixture.request)
        }

        #expect(fixture.host.chained.isEmpty)
    }

    /// A prompt that asserted a ticket number Argo never read would be the fresh Session's first
    /// fact and a false one.
    @Test
    func `a Session serving no issue opens on the brief alone`() async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        fixture.host.onPause = { fixture.writeBriefOnce() }

        _ = try await fixture.handoff.run(SessionHandoff.Request(
            sessionID: "full-session",
            cwd: "/Users/milad/Developer/argo",
        ))

        let opening = try #require(fixture.host.seeds.first?.opening)
        #expect(!opening.contains("#"))
        #expect(opening.contains("Continue the work"))
    }

    /// The refusal that must never read as nothing happening: Argo owns no prompt on this Session,
    /// so it types nothing and says so. The button is not offered here at all (story 49) — this is
    /// the belt to that view-level brace.
    @Test
    func `a Session Argo cannot type at is refused rather than half-run`() async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        fixture.host.isSteerable = false

        await #expect(throws: SessionHandoff.Failure.notSteerable) {
            try await fixture.handoff.run(fixture.request)
        }

        #expect(fixture.host.seeds.isEmpty)
    }

    /// The other one. No brief means no fresh Session: the roster never grows a row for work that
    /// was not handed over, and the reason is said in the tool's own terms.
    @Test
    func `a brief that never arrives ends the handoff and spawns nothing`() async throws {
        let fixture = HandoffFixture(patience: HandoffPatience(pollMs: 100, limitMs: 300))
        defer { fixture.remove() }

        await #expect(throws: SessionHandoff.Failure.briefNeverArrived(afterMs: 300)) {
            try await fixture.handoff.run(fixture.request)
        }

        // It typed the command — the Session was asked — and then declined to invent a successor.
        #expect(fixture.host.typed.count == 1)
        #expect(fixture.host.seeds.isEmpty)
    }

    /// Both failures carry a sentence fit to repeat, for the reason `AgentSpawnError` does (#361):
    /// a spawn that reports nothing is indistinguishable from one that never ran.
    @Test
    func `every failure says what went wrong in words`() {
        #expect(SessionHandoff.Failure.notSteerable.detail.contains("terminal"))
        #expect(SessionHandoff.Failure.briefNeverArrived(afterMs: 1_200_000).detail
            .contains("20 minutes"))
    }

    /// A brief that exists but has nothing in it is `/handoff` having started and not finished.
    /// Ending the wait on it would seed the fresh Session with an empty document.
    @Test
    func `an empty brief does not end the wait`() async throws {
        let fixture = HandoffFixture(patience: HandoffPatience(pollMs: 100, limitMs: 300))
        defer { fixture.remove() }
        fixture.host.onPause = { fixture.writeBrief("   \n") }

        await #expect(throws: SessionHandoff.Failure.self) {
            try await fixture.handoff.run(fixture.request)
        }
    }

    /// Each brief is its own file. Two handoffs off one Session must not write over each other's
    /// artifact — the second's wait would end on the first's brief.
    @Test
    func `two handoffs of one Session name two briefs`() async throws {
        let fixture = HandoffFixture()
        defer { fixture.remove() }
        fixture.host.onPause = { fixture.writeBriefOnce() }

        let first = try await fixture.handoff.run(fixture.request)
        let second = try await fixture.handoff.run(fixture.request)

        #expect(first.briefPath != second.briefPath)
    }

    /// The path is Argo's own and is passed TO the command, so the wait is a question with an
    /// answer rather than a guess at where a skill this repo does not own would have written. A CLI
    /// picks its own Session id, so that id is cut to what a filename can hold rather than trusted
    /// into a path.
    @Test
    func `the brief lands in Argo's own data under a name the Session cannot break`() {
        let url = HandoffScript.briefURL(
            in: URL(fileURLWithPath: "/tmp/argo"),
            sessionID: "../../etc/passwd",
            atMs: 1700,
        )

        #expect(url.deletingLastPathComponent().path == "/tmp/argo")
        #expect(url.lastPathComponent == "handoff-etcpasswd-1700.md")
    }
}
