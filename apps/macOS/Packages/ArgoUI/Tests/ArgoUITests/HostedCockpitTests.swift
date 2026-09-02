@testable import ArgoUI
import Testing

/// What `HostedCockpit` actually mounts, asserted so the fixture cannot quietly stop covering it.
///
/// The fixture reads through a MANAGED Session, so the deck's one slot resolves to a composer and
/// the shell hosts the real `ComposerTextView` under it. An `external` Session draws the read-only
/// line in that slot instead, and every claim taken through the fixture would then be taken over a
/// shell with no field in it — green, and covering less than it says.
@Suite("Hosted cockpit")
@MainActor
struct HostedCockpitTests {
    @Test
    func `the shell mounts the deck's real composer`() {
        let shell = HostedCockpit()

        #expect(HostedDeck.find(ComposerTextInput.self, in: shell.host) != nil)
    }

    /// The vessel the fixture's own presentation resolves to, which is what puts that field there.
    @Test
    func `the fixture's Session is one Argo can type into`() throws {
        let session = try #require(HostedCockpit.presentation.sessions.first)

        #expect(session.access == .managed)
        #expect(DeckVessel.resolve(for: session).composer != nil)
    }
}
