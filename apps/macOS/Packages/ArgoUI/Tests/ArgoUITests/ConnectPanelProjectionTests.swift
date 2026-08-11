import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Connect panel says. Every claim here is one the panel must make in WORDS: an enabled
/// button, a dimmed row and a coloured edge are not readable by everyone, and none of them is
/// testable.
@Suite("Connect panel projection")
struct ConnectPanelProjectionTests {
    @Test
    func `a folder alone enables the call to action`() {
        let empty = ConnectPanelProjection.panel(from: ConnectFixture.fresh)
        let chosen = ConnectPanelProjection.panel(from: ConnectFixture.folderOnly)

        #expect(!empty.isCallEnabled)
        #expect(chosen.isCallEnabled)
        #expect(chosen.call == "Create project")
    }

    /// The failure this panel exists to avoid: a setup that refuses to start until you have a
    /// repository and an organisation.
    @Test
    func `neither a connection nor the plugin gates the call to action`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.folderOnly)

        #expect(panel.isCallEnabled)
        #expect(panel.ports.allSatisfy { !$0.isBound })
        #expect(panel.folder.detail == ConnectFixture.folder)
    }

    @Test
    func `an empty folder row says a folder is all that is needed`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.fresh)

        #expect(panel.folder.detail.contains("Git is not required"))
        #expect(panel.folderCall == "Choose folder…")
    }

    @Test
    func `both ports are drawn whether or not the reading mentions them`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.partly)

        #expect(panel.ports.map(\.id) == [.workItem, .codeHost])
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

    /// Two identities on one provider, told apart by what is on screen and nothing else. Reading a
    /// token to know which is which is the thing this rules out.
    @Test
    func `two Accounts on one provider are distinguishable in the choices`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)
        let issues = try #require(panel.ports.first)

        #expect(issues.choices.map(\.title) == [
            "GitHub · milad-alizadeh",
            "GitHub · milad-at-trili",
        ])
    }

    /// Rebinding is picking again, and the Account already on the row is one of the answers: the
    /// same identity under a different scope is a move a row has to allow.
    @Test
    func `the Account already bound is still offered`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)
        let issues = try #require(panel.ports.first)

        #expect(issues.choices.map(\.id).contains(ConnectFixture.personal.id))
    }

    @Test
    func `an unbound port says what connecting one would show`() throws {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.partly)
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

    /// Authorizing one more identity is always on offer, which is what makes a second Account on a
    /// provider reachable at all.
    @Test
    func `every port offers a way to authorize another identity`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)

        #expect(panel.ports.allSatisfy {
            $0.offers.map(\.title) == ["Connect a GitHub account"]
        })
    }

    /// A provider with no flow behind it in this build is not offered: a control whose only
    /// outcome is nothing happening is worse than its absence.
    @Test
    func `a provider Argo cannot authorize yet is not offered`() throws {
        let reading = ConnectReading(authorizable: [.github, .linear])
        let panel = ConnectPanelProjection.panel(from: reading)
        let issues = try #require(panel.ports.first)

        #expect(issues.offers.map(\.id) == [.github, .linear])
        #expect(ConnectPanelProjection.panel(from: ConnectFixture.fresh).ports.allSatisfy {
            $0.offers.map(\.id) == [.github]
        })
    }

    @Test
    func `a Binding whose Account was removed says so and stays re-bindable`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal],
            ports: [ConnectPort(port: .workItem, state: .broken(
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

    @Test
    func `settings is the same panel with one word and one row more`() {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            accounts: [ConnectFixture.personal],
            mode: .settings(agent: .claude),
        )
        let panel = ConnectPanelProjection.panel(from: reading)

        #expect(panel.heading == "Project settings")
        #expect(panel.call == "Done")
        #expect(panel.isCallEnabled)
        #expect(panel.agent?.detail == "Claude Code")
        #expect(panel.ports.map(\.id) == [.workItem, .codeHost])
    }

    @Test
    func `onboarding carries no Agent row`() {
        #expect(ConnectPanelProjection.panel(from: ConnectFixture.wired).agent == nil)
    }

    /// #570 owns this row's states. Until it lands, the panel says the one thing already true and
    /// falls to the registry's own word for a fact nobody can stand behind.
    @Test
    func `the companion row states what ships and reads unknown otherwise`() {
        let known = ConnectPanelProjection.panel(from: ConnectFixture.wired)
        let unknown = ConnectPanelProjection.panel(
            from: ConnectReading(companion: .unknown),
        )

        #expect(known.companion.detail.contains("nothing to install"))
        #expect(unknown.companion.detail == "unknown")
    }

    @Test
    func `the device flow's code and URL are carried while it waits`() throws {
        let reading = ConnectReading(
            folder: ConnectFixture.folder,
            challenge: ConnectFixture
                .challenge,
        )
        let panel = ConnectPanelProjection.panel(from: reading)
        let challenge = try #require(panel.challenge)

        #expect(challenge.userCode == "WDJB-MJHT")
        #expect(challenge.verificationURL.absoluteString.contains("login/device"))
    }
}
