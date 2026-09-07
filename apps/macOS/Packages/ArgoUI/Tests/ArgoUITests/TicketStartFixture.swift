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
    ///
    /// The claim carries `SessionOwnership.ClaimID`'s own prefix and the CLI's id carries no
    /// prefix at all, which is the real shape and a load-bearing one: a claim id means nothing
    /// outside the process that issued it and is retired, and a Session id is a transcript's key
    /// and is not (#1602).
    static let claim = "claim-7"
    static let cli = "session-7"

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

    /// The same re-key one pass EARLIER, before the row carries the claim it retired.
    ///
    /// The Hub appends the claim to `absorbedIDs` off the binding it holds at the moment the row is
    /// published (`Hub.published`, #361), and the binding is made by the sweep that matches the
    /// CLI's first record. A presentation rebuilt between the record landing and that sweep
    /// publishes the CLI's row with the claim absorbed by nothing at all: the claim id is on no
    /// roster and in no succession map. This is the shape that has no guard in it — see
    /// `RosterSelectionFromTicketStartTests`.
    static var rekeyedBeforeSuccession: [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.session(id: cli),
            RosterSessionFixture.session(id: "beta"),
            RosterSessionFixture.session(id: "gamma"),
        ]
    }

    /// A roster in which the claim id is absorbed by a Session that was never this spawn.
    ///
    /// Claim ids are `claim-<launch>-<n>` and the counter restarts with the process, so the same
    /// string names a different agent in a later launch (#1563). A succession map built off
    /// `absorbedIDs` cannot tell the two apart, and this is the map that points a fresh spawn's
    /// pointer at somebody else's Session.
    static var recycledClaim: [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.rekeyed("beta", from: claim),
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

    /// A window with the press already made, driven through the real `TicketStart.run` — the
    /// opening every test on this route shares, spelled once rather than per test.
    static func pressed() async -> CockpitNavigationModel {
        let model = navigation()
        await start().run(on: 899, in: model)
        return model
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
