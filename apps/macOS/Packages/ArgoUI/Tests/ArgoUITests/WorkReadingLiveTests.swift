import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// The room read from what the app actually holds (#820) — the poll's listing, the roster, and the
/// Work Item Binding's health. Every case here is a fact NOT read, and what the room says instead.
@Suite("Work room live reading")
struct WorkReadingLiveTests {
    private static let account = AccountRecord(
        provider: .github, providerAccountID: "1", displayName: "octocat",
    )

    private static func health(_ health: BindingHealth, port: AccountPort = .workItem)
        -> ConnectionHealthReading {
        ConnectionHealthReading(connections: [
            PortConnection(port: port, account: account, health: health),
        ])
    }

    /// A Binding a read has LANDED through, which is what lets the room say anything about an empty
    /// listing at all. Most cases below want this rather than bare health.
    private static let answered = health(
        BindingHealth(fault: nil, lastSuccess: Date(timeIntervalSince1970: 1)),
    )

    private static func room(
        items: [WorkItem] = [],
        sessions: [CockpitPresentation.Session] = [],
        health: ConnectionHealthReading = .quiet,
        view: WorkView = .allOpen,
    )
        -> WorkRoomProjection.Room {
        let reading = WorkReading.live(
            WorkReading.Sources(
                items: items, sessions: sessions, health: health, project: "argo",
            ),
            showing: items.first?.number,
        )
        return WorkRoomProjection.room(from: reading, in: view)
    }

    private static let read = WorkItem(
        number: 812, title: "The views sidebar", status: "open", closure: .open, blockedBy: [],
    )

    /// The tier the room ships in: a provider that exposes no dependency edges. The room draws —
    /// there IS a backlog — and only the claims resting on edges go quiet.
    private static let unedged = WorkItem(
        number: 812, title: "The views sidebar", status: "open", closure: .open,
    )

    @Test
    func `nothing bound is a vacant room rather than four views reading zero`() {
        #expect(Self.room(items: [Self.read]).vacancy == .unbound)
    }

    @Test
    func `a Binding nothing has read through draws no state on the foot`() {
        // Not idle. A green dot over a read that has never landed is a false DIRECT.
        let room = Self.room(items: [Self.read], health: Self.health(.healthy))

        #expect(room.provider?.name == "GitHub")
        #expect(room.provider?.account == "octocat")
        #expect(room.provider?.state == nil)
    }

    /// The sharpest of the three nothings: bound, nobody has answered, and the listing is empty
    /// because of it. Saying "every Work Item is closed" here is the false DIRECT — and a Binding
    /// failing all session sits in this state for the whole launch, not for an instant.
    @Test
    func `a Binding that has not answered is not an empty backlog`() {
        let room = Self.room(health: Self.health(.healthy))

        #expect(room.vacancy == .unread(provider: "GitHub"))
    }

    @Test
    func `a provider that answered with nothing says so in its own name`() {
        let room = Self.room(health: Self.answered)

        #expect(room.vacancy == .nothingOpen(provider: "GitHub"))
    }

    struct HealthCase: Sendable {
        let fault: ConnectionFault?
        let state: ArgoOperationalState?
    }

    private static let states = [
        HealthCase(fault: nil, state: .idle),
        HealthCase(fault: .grantRefused, state: .failure),
        HealthCase(fault: .read(.rateLimited), state: .attention),
    ]

    @Test(arguments: states)
    func `the foot's dot is the Binding's own health`(_ example: HealthCase) {
        let health = BindingHealth(
            fault: example.fault,
            lastSuccess: Date(timeIntervalSince1970: 1),
        )
        let room = Self.room(items: [Self.read], health: Self.health(health))

        #expect(room.provider?.state == example.state)
    }

    /// The Work Item port alone. A code host that is failing is a different repair, and a foot that
    /// folded the two would name the wrong one.
    @Test
    func `a code host bound alone leaves the Work room unbound`() {
        let room = Self.room(items: [Self.read], health: Self.health(.healthy, port: .codeHost))

        #expect(room.vacancy == .unbound)
    }

    @Test
    func `a live Session on a ticket claims it`() {
        let running = RosterSessionFixture.session(id: "A", issue: 812)
        let room = Self.room(items: [Self.read], sessions: [running], health: Self.answered)

        #expect(room.view(.inProgress)?.count == 1)
    }

    /// An ended Session's branch still names the ticket it was cut for, and counting that as a
    /// claim would leave `In progress` filling up for the life of the machine.
    @Test
    func `an ended Session claims nothing`() {
        let over = RosterSessionFixture.session(id: "B", status: .ended, issue: 812)
        let room = Self.room(items: [Self.read], sessions: [over], health: Self.answered)

        #expect(room.view(.inProgress)?.count == .zero)
    }

    /// The two views partition the open set, so neither can be counted where a ticket's edges were
    /// not served. Absent rather than zero: zero is a claim that nothing is blocked.
    @Test
    func `a provider with no dependency edges counts neither view`() {
        let room = Self.room(items: [Self.unedged], health: Self.answered)

        #expect(room.view(.allOpen)?.count == 1)
        #expect(room.view(.unblocked)?.count == nil)
        #expect(room.view(.blocked)?.count == nil)
    }

    /// Opening `Blocked` against such a provider is a no-op rather than a page reading zero of
    /// nothing: the room still has open work, so it draws the view empty and not a vacancy.
    @Test
    func `the Blocked view over unread edges no-ops`() {
        let room = Self.room(items: [Self.unedged], health: Self.answered, view: .blocked)

        #expect(room.vacancy == nil)
        #expect(room.backlog.isEmpty)
    }

    @Test
    func `a ticket whose edges were never read draws no Blocked by section`() {
        let room = Self.room(items: [Self.unedged], health: Self.answered)

        #expect(room.ticket?.blockedBy.isEmpty == true)
    }

    /// The provider's word renders verbatim (#272) — Argo's own bucket never stands in for it.
    @Test
    func `the status word is the provider's own`() {
        let room = Self.room(items: [Self.read], health: Self.answered)

        #expect(room.ticket?.status == "open")
    }

    /// And the bucket sits beside that word rather than over it: a claim is Argo's alone, and no
    /// provider word could have said it.
    @Test
    func `the bucket is Argo's, beside that word`() {
        let claimed = RosterSessionFixture.session(id: "A", issue: 812)
        let room = Self.room(items: [Self.read], sessions: [claimed], health: Self.answered)

        #expect(room.ticket?.bucket == .claimed)
    }

    /// A chart is a PRD-shaped PARENT (`cockpit-work-room.md`), so a typed ticket with no children
    /// is not one — its row would open onto a Route with nothing on it.
    @Test
    func `a chart is a PRD-typed parent`() {
        let leaf = WorkItem(
            number: 606, title: "A typed leaf", status: "open", closure: .open, type: "PRD",
            blockedBy: [],
        )
        let room = Self.room(items: [Self.chart, leaf, Self.read], health: Self.answered)

        #expect(room.charts.map(\.id) == [607])
        #expect(room.charts.map(\.count) == [1])
    }

    /// Where the provider carries no type at all the role falls back to hierarchy
    /// (`CONTEXT.md` L1 · Work Item), which is the only reading a repository with issue types
    /// switched off can have. A ticket the provider DID type does not fall back.
    @Test
    func `an untyped parent is chart-shaped, and a typed non-PRD one is not`() {
        let untyped = Self.room(items: [Self.chart.untyped, Self.read], health: Self.answered)
        let tasked = Self.room(items: [Self.chart.typed("task"), Self.read], health: Self.answered)

        #expect(untyped.charts.map(\.id) == [607])
        #expect(tasked.charts.isEmpty)
    }

    private static let chart = WorkItem(
        number: 607, title: "Wayfinder: the Work room", status: "open", closure: .open,
        type: "PRD", children: [812], blockedBy: [],
    )
}

private extension WorkItem {
    var untyped: WorkItem {
        WorkItem(copying: self, type: .some(nil))
    }

    func typed(_ word: String) -> WorkItem {
        WorkItem(copying: self, type: word)
    }
}
