import ArgoEngine
@testable import ArgoUI
import Testing

/// The Tickets room's row, wired (#872): what a new ticket composes to, which of two readings names
/// the Session's ticket, and the claim that comes back off a seeded spawn.
@Suite("Tickets room verbs")
struct TicketsVerbTests {
    // MARK: - New ticket

    @Test(arguments: ["", "   ", "\n"])
    func `a composition with no title is nothing a provider would take`(title: String) {
        #expect(TicketComposition(title: title, body: "Some prose").draft == nil)
    }

    @Test func `a composition trims what was typed around it`() {
        let draft = TicketComposition(title: "  Wire the verbs  ", body: " Prose. ").draft

        #expect(draft?.title == "Wire the verbs")
        #expect(draft?.body == "Prose.")
    }

    /// Absent and empty are one state on a ticket body, and `nil` is the one that says nothing was
    /// written — a provider handed `""` would file a body of nothing.
    @Test(arguments: ["", "   "])
    func `a composition with no prose sends no body`(body: String) {
        #expect(TicketComposition(title: "Wire the verbs", body: body).draft?.body == nil)
    }

    // MARK: - Which reading names the Session's ticket

    /// #872's round trip: Argo cuts no branch, so a Session started on a ticket is claimed by the
    /// seed alone.
    @Test func `a Session started on a ticket names it with no branch at all`() {
        let issue = CockpitPresentation.Session.Issue(
            claimed: 872, branch: nil, location: nil, title: nil,
        )

        #expect(issue?.number == 872)
    }

    /// The DIRECT reading outranks the DERIVED one: a Session started on 872 whose branch was
    /// later cut for something else is still the Session that was started for 872.
    @Test func `the claim outranks the branch where the two disagree`() {
        let issue = CockpitPresentation.Session.Issue(
            claimed: 872, branch: "argo/#873-backlog-search", location: nil, title: nil,
        )

        #expect(issue?.number == 872)
    }

    /// The reading #745 built is untouched where nothing claimed anything.
    @Test func `a Session claiming nothing still reads its branch`() {
        let issue = CockpitPresentation.Session.Issue(
            claimed: nil, branch: "argo/#873-backlog-search", location: nil, title: nil,
        )

        #expect(issue?.number == 873)
    }

    /// The two readings are never rendered as each other (#894): a number Argo was TOLD is DIRECT,
    /// and one read off a branch by convention is DERIVED. Without this the branches could be
    /// swapped and nothing would notice — the tier is the whole of what the link carries besides
    /// its number (`CONTEXT.md` Honesty tier).
    @Test func `a claimed link is DIRECT and a branch-read one is DERIVED`() {
        let claimed = CockpitPresentation.Session.Issue(
            claimed: 872, branch: nil, location: nil, title: nil,
        )
        let derived = CockpitPresentation.Session.Issue(
            claimed: nil, branch: "argo/#873-backlog-search", location: nil, title: nil,
        )

        #expect(claimed?.tier == .direct)
        #expect(derived?.tier == .derived)
    }

    /// `.absent` is the host saying nothing sits behind a number READ OFF A BRANCH, which is the
    /// only reading that needs confirming. A claim Argo was told at the spawn does not.
    @Test func `a host that cannot name the ticket does not un-claim the Session`() {
        let issue = CockpitPresentation.Session.Issue(
            claimed: 872, branch: nil, location: nil, title: .absent,
        )

        #expect(issue?.number == 872)
        #expect(issue?.title == nil)
    }

    /// …and the DERIVED half keeps the rule #745 gave it: a branch naming a ticket that does not
    /// exist draws nothing rather than a guess.
    @Test func `a branch naming a ticket the host has nothing behind links to nothing`() {
        #expect(
            CockpitPresentation.Session.Issue(
                claimed: nil, branch: "argo/#873-backlog-search", location: nil, title: .absent,
            ) == nil,
        )
    }

    @Test func `a Session with neither reading links to nothing`() {
        #expect(
            CockpitPresentation.Session.Issue(
                claimed: nil, branch: "main", location: nil, title: nil,
            ) == nil,
        )
    }

    // MARK: - …and the backlog row that reads it back

    @Test func `the room draws the ticket a live Session claimed as claimed`() {
        let reading = TicketsReading.live(
            TicketsReading.Sources(
                tickets: .nothing,
                sessions: [Self.session(claiming: 872)], health: .quiet, project: nil,
            ),
            showing: nil,
        )

        #expect(reading.claims.numbers == [872])
    }

    private static func session(claiming ticket: Int) -> CockpitPresentation.Session {
        CockpitPresentation.Session(
            id: "fresh",
            title: "New session",
            access: .managed,
            status: .idle,
            // DIRECT: this helper stands for a Session Argo was TOLD the ticket of.
            work: .init(ticket: .linked(.init(number: ticket, title: nil, tier: .direct))),
        )
    }
}
