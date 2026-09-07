@testable import ArgoUI
import Testing

/// The press that lands AFTER the roster has already reconciled the row it started (#1681).
///
/// #1602 shipped believing the press always comes first, and every suite on this route pressed
/// first. It does not: `Hub.spawnSession` publishes the provisional row and then suspends before
/// returning, so the shell reconciles a roster carrying the claim while `TicketStart` is still
/// awaiting the spawn (`HubSpawnPublishOrderTests` measures that; `TicketStartFixture
/// .pressedAfterItsRowIsPublished` is the order it establishes).
///
/// Ordinary as that pass is, it puts the spawn's OWN claim id into the set the press records as
/// already standing — and the recycled-claim guard reads that set to decide which succession edge
/// is forged (`heirs(of:)`, #1563). The genuine claim-to-CLI edge then looks like the forgery, so
/// the pointer never follows the re-key and the hold expires where it stands.
@Suite("A ticket start whose row was published before the press")
@MainActor
struct RosterSelectionPressAfterPublishTests {
    private typealias Start = TicketStartFixture

    /// Nothing about the claim's own id makes it a row the reader could have been looking at when
    /// they pressed — it is the id the press was HANDED — so the re-key it names is this spawn's
    /// own succession, and the window follows it.
    ///
    /// What this measures is the ground, and it is deliberately not the report's own landing: with
    /// the edge refused the pointer stays on a claim no row carries, so the roster grounds NOTHING
    /// rather than grounding the neighbour. The landing needs the hold to expire as well, which is
    /// `rowCanStillArrive`'s bound and a defect of its own — see `RosterSelectionClaimHoldTests`.
    @Test
    func `follows the re-key of a claim its own row was already published under`() async {
        let navigation = await Start.pressedAfterItsRowIsPublished()

        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        RosterMark.expect(Start.cli, in: Start.rekeyed, for: navigation)
    }

    /// The guard the fix narrows, still holding under the new ordering.
    ///
    /// This roster and not `recycledClaim` too, because only this one reaches the clause the fix
    /// touches: `recycledClaim`'s heir gives itself away by its OWN id, which subtracting the claim
    /// cannot affect, and `RosterSelectionClaimHoldTests` already holds that case. Here the heir is
    /// a chain id nothing was ever pointed at and what gives it away is what it ABSORBS — the same
    /// read the claim was wrongly answering.
    @Test
    func `still refuses a recycled claim folded into a continuation`() async {
        let navigation = await Start.pressedAfterItsRowIsPublished()

        navigation.reconcile(against: Start.recycledClaimFoldedIn.map(\.identity))

        #expect(
            navigation.session == Start.claim,
            "A recycled claim id handed the window a Session that was never this spawn.",
        )
    }
}
