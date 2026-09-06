import ArgoEngine
@testable import ArgoUI
import SwiftUI

/// The roster a `Start` on a ticket lands in, and the shell wiring that lands it there (#1493).
///
/// Shared by the two suites that ask what survives that route — reconciliation
/// (`RosterSelectionFromTicketStartTests`) and the roster list's own write-back
/// (`RosterListWriteBackTests`). Two copies of this setup would be two rosters, and an assertion
/// would then hold whichever one its own file happened to carry.
@MainActor
enum TicketStartFixture {
    /// The claim the spawn answers with, and the id the CLI picks a moment later.
    static let claim = "claim-7"
    static let cli = "claim-7-cli"

    /// Three rows before the press, which is the report's own setup: enough that the first row is
    /// not the fresh one by accident.
    static var standing: [CockpitPresentation.Session] {
        ["alpha", "beta", "gamma"].map { RosterSessionFixture.session(id: $0) }
    }

    /// The provisional row the Hub publishes when the spawn returns, standing under the claim's
    /// own id (#872), second in the published order.
    static var provisional: [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.session(id: claim),
            RosterSessionFixture.session(id: "beta"),
            RosterSessionFixture.session(id: "gamma"),
        ]
    }

    /// The same roster once the CLI has written its first record: the row is published under the
    /// id the CLI picked and carries the claim it retired.
    static var rekeyed: [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.rekeyed(cli, from: claim),
            RosterSessionFixture.session(id: "beta"),
            RosterSessionFixture.session(id: "gamma"),
        ]
    }

    /// The act as `CockpitView.ticketStart` assembles it, with the spawn answering what the real
    /// one answers: the claim id the provisional row is published under.
    static func start() -> TicketStart {
        TicketStart(
            tickets: [Ticket(number: 899, title: "Start", status: "Todo", closure: .open)],
            designs: { [] },
            spawn: { _, _, _ in claim },
        )
    }

    /// The hold as `CockpitView.sidebar` assembles it, so a suite narrows the selection by the
    /// same route the roster's `List` takes and not by a re-spelling of it.
    static func hold(_ navigation: CockpitNavigationModel) -> RowSelectionHold<String> {
        RowSelectionHold(
            selection: Binding(
                get: { navigation.sessionSelection },
                set: { navigation.sessionSelection = $0 },
            ),
            pointed: navigation.session,
            pick: { navigation.deckPointed(at: $0) },
            awaited: navigation.awaitedSession,
        )
    }

    /// A window as `CockpitView.body` leaves it on first draw: reconciled once over the roster
    /// standing before the press, in the Tickets room, which is where the reader pressed Start.
    static func navigation() -> CockpitNavigationModel {
        let navigation = CockpitNavigationModel()
        navigation.reconcile(against: standing.map(\.identity))
        navigation.room = .tickets
        return navigation
    }
}
