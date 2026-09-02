import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// What the Ticket Binding's HEALTH makes of the room (#820): which of the three nothings a vacant
/// room is saying, and the state the foot's dot draws. Every case here is a fact NOT read, and what
/// the room says instead.
///
/// The other two live sources have suites of their own over the same fixture: the roster is
/// `TicketsProgressCountTests`, the poll's listing is `TicketsServedItemTests`.
@Suite("Tickets room live reading")
@MainActor
struct TicketsReadingLiveTests {
    struct HealthCase: Sendable {
        let fault: ConnectionFault?
        let state: ArgoOperationalState?
    }

    nonisolated private static let states = [
        HealthCase(fault: nil, state: .idle),
        HealthCase(fault: .grantRefused, state: .failure),
        HealthCase(fault: .read(.rateLimited), state: .attention),
    ]

    @Test
    func `nothing bound is a vacant room rather than four views reading zero`() {
        #expect(TicketsLiveFixture.room(items: [TicketsLiveFixture.read]).vacancy == .unbound)
    }

    @Test
    func `a Binding nothing has read through draws no state on the foot`() {
        // Not idle. A green dot over a read that has never landed is a false DIRECT.
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            health: TicketsLiveFixture.health(.healthy),
        )

        #expect(room.provider?.name == "GitHub")
        #expect(room.provider?.account == "octocat")
        #expect(room.provider?.state == nil)
    }

    /// The sharpest of the three nothings: bound, nobody has answered, and the listing is empty
    /// because of it. Saying "every Ticket is closed" here is the false DIRECT — and a Binding
    /// failing all session sits in this state for the whole launch, not for an instant.
    @Test
    func `a Binding that has not answered is not an empty backlog`() {
        let room = TicketsLiveFixture.room(health: TicketsLiveFixture.health(.healthy))

        #expect(room.vacancy == .unread(provider: "GitHub"))
    }

    @Test
    func `a provider that answered with nothing says so in its own name`() {
        let room = TicketsLiveFixture.room(health: TicketsLiveFixture.answered)

        #expect(room.vacancy == .nothingOpen(provider: "GitHub"))
    }

    @Test(arguments: states)
    func `the foot's dot is the Binding's own health`(_ example: HealthCase) {
        let health = BindingHealth(
            fault: example.fault,
            lastSuccess: Date(timeIntervalSince1970: 1),
        )
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            health: TicketsLiveFixture.health(health),
        )

        #expect(room.provider?.state == example.state)
    }

    /// The Ticket port alone. A code host that is failing is a different repair, and a foot that
    /// folded the two would name the wrong one.
    @Test
    func `a code host bound alone leaves the Tickets room unbound`() {
        let room = TicketsLiveFixture.room(
            items: [TicketsLiveFixture.read],
            health: TicketsLiveFixture.health(.healthy, port: .codeHost),
        )

        #expect(room.vacancy == .unbound)
    }
}
