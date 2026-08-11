import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Connect panel says. Every claim here is one the panel must make in WORDS.
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
    func `settings is the same panel, one word and one row further on`() {
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

    /// #570 owns this row's states. Until it lands, the panel says the one thing already true.
    @Test
    func `the companion row states the one thing that already ships`() {
        let panel = ConnectPanelProjection.panel(from: ConnectFixture.wired)

        #expect(panel.companion.detail.contains("nothing to install"))
    }

    /// Where even that cannot be established it falls to `unknown`, never to the nearest guess.
    @Test
    func `a companion state Argo cannot establish reads unknown`() {
        let panel = ConnectPanelProjection.panel(from: ConnectReading(companion: .unknown))

        #expect(panel.companion.detail == "unknown")
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
