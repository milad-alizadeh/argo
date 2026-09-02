import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation

/// The room built from live sources (#820), for the three suites that read one source each:
/// `TicketsReadingLiveTests` the Binding's health, `TicketsProgressCountTests` the roster, and
/// `TicketsServedItemTests` the poll's listing.
///
/// Beside the suites: nothing the app ships assembles a room from a hand-written `Sources` value.
@MainActor
enum TicketsLiveFixture {
    static let account = AccountRecord(
        provider: .github, providerAccountID: "1", displayName: "octocat",
    )

    static func health(_ health: BindingHealth, port: AccountPort = .ticket)
        -> ConnectionHealthReading {
        ConnectionHealthReading(connections: [
            PortConnection(port: port, account: account, health: health),
        ])
    }

    /// A Binding a read has LANDED through, which is what lets the room say anything about an empty
    /// listing at all. Most cases want this rather than bare health.
    static let answered = health(
        BindingHealth(fault: nil, lastSuccess: Date(timeIntervalSince1970: 1)),
    )

    static func room(
        items: [Ticket] = [],
        sessions: [CockpitPresentation.Session] = [],
        health: ConnectionHealthReading = .quiet,
        view: TicketsView = .allOpen,
    )
        -> TicketsRoomProjection.Room {
        let reading = TicketsReading.live(
            TicketsReading.Sources(
                tickets: .init(items: items, closed: nil),
                sessions: sessions, health: health, project: "argo",
            ),
            showing: items.first?.number,
        )
        return TicketsRoomProjection.room(from: reading, in: view)
    }

    static let read = Ticket(
        number: 812, title: "The views sidebar", status: "open", closure: .open, blockedBy: [],
    )

    /// The tier the room ships in: a provider that exposes no dependency edges. The room draws —
    /// there IS a backlog — and only the claims resting on edges go quiet.
    static let unedged = Ticket(
        number: 812, title: "The views sidebar", status: "open", closure: .open,
    )

    static let chart = Ticket(
        number: 607, title: "Wayfinder: the Tickets room", status: "open", closure: .open,
        type: "PRD", children: [812], blockedBy: [],
    )
}
