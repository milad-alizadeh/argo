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

    /// The edge itself. Nothing about the claim's own id makes it a row the reader could have been
    /// looking at when they pressed — it is the id the press was handed — so the re-key it names is
    /// this spawn's own succession and the window follows it.
    @Test
    func `follows the re-key of a claim its own row was already published under`() async {
        let navigation = await Start.pressedAfterItsRowIsPublished()

        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        RosterMark.expect(Start.cli, in: Start.rekeyed, for: navigation)
    }

    /// And the report's own symptom, which is where a refused edge ends up: the pointer holds on a
    /// claim no row carries, and the first pass that brings no new id at all is the bound on that
    /// hold (`rowCanStillArrive`). The window leaves for another row there — thirty seconds after
    /// the press, with the Session it started still on the roster under the id the CLI picked.
    @Test
    func `does not leave it once nothing new is arriving`() async {
        let navigation = await Start.pressedAfterItsRowIsPublished()

        navigation.reconcile(against: Start.rekeyed.map(\.identity))
        navigation.reconcile(against: Start.rekeyed.map(\.identity))

        RosterMark.expect(Start.cli, in: Start.rekeyed, for: navigation)
    }

    /// The guard the fix narrows, still holding. A claim id absorbed by a row that was ALREADY
    /// standing at the press is the forgery #1563 is about, and reconciling the provisional row
    /// first must not turn that refusal off.
    @Test
    func `still refuses a recycled claim absorbed by a row that was standing`() async {
        let navigation = await Start.pressedAfterItsRowIsPublished()

        navigation.reconcile(against: Start.recycledClaim.map(\.identity))

        #expect(
            navigation.session == Start.claim,
            "A recycled claim id handed the window an unrelated Session.",
        )
    }

    /// And the same forgery folded into a chain id nothing was ever pointed at, which is the half
    /// the heir's own id cannot give away.
    @Test
    func `still refuses a recycled claim folded into a continuation`() async {
        let navigation = await Start.pressedAfterItsRowIsPublished()

        navigation.reconcile(against: Start.recycledClaimFoldedIn.map(\.identity))

        #expect(
            navigation.session == Start.claim,
            "A recycled claim id handed the window an unrelated chain.",
        )
    }
}
