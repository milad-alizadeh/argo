import ArgoEngine
@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What each of the panel's two PORT rows says: that both are drawn whatever the reading mentions,
/// which Account and scope a bound one names, which Accounts it offers to pick from, and what it
/// says when the Account behind it is gone.
///
/// The panel around these rows is `ConnectPanelProjectionTests`. Every claim here is one a row must
/// make in WORDS.
@Suite("Connect port rows")
struct ConnectPortRowTests {
    @Test
    func `both ports are drawn whether or not the reading mentions them`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.partly)

        #expect(panel.ports.map(\.id) == [.ticket, .codeHost])
        #expect(panel.ports.map(\.isBound) == [true, false])
    }

    /// The claim the account level is for: which identity, not merely which provider.
    @Test
    func `a bound port names its Account and its scope`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)
        let issues = try #require(panel.ports.first)
        let pulls = try #require(panel.ports.last)

        #expect(issues.row.detail == "GitHub · milad-alizadeh · milad-alizadeh/argo")
        #expect(pulls.row.detail == "GitHub · milad-at-trili · trili/cockpit")
    }

    /// Two identities on one provider, told apart by what is on screen and nothing else.
    @Test
    func `two Accounts on one provider are distinguishable in the choices`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)
        let issues = try #require(panel.ports.first)

        #expect(issues.choices.map(\.title) == [
            "GitHub · milad-alizadeh",
            "GitHub · milad-at-trili",
        ])
    }

    /// Rebinding is picking again: the same identity under a different scope is a move a row
    /// allows.
    @Test
    func `the Account already bound is still offered`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)
        let issues = try #require(panel.ports.first)

        #expect(issues.choices.map(\.id).contains(ConnectFixture.personal.id))
    }

    @Test
    func `a port with no account behind it says what connecting one would show`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.folderOnly)
        let pulls = try #require(panel.ports.last)

        #expect(pulls.row.detail.contains("pull requests"))
        #expect(pulls.note == nil)
    }

    /// An Account that cannot fill a port is never offered under it, because the only outcome of
    /// picking it is the refusal `bind` already raises.
    @Test
    func `a Linear Account is offered for issues and never for the code host`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal, ConnectFixture.linear],
        )
        let panel = ConnectPanelProjection.panel(from: reading)
        let issues = try #require(panel.ports.first)
        let pulls = try #require(panel.ports.last)

        #expect(issues.choices.map(\.title).contains("Linear · Trili"))
        #expect(pulls.choices.map(\.title) == ["GitHub · milad-alizadeh"])
    }

    /// Authorizing one more identity is always on offer, which is what makes a second Account
    /// reachable at all.
    @Test
    func `every port offers a way to authorize another identity`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)

        #expect(panel.ports.allSatisfy {
            $0.offers.map(\.title) == ["Connect a GitHub account"]
        })
    }

    /// A provider with no flow behind it in this build is not offered.
    @Test
    func `only a provider Argo can authorize is offered`() {
        #expect(ConnectPanelProjection.panel(from: ConnectFixture.fresh).ports.allSatisfy {
            $0.offers.map(\.id) == [.github]
        })
    }

    /// The other half of that claim: the list is what the app hands over, not a set this file
    /// decided.
    @Test
    func `the offered set is whatever the app says it can authorize`() throws {
        let reading = ConnectReading(authorizable: [.github, .linear])
        let issues = try #require(ConnectPanelProjection.panel(from: reading).ports.first)

        #expect(issues.offers.map(\.id) == [.github, .linear])
    }

    @Test
    func `a Binding whose Account was removed keeps its place and says what went`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal],
            ports: [ConnectPort(port: .ticket, state: .broken(
                accountID: ConnectFixture.work.id,
                scope: "trili/cockpit",
                fault: .accountRemoved,
            ))],
        )
        let panel = ConnectPanelProjection.panel(from: reading)
        let issues = try #require(panel.ports.first)

        #expect(issues.note?.what == "The account this row used is gone.")
        #expect(issues.row.detail == "trili/cockpit")
        #expect(!issues.choices.isEmpty)
    }
}
