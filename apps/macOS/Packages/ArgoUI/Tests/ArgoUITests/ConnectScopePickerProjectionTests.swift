import ArgoEngine
@testable import ArgoUI
import Testing

/// What the panel says between holding an identity and binding a port — the gap #821 opens on. A
/// GitHub account that has just been authorized is a fact about the row that asked for it, and the
/// picker that follows belongs to that row and to no other.
@Suite("Connect panel scope picker")
struct ConnectScopePickerProjectionTests {
    /// The complaint #821 opens on: the device-code card goes away, the identity is held, and the
    /// row it was asked from says exactly what it said before it was.
    @Test
    func `an unbound port names the one account already connected`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal],
        )
        let panel = ConnectPanelProjection.panel(from: reading)
        let issues = try #require(panel.ports.first)

        #expect(issues.row.detail.contains(ConnectFixture.personal.displayName))
        #expect(issues.row.detail.contains("repository"))
    }

    /// With two identities on the port, naming one of them would name the wrong one half the time.
    @Test
    func `an unbound port with several accounts counts them rather than picking one`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal, ConnectFixture.work],
        )
        let panel = ConnectPanelProjection.panel(from: reading)
        let issues = try #require(panel.ports.first)

        #expect(issues.row.detail.contains("2 accounts connected"))
        #expect(!issues.row.detail.contains(ConnectFixture.personal.displayName))
    }

    /// The reading holds one picker for the whole panel, so the row it belongs to is the only one
    /// that may draw it.
    @Test
    func `the scope picker is drawn on its own port and on no other`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.choosing)

        #expect(panel.ports.first?.id == .workItem)
        #expect(panel.ports.first?.picker != nil)
        #expect(panel.ports.last?.picker == nil)
    }

    @Test
    func `an open picker carries the account it is choosing for`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.choosing)
        let picker = try #require(panel.ports.first?.picker)

        #expect(picker.accountID == ConnectFixture.personal.id)
        #expect(picker.scopeNoun == "Repository")
    }

    /// A rebind opens on where the port already is, so the picker has to carry it.
    @Test
    func `a picker over a bound port carries the scope it is on`() {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal],
            ports: [ConnectPort(port: .workItem, state: .bound(
                accountID: ConnectFixture.personal.id,
                scope: "milad-alizadeh/argo",
            ))],
            scopes: ConnectScopes(
                port: .workItem,
                accountID: ConnectFixture.personal.id,
                state: .loading,
            ),
        )
        let panel = ConnectPanelProjection.panel(from: reading)

        #expect(panel.ports.first?.picker?.current == "milad-alizadeh/argo")
    }
}
