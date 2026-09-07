import ArgoEngine
@testable import ArgoUI
import SwiftUI

/// The roster a `Start` on a ticket lands in, and the shell wiring that lands it there (#1493).
///
/// Shared by the three suites that ask what survives that route — reconciliation
/// (`RosterSelectionFromTicketStartTests`), the roster list's own write-back
/// (`RosterListWriteBackTests`) and its narrowing (`RosterListConfineTests`). Two copies of this
/// setup would be two rosters, and an assertion would then hold whichever one its own file
/// happened to carry.
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

    /// `standing` with the spawn's row second in the published order — deliberately not first,
    /// which is the one place a repointing rule lands by luck. Each roster below states only its
    /// own second row.
    static func published(_ fresh: CockpitPresentation.Session) -> [CockpitPresentation.Session] {
        [
            RosterSessionFixture.session(id: "alpha"),
            fresh,
            RosterSessionFixture.session(id: "beta"),
            RosterSessionFixture.session(id: "gamma"),
        ]
    }

    /// The provisional row the Hub publishes when the spawn returns, standing under the claim's
    /// own id (#872).
    static var provisional: [CockpitPresentation.Session] {
        published(RosterSessionFixture.session(id: claim))
    }

    /// The same roster once the CLI has written its first record: the row is published under the
    /// id the CLI picked and carries the claim it retired.
    static var rekeyed: [CockpitPresentation.Session] {
        published(RosterSessionFixture.rekeyed(cli, from: claim))
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
        published(RosterSessionFixture.session(id: cli))
    }

    /// The roster after a continuation folds that row into a chain of its own (#1481), which is
    /// the retirement that can follow the two this route makes. Nothing about it is special once
    /// the id has settled, and this says so.
    static var continued: [CockpitPresentation.Session] {
        published(RosterSessionFixture.rekeyed(chain, from: cli))
    }

    /// The id that row is published under once the continuation is folded in.
    static let chain = "session-7-continued"

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

    /// The same forgery, carried into an id that did NOT exist when the press happened.
    ///
    /// `HubSession.merge` folds a continuation in by appending its id AND everything it had
    /// already absorbed, so an older Session holding the recycled string is republished under a
    /// chain id nothing was ever pointed at. The heir's own id is then no help at all: what gives
    /// it away is that it absorbs `beta`, a row the reader could have been looking at when the
    /// press happened.
    static var recycledClaimFoldedIn: [CockpitPresentation.Session] {
        var folded = RosterSessionFixture.session(id: "session-9-continued")
        folded.absorbedIDs = ["beta", claim]
        return [
            RosterSessionFixture.session(id: "alpha"),
            folded,
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

    /// The same press, made after the shell has ALREADY reconciled the provisional row (#1681).
    ///
    /// This is the real order rather than a variant of it. `Hub.spawnSession` publishes the row and
    /// then SUSPENDS before it returns — `await readings.spell` — so the shell gets a pass over a
    /// roster carrying the claim while `TicketStart` is still awaiting the spawn, and
    /// `pointAtStarting` runs after it. Measured, not read: `HubSpawnPublishOrderTests`.
    ///
    /// What that costs is what the press records as already standing when it happens, which is the
    /// set the recycled-claim guard reads (`heirs(of:)`, #1563).
    static func pressedAfterItsRowIsPublished() async -> CockpitNavigationModel {
        let model = navigation()
        model.reconcile(against: provisional.map(\.identity))
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
