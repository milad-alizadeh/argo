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
        number: 812, title: "The views sidebar", status: "open", closure: .open, blockersRead: true,
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
    func `a live Session on a ticket claims it, and an ended one does not`() {
        let running = RosterSessionFixture.session(id: "A", issue: 812)
        let over = RosterSessionFixture.session(id: "B", status: .ended, issue: 812)

        #expect(Self.room(items: [Self.read], sessions: [running], health: Self.health(.healthy))
            .view(.inProgress)?.count == 1)
        #expect(Self.room(items: [Self.read], sessions: [over], health: Self.health(.healthy))
            .view(.inProgress)?.count == .zero)
    }

    /// The two views partition the open set only where the edges were READ. A provider that cannot
    /// say what blocks what cannot fill either, so both go quiet rather than one of them asserting
    /// the whole backlog is clear.
    @Test
    func `a provider with no dependency edges fills neither view`() {
        let room = Self.room(items: [Self.unedged], health: Self.health(.healthy))

        #expect(room.view(.allOpen)?.count == 1)
        #expect(room.view(.unblocked)?.count == .zero)
        #expect(room.view(.blocked)?.count == .zero)
    }

    /// Opening `Blocked` against such a provider is a no-op rather than a page reading zero of
    /// nothing: the room still has open work, so it draws the view empty and not a vacancy.
    @Test
    func `the Blocked view over unread edges no-ops`() {
        let room = Self.room(items: [Self.unedged], health: Self.health(.healthy), view: .blocked)

        #expect(room.vacancy == nil)
        #expect(room.backlog.isEmpty)
    }

    @Test
    func `a ticket whose edges were never read draws no Blocked by section`() {
        let room = Self.room(items: [Self.unedged], health: Self.health(.healthy))

        #expect(room.ticket?.blockedBy.isEmpty == true)
    }

    /// The provider's word renders verbatim and Argo's bucket sits beside it — neither in place of
    /// the other (#272).
    @Test
    func `the status word is the provider's and the bucket is Argo's`() {
        let claimed = RosterSessionFixture.session(id: "A", issue: 812)
        let room = Self.room(items: [Self.read], sessions: [claimed], health: Self.health(.healthy))

        #expect(room.ticket?.status == "open")
        #expect(room.ticket?.bucket == .claimed)
    }

    /// A provider carrying no type words has no charts — a group ABSENT rather than one reading
    /// zero, which is where this room starts on a repository with issue types switched off.
    @Test
    func `charts are the provider's own PRD-typed parents`() {
        let chart = WorkItem(
            number: 607, title: "Wayfinder: the Work room", status: "open", closure: .open,
            type: "PRD", children: [812], blockersRead: true,
        )
        let untyped = Self.room(items: [chart.untyped, Self.read], health: Self.health(.healthy))
        let typed = Self.room(items: [chart, Self.read], health: Self.health(.healthy))

        #expect(untyped.charts.isEmpty)
        #expect(typed.charts.map(\.id) == [607])
        #expect(typed.charts.map(\.count) == [1])
    }
}

private extension WorkItem {
    var untyped: WorkItem {
        WorkItem(
            number: number, title: title, status: status, closure: closure,
            children: children, blockersRead: blockersRead,
        )
    }
}
