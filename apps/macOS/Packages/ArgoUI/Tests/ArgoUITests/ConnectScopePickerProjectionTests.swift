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

        #expect(panel.ports.first?.id == .ticket)
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
            ports: [ConnectPort(port: .ticket, state: .bound(
                accountID: ConnectFixture.personal.id,
                scope: "milad-alizadeh/argo",
            ))],
            scopes: ConnectScopes(
                port: .ticket,
                accountID: ConnectFixture.personal.id,
                state: .loading,
            ),
        )
        let panel = ConnectPanelProjection.panel(from: reading)

        #expect(panel.ports.first?.picker?.current == "milad-alizadeh/argo")
    }

    /// The count is the fallback, not the answer. The identity the row is mid-choice on — which is
    /// the one a grant just produced — is named however many the Mac holds.
    @Test
    func `the account the picker is open on is named even beside others`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal, ConnectFixture.work],
            scopes: ConnectScopes(
                port: .ticket,
                accountID: ConnectFixture.work.id,
                state: .loading,
            ),
        )
        let panel = ConnectPanelProjection.panel(from: reading)
        let issues = try #require(panel.ports.first)

        #expect(issues.row.detail.contains(ConnectFixture.work.displayName))
        #expect(!issues.row.detail.contains("2 accounts connected"))
    }

    /// A picker over an identity the Mac no longer holds has no provider to name the scope in, and
    /// offers a bind `ProjectBindings` refuses anyway.
    @Test
    func `a picker whose account has gone is not drawn`() {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [],
            scopes: ConnectScopes(
                port: .ticket,
                accountID: ConnectFixture.personal.id,
                state: .loading,
            ),
        )
        let panel = ConnectPanelProjection.panel(from: reading)

        #expect(panel.ports.first?.picker == nil)
    }

    /// A refused grant is its own state: the picker offers authorizing again, and the retry that
    /// would reuse the same token is never the repair on offer.
    @Test
    func `a refused grant reaches the picker as unauthorized`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.scopesUnauthorized)

        #expect(panel.ports.first?.picker?.state == .unauthorized)
        #expect(panel.ports.first?.picker?.provider == .github)
    }
}
