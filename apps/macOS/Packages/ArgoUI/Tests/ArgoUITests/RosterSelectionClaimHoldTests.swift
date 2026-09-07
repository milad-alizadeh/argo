@testable import ArgoUI
import Testing

/// Where that hold ENDS, which is the other half of the same rule (#1602).
///
/// A hold with no release is not a fix: a pointer kept on an id no row will ever carry grounds
/// nothing at all, and a selection kept over rows nobody can see is what #1247 refuses. So each
/// of these names a way out of the hold and asserts that reconciliation takes it.
@Suite("The hold a ticket start takes, and where it ends")
@MainActor
struct RosterSelectionClaimHoldTests {
    private typealias Start = TicketStartFixture

    /// And the bound on the hold, for the spawn that is Argo's OWN: a `claude` that dies before
    /// writing any record leaves its claim on no roster for good, and no re-key is coming.
    ///
    /// The pass that says so is the one that brings no new id at all — the row this spawn is
    /// waiting for arrives under the id the CLI picked, which nothing was published under before.
    /// Held past that, the pointer would name an id no row carries until the reader clicked
    /// something.
    @Test
    func `lets go when the spawn dies before its record and no row is coming`() async {
        let navigation = await Start.pressed()

        navigation.reconcile(against: Start.provisional.map(\.identity))
        navigation.reconcile(against: Start.standing.map(\.identity))

        RosterMark.expect("beta", in: Start.standing, for: navigation)
    }

    /// What the hold does NOT hold: the selection the menu acts on. The pointer waits through the
    /// re-key, and the row it names is on no roster for that pass, so a menu opened over the
    /// selection would offer to archive a row nobody can see — which is the whole of #1247.
    @Test
    func `drops the vanished row from the selection while the pointer waits`() async {
        let navigation = await Start.pressed()

        navigation.reconcile(against: Start.provisional.map(\.identity))
        navigation.reconcile(against: Start.rekeyedBeforeSuccession.map(\.identity))

        #expect(
            !navigation.sessionSelection.contains(Start.claim),
            "A row on no roster is still in what the menu acts on.",
        )
    }

    /// And the same forgery carried into an id that did not exist when the press happened, which
    /// the heir's own id cannot give away — `HubSession.merge` folds a continuation in by appending
    /// its id and everything it had absorbed, recycled claim and all. What gives it away is that
    /// the heir absorbs a row the reader could already have been looking at.
    @Test
    func `refuses a recycled claim folded into a continuation since the press`() async {
        let navigation = await Start.pressed()

        navigation.reconcile(against: Start.recycledClaimFoldedIn.map(\.identity))

        #expect(
            navigation.session == Start.claim,
            "A recycled claim id handed the window an unrelated chain.",
        )
    }

    /// A recycled claim id may not carry the pointer to a Session that was never this spawn
    /// (#1563). The counter behind `claim-<launch>-<n>` restarts with the process, so an older
    /// Session's own `absorbedIDs` can hold the exact string this spawn was just issued.
    ///
    /// The row Argo is waiting for cannot be one the reader was already looking at, so an heir
    /// that was already published when the press happened is not this spawn's — and the pointer
    /// stays put rather than following the forged edge.
    @Test
    func `refuses a recycled claim's edge to a Session that was never this spawn`() async {
        let navigation = await Start.pressed()

        navigation.reconcile(against: Start.recycledClaim.map(\.identity))

        #expect(
            navigation.session == Start.claim,
            "A recycled claim id handed the window an unrelated Session.",
        )
    }

    /// And the bound on that hold, which is deliberate: only a spawn Argo ITSELF started gets it.
    ///
    /// A provisional row the reader merely clicked is a claim id too, and a spawn that dies before
    /// writing any record leaves it on no roster for good. Holding the pointer there would leave
    /// the roster grounding nothing until the reader clicked again, so that case still falls to the
    /// neighbour rule — the pointer moves, which is the honest reading of an id nothing is coming
    /// for.
    @Test
    func `still lets go of a claim row the reader only clicked`() {
        let navigation = Start.navigation()
        navigation.reconcile(against: Start.provisional.map(\.identity))
        navigation.deckPointed(at: Start.claim)

        navigation.reconcile(against: Start.standing.map(\.identity))

        #expect(
            navigation.session == "beta",
            "A claim nothing is coming for held the window against an empty roster row.",
        )
    }
}
