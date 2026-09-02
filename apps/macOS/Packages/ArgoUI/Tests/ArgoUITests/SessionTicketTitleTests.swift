import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What a roster row is called once the ticket names it (#745). Every claim here is asserted on
/// BOTH surfaces where it is one, because the whole point is that they read one seam.
@Suite("Session ticket title")
struct SessionTicketTitleTests {
    @Test
    func `a Session on a ticket branch reads the ticket on the roster and the header alike`(
    ) throws {
        let linked = Self.session(issue: .init(number: 741, title: "Anchor the feed"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        #expect(row.title == "#741 — Anchor the feed")
        #expect(SessionHeaderProjection.header(from: linked).title == "#741 — Anchor the feed")
    }

    @Test
    func `the roster and the ⓘ panel word the link the same way`() throws {
        let linked = Self.session(issue: .init(number: 741, title: "Anchor the feed"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)
        let fact = SessionHeaderProjection.header(from: linked).facts.first { $0.term == "Issue" }

        // One composition, in `IssueReading`: a second one would let the two disagree about a fact
        // they are both reading off the same link.
        #expect(row.title == fact?.value)
    }

    @Test
    func `a link the provider has not named yet keeps the derived title`() throws {
        let linked = Self.session(issue: .init(number: 741))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        // `#741` alone carries no more than the `/implement 741` it would replace, so the number
        // on its own is not a promotion.
        #expect(row.title == "/implement 741")
    }

    @Test
    func `a Session with no link keeps its derived title, with no empty hash`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [Self.session()]).first)

        #expect(row.title == "/implement 741")
    }

    @Test
    func `an explicit name outranks the ticket's title`() throws {
        let renamed = Self.session(
            issue: .init(number: 741, title: "Anchor the feed"),
            explicitName: "Tonight's run",
        )

        let row = try #require(SessionRosterProjection.rows(from: [renamed]).first)

        #expect(row.title == "Tonight's run")
        // And Reset lands on the ticket, which is where the Session would be without the rename.
        #expect(row.rename.derived == "#741 — Anchor the feed")
    }

    @Test
    func `the run kind reads on the secondary line once the ticket holds the title`() throws {
        let linked = Self.session(issue: .init(number: 741, title: "Anchor the feed"))

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        // The verb, off the title and onto the line with room for it (#745).
        #expect(row.runKind == "/implement")
        #expect(row.announcement.contains("/implement"))
    }

    @Test
    func `the run kind is not said twice on a Session whose title is still the command`() throws {
        let row = try #require(SessionRosterProjection.rows(from: [Self.session()]).first)

        #expect(row.runKind == nil)
    }

    @Test
    func `a Session whose first prompt was prose has no run kind to move`() throws {
        let linked = Self.session(
            title: "Draw the header", issue: .init(number: 741, title: "Anchor the feed"),
        )

        let row = try #require(SessionRosterProjection.rows(from: [linked]).first)

        #expect(row.runKind == nil)
    }

    @Test
    @MainActor
    func `the branch a Session is on is what links it to its Ticket`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "linked", branch: "argo/#741-anchor-the-feed")

        let session = try #require(Self.projection(of: hub).sessions.first)

        // Derived from the join key and not from the prompt text, which is what makes it work for
        // an external Session too (`CONTEXT.md` L3).
        #expect(session.ticket.link?.number == 741)
        // DERIVED, and it stays that way through the whole projection: a number read off a branch
        // by convention must never reach a surface as one Argo was told (#894).
        #expect(session.ticket.link?.tier == .derived)
        // Nothing has resolved it, so the link carries no words yet.
        #expect(session.ticket.link?.title == nil)
    }

    @Test
    @MainActor
    func `the title Argo resolved for a ticket is the one the row draws`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "linked", branch: "argo/#741-anchor-the-feed")
        let file = Self.throwaway()
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }

        let annotations = await SessionAnnotationStore(fileURL: file)
            .setTicket(.named("Anchor the feed"), sessionID: "linked")

        let session = try #require(Self.projection(of: hub, annotations: annotations)
            .sessions.first)
        #expect(SessionTitle.resolved(for: session) == "#741 — Anchor the feed")
    }

    @Test
    @MainActor
    func `a branch naming a ticket the host denies draws no link at all`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "linked", branch: "argo/#741-anchor-the-feed")
        let file = Self.throwaway()
        defer { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }

        let annotations = await SessionAnnotationStore(fileURL: file)
            .setTicket(.absent, sessionID: "linked")

        // Asked, and there is nothing behind #741. Drawing `Issue #741` anyway would assert a Work
        // Item that does not exist (`CONTEXT.md`, "Honesty tier").
        let session = try #require(Self.projection(of: hub, annotations: annotations)
            .sessions.first)
        // Bound and unrecognised is a READING, not an absence (#894): the header says so rather
        // than dropping the row, which is what a reader repairs a branch off.
        #expect(session.ticket == .unlinked)
        #expect(SessionHeaderProjection.header(from: session).issue == .unlinked)
    }

    @Test
    @MainActor
    func `a Session on the main branch links to nothing`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "unlinked", branch: "main")

        let session = try #require(Self.projection(of: hub).sessions.first)

        #expect(session.ticket == .unlinked)
    }

    @Test
    func `the roster the ticket specimens render carries the case the ticket is about`() {
        // The `ticketRoster` PNGs are the only evidence this rendering has, so the fixture has to
        // carry both several Sessions sharing one ticket and a row that resolved none.
        let rows = TicketFixture.rows
        let shared = rows.filter { $0.title.hasPrefix("#741 — ") }

        #expect(shared.count == 3)
        // Told apart by the secondary line alone, which is the judgement the render is for.
        #expect(Set(shared.compactMap(\.runKind)).count == 3)
        #expect(rows.contains { $0.runKind == nil })
    }

    /// A location that is not the machine's own: a store pointed at Application Support would
    /// rename the Sessions of whoever ran the suite.
    private static func throwaway() -> URL {
        URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-ticket-title-\(UUID().uuidString)/sessions.json")
    }

    @MainActor
    private static func projection(
        of hub: Hub, annotations: SessionAnnotations = .empty,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [], activeProjectID: nil, hub: hub,
            // Bound throughout: every case here is about which Ticket a branch names, and with no
            // provider bound the answer would be `unread` before the branch was ever read (#894).
            readings: .init(annotations: annotations, isTicketProviderBound: true),
        )
    }

    /// Drive one finished tail in and yield until the roster has read it — the observable end of a
    /// tail, which is the Hub's own task and is not handed back.
    @MainActor
    private static func observe(_ hub: Hub, id: String, branch: String) async {
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield([
                .cwd("/Users/milad/Developer/argo"),
                .branch(branch),
                .prompt(text: "/implement 741", images: [], atMs: nil),
                .turnEnded(.endTurn),
            ])
            continuation.finish()
        }
        await hub.startObserving(TranscriptObservation(
            id: id,
            sourceURL: URL(fileURLWithPath: "/tmp/\(id).jsonl"),
            events: stream,
        ))
        for _ in 0 ..< 200 where projection(of: hub).sessions.first?.status != .idle {
            await Task.yield()
        }
    }

    private static func session(
        title: String = "/implement 741",
        issue: CockpitPresentation.Session.Issue? = nil,
        explicitName: String? = nil,
    )
        -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "session",
            title: title,
            access: .managed,
            status: .idle,
            chain: .init(program: .init(cli: .claude, model: "claude-opus-5")),
            work: .init(
                location: "/Users/milad/Developer/argo",
                workspace: .init(branch: "argo/#741-anchor-the-feed"),
                ticket: issue.map { .linked($0) } ?? .unread,
            ),
            annotations: .init(explicitName: explicitName),
        )
    }
}
