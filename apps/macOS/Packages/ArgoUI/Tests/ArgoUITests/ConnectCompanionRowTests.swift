import ArgoEngine
@testable import ArgoUI
import Testing

/// The panel's COMPANION row: the four standings the plugin can be in, and the words the row reads
/// in each — shipped with every spawn, absent from the build, refused on the way in, or a state
/// Argo could not establish at all.
///
/// The panel around this row is `ConnectPanelProjectionTests`.
@Suite("Connect companion row")
struct ConnectCompanionRowTests {
    /// The row's whole payoff: a Project on this reading gets CONVENTION-tier facts with every
    /// spawn, and there is no install to offer because Argo already did it.
    @Test
    func `the companion row says the plugin comes with every spawn`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)

        #expect(panel.companion.detail.contains("every session Argo starts"))
        #expect(panel.companion.detail.contains("nothing to install"))
    }

    /// The honest `Not available yet`: a build with no plugin has no install to offer either.
    @Test
    func `a build that ships no plugin says so plainly`() {
        let panel = ConnectPanelProjection.panel(from: ConnectReading(companion: .missingFromBuild))

        #expect(panel.companion.detail.contains("Not available"))
        #expect(panel.companion.detail.contains("ships no plugin"))
    }

    /// A failed install is a fourth thing again, and it says why in the refusal's own words.
    @Test
    func `a failed plugin write is told apart and carries its reason`() {
        let reading = ConnectReading(
            companion: .installFailed(why: "Companion socket could not be opened"),
        )
        let panel = ConnectPanelProjection.panel(from: reading)

        #expect(panel.companion.detail.contains("without its plugin"))
        #expect(panel.companion.detail.contains("Companion socket could not be opened"))
    }

    /// The Hub's fact maps one to one, and no channel to ask degrades down to `unknown`.
    @Test
    func `the row's reading is the Hub's own standing, degraded down when absent`() {
        #expect(ConnectCompanion(standing: .includedWithSpawns) == .includedWithSpawns)
        #expect(ConnectCompanion(standing: .missingFromBuild) == .missingFromBuild)
        #expect(ConnectCompanion(standing: .installFailed(why: "no room"))
            == .installFailed(why: "no room"))
        #expect(ConnectCompanion(standing: nil) == .unknown)
    }

    /// Where even that cannot be established it falls to `unknown`, never to the nearest guess.
    @Test
    func `a companion state Argo cannot establish reads unknown`() {
        let panel = ConnectPanelProjection.panel(from: ConnectReading(companion: .unknown))

        #expect(panel.companion.detail == "unknown")
    }
}
