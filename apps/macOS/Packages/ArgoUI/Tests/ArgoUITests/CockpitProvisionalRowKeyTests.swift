import ArgoEngine
@testable import ArgoUI
import Testing

/// Which rows have stopped standing under a claim id (#1563) — the reading that tells the window
/// where a decision filed before a transcript existed has to be moved to. It came out of the app
/// target so a test could reach it (ADR-0022), on `untitledTicketNumbers`' ground.
@Suite("Roster provisional row keys")
struct CockpitProvisionalRowKeyTests {
    private static let claim = "claim-a1b2c3d4-3"

    private static func presentation(_ sessions: [CockpitPresentation.Session])
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [], activeProjectID: nil, sessions: sessions,
            connection: .idle,
        )
    }

    @Test
    func `a row re-keyed off its claim names the claim it stood under`() {
        let roster = Self.presentation([
            RosterSessionFixture.rekeyed("cli-id", from: Self.claim),
        ])

        #expect(roster.provisionalRowKeys == [Self.claim: "cli-id"])
    }

    /// The common row, and the reason keying the window's observer on this set costs nothing: a
    /// roster of Sessions that bound long ago asks for no carry at all.
    @Test
    func `a row that never stood under a claim asks for nothing`() {
        let roster = Self.presentation([RosterSessionFixture.session(id: "cli-id")])

        #expect(roster.provisionalRowKeys.isEmpty)
    }

    /// `absorbedIDs` also carries the chain ids a continuation folded in (#1481), and those are
    /// other Sessions' own keys. A decision moved off one of them is a decision moved off somebody
    /// else's chain, which is the bug this reading exists to stop rather than to spread.
    @Test
    func `an absorbed chain id is not a claim and is left alone`() {
        let roster = Self.presentation([
            RosterSessionFixture.rekeyed("cli-id", from: "/tmp/argo/former.jsonl"),
        ])

        #expect(roster.provisionalRowKeys.isEmpty)
    }
}
