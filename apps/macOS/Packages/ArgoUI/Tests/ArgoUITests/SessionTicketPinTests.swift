import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// The link a reader places by hand (#1092), and the reason it exists: Argo derives a Ticket number
/// from `#<N>` in a branch or from a `ticket-<N>-` worktree folder, and a checkout named after
/// words instead has neither.
///
/// That is most real checkouts — `ticket-bound-memory`, `ticket-hub-roster`, `argo/scope-switch` —
/// so before the pin the route between a Session and its Ticket was inert in BOTH directions for
/// them: no link on the tab line to press, and no claim for the ticket's head to name. The cases
/// below drive the whole chain, from the annotation through the projection to the claim join.
@Suite("The Ticket a reader pins to a Session")
struct SessionTicketPinTests {
    /// A worktree named after words rather than a number, on a branch that names none either — the
    /// checkout most of this repo's own work happens in.
    private static let slugLocation = "/tmp/project/.claude/worktrees/ticket-hub-roster"
    private static let slugBranch = "argo/hub-roster"

    @Test
    @MainActor
    func `a worktree named after words links to nothing, and places no claim`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "chain-a")

        let session = try #require(Self.projection(of: hub).sessions.first)

        // Both parse paths come up empty: no `#<N>` in the branch, no digits after `ticket-`.
        #expect(session.ticket == .unlinked)
        // …so the join has nothing to place, and the ticket's head can name no claimant. This is
        // the state the whole feature was inert in.
        #expect(TicketClaims(over: [session]).numbers.isEmpty)
        #expect(TicketClaims(over: [session]).unplaced == 1)
    }

    @Test
    @MainActor
    func `pinning one lights the link and the claim at once`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "chain-a")
        let annotations = await Self.store().setPinnedTicket(1092, sessionID: "chain-a")

        let session = try #require(
            Self.projection(of: hub, annotations: annotations).sessions.first,
        )

        #expect(session.ticket.link?.number == 1092)
        // DIRECT: the reader said so. Never `derived` — nothing was guessed off a branch.
        #expect(session.ticket.link?.tier == .direct)
        // The tab line now has a route to draw…
        #expect(SessionHeaderProjection.header(from: session).issue?.link?.number == 1092)
        // …and the same one gesture placed the claim the ticket's head reads back.
        #expect(TicketClaims(over: [session]).claimants[1092]?.first?.id == "chain-a")
    }

    @Test
    @MainActor
    func `dropping the pin gives the derived link back`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "chain-a", branch: "argo/#741-anchor-the-feed")
        let store = Self.store()
        await store.setPinnedTicket(1092, sessionID: "chain-a")
        let annotations = await store.setPinnedTicket(nil, sessionID: "chain-a")

        let session = try #require(
            Self.projection(of: hub, annotations: annotations).sessions.first,
        )

        // The reset is the absence of a pin, not a record of one — so the branch answers again.
        #expect(session.ticket.link?.number == 741)
        #expect(session.ticket.link?.tier == .derived)
    }

    @Test
    @MainActor
    func `the pin outranks the number the branch names`() async throws {
        let hub = Hub(projectURL: URL(fileURLWithPath: "/tmp/project"))
        await Self.observe(hub, id: "chain-a", branch: "argo/#741-anchor-the-feed")
        let annotations = await Self.store().setPinnedTicket(1092, sessionID: "chain-a")

        let session = try #require(
            Self.projection(of: hub, annotations: annotations).sessions.first,
        )

        // A Session that moved onto other work is the case: the branch is a fact about how the
        // checkout was cut, and the pin is what the reader says the Session is FOR.
        #expect(session.ticket.link?.number == 1092)
    }

    /// The two DIRECT facts, ranked where the ranking lives. The spawn's claim is a fact about a
    /// moment that has passed; the pin is the only one of the two a reader can revise, so a Session
    /// started on the wrong ticket has no other repair.
    @Test
    func `the pin outranks the number the spawn claimed`() {
        #expect(CockpitPresentation.Session.Issue
            .directNumber(pinnedTo: 1092, claimedAt: 741) == 1092)
        #expect(CockpitPresentation.Session.Issue
            .directNumber(pinnedTo: nil, claimedAt: 741) == 741)
        #expect(CockpitPresentation.Session.Issue
            .directNumber(pinnedTo: nil, claimedAt: nil) == nil)
    }

    /// A store over a location that is not the machine's own: one pointed at Application Support
    /// would annotate the Sessions of whoever ran the suite. The folder is left in the temporary
    /// directory the OS empties, which is what every other annotation suite here does.
    private static func store() -> SessionAnnotationStore {
        SessionAnnotationStore(fileURL: URL(fileURLWithPath: NSTemporaryDirectory())
            .appending(path: "argo-ticket-pin-\(UUID().uuidString)/sessions.json"))
    }

    @MainActor
    private static func projection(
        of hub: Hub, annotations: SessionAnnotations = .empty,
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [], activeProjectID: nil, hub: hub,
            // Bound throughout: with no provider bound every reading below is `unread` before a
            // branch or a pin was ever consulted (#894).
            readings: .init(annotations: annotations, isTicketProviderBound: true),
        )
    }

    /// Drive one finished tail in and yield until the roster has read it — the
    /// `SessionBranchTicketTests` harness, over a worktree whose folder names no number.
    @MainActor
    private static func observe(_ hub: Hub, id: String, branch: String = slugBranch) async {
        let stream = AsyncStream<[TranscriptEvent]> { continuation in
            continuation.yield([
                .cwd(slugLocation),
                .branch(branch),
                .prompt(text: "Sweep the Hub roster", images: [], atMs: nil),
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
}

/// What the tab line's picker puts in front of a reader (#1092) — the derivation behind the menu,
/// in the package where a test can reach it rather than in the view.
@Suite("The Ticket picker's offering")
struct SessionTicketLinkingTests {
    private static func session(pinned: Int? = nil) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "chain-a",
            title: "A Session",
            access: .managed,
            status: .idle,
            annotations: .init(pinnedTicket: pinned),
        )
    }

    private static let backlog = [
        Ticket(number: 272, title: "Open, oldest", status: "Todo", closure: .open),
        Ticket(number: 1092, title: "Open, newest", status: "Todo", closure: .open),
        Ticket(number: 609, title: "Already finished", status: "Done", closure: .resolved),
    ]

    @Test
    func `the offering is the open backlog, newest first`() {
        let linking = SessionTicketLinking.over(
            tickets: Self.backlog, session: Self.session(), link: { _, _ in },
        )

        // A closed ticket beside the open ones would invite attaching a Session to finished work.
        #expect(linking.options.map(\.number) == [1092, 272])
        #expect(linking.options.first?.label == "#1092: Open, newest")
        #expect(linking.isOffered)
    }

    /// The one exception: the ticket already pinned stays on the list wherever it now sits, so a
    /// pin whose ticket closed under it is still something the reader can see and take back.
    @Test
    func `a pinned ticket stays on the list after it closes`() {
        let linking = SessionTicketLinking.over(
            tickets: Self.backlog, session: Self.session(pinned: 609), link: { _, _ in },
        )

        #expect(linking.options.map(\.number) == [1092, 609, 272])
        #expect(linking.pinned == 609)
    }

    @Test
    func `nothing is offered with no Session selected`() {
        let linking = SessionTicketLinking.over(
            tickets: Self.backlog, session: nil, link: { _, _ in },
        )

        #expect(linking.options.isEmpty)
        // …and the picker is not drawn at all, rather than drawn over a selection that is not
        // there.
        #expect(!linking.isOffered)
    }

    /// A backlog nobody has read offers nothing to pick — and with no pin to drop either, there is
    /// no control to draw: the line stays the reading it was.
    @Test
    func `an unread backlog offers no control at all`() {
        #expect(!SessionTicketLinking
            .over(tickets: [], session: Self.session(), link: { _, _ in }).isOffered)
        #expect(SessionTicketLinking
            .over(tickets: [], session: Self.session(pinned: 1092), link: { _, _ in }).isOffered)
    }

    @Test
    func `the choice is written against the Session it was made on`() {
        var written: (String, Int?)?
        let linking = SessionTicketLinking.over(
            tickets: Self.backlog, session: Self.session(), link: { written = ($0, $1) },
        )

        linking.link(1092)

        #expect(written?.0 == "chain-a")
        #expect(written?.1 == 1092)
    }
}
