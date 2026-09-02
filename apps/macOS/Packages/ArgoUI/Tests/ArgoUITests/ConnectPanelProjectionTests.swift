import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Connect panel says AROUND its rows: the folder it needs before anything can start, the
/// call to action that folder alone enables, the mode the panel is drawn in, and the device flow it
/// carries while an authorization waits.
///
/// The two port rows are `ConnectPortRowTests` and the plugin row is `ConnectCompanionRowTests`.
/// Every claim here is one the panel must make in WORDS.
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
        #expect(panel.ports.map(\.id) == [.ticket, .codeHost])
    }

    @Test
    func `onboarding carries no Agent row`() {
        #expect(ConnectPanelProjection.panel(from: ConnectFixture.wired).agent == nil)
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
