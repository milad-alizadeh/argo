@testable import ArgoEngine
import ArgoTerminal
import Foundation
import Testing

/// The whole read against the CLI it exists for (#686). Excluded from the default run for
/// `LiveCommandTests`' reason: this spawns a real `claude` and takes as long as a TUI takes to draw
/// itself — set `ARGO_LIVE_CLI=1` to run it.
///
/// What no other suite can show: that the four pieces still line up on the CLI installed NOW. The
/// captured fixture proves the parser reads a 2.1.231 panel; only this proves `claude` still has a
/// Help panel, still puts its commands on a tab reachable by one Tab, and still calls them what the
/// curation thinks it does.
@Suite("Live built-in commands", .enabled(if: LiveCLI.isEnabled))
@MainActor
struct LiveBuiltinCommandTests {
    /// `/compact` and not something rarer: it is the CLI's oldest session-state command, it is one
    /// the curation keeps, and a `claude` without it would be a `claude` this feature has bigger
    /// problems with than a missing row.
    @Test(.timeLimit(.minutes(5)))
    func `finds a known-stable built-in in the real CLI's own Help panel`() async throws {
        let root = try Self.folderTheCLIisTrustedIn()
        defer { try? FileManager.default.removeItem(at: root) }
        let session = HelpPanelSession(
            host: SwiftTermProcessHost(),
            launcher: AgentLauncher(),
            screen: SwiftTermScreen(),
        )

        let read = try await HelpPanel.commands(on: session.rows(inProjectAt: root))

        #expect(BuiltinCuration.keeps(read).contains { $0.name == "compact" })
    }

    /// A folder `claude` will open straight into the composer in. Somewhere it has never seen can
    /// open on the trust question instead, and then every keystroke is an answer to that.
    private static func folderTheCLIisTrustedIn() throws -> URL {
        let root = FileManager.default.temporaryDirectory
            .appending(path: "argo-live-help-\(UUID().uuidString)", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
}
