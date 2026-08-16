@testable import ArgoEngine
import ArgoTerminal
import Foundation
import Testing

/// The emulator against a real `claude`'s own bytes (#686).
///
/// This is the seam every other test about built-in commands stands on and none of them exercises:
/// a TUI's output is not text, so the panel exists only once something has PAINTED it. The engine's
/// suites hand a screen straight to the parser; only this one shows a screen can be got out of a
/// PTY at all.
/// On the main actor because the size it paints at is `HelpPanelSession`'s, and that session is.
@Suite("Terminal screen")
@MainActor
struct SwiftTermScreenTests {
    @Test
    func `paints the Help panel's command list out of a real PTY's bytes`() throws {
        let painted = try Self.painted()
        #expect(HelpPanel.isOpen(on: painted))
    }

    /// The whole point of painting it: what comes off the screen is what the parser reads, and the
    /// two are only known to agree where one has been fed the other.
    @Test
    func `paints rows the Help-panel parser reads real commands out of`() throws {
        let read = try HelpPanel.commands(on: Self.painted())

        #expect(read.count == 99)
        #expect(read.first { $0.name == "compact" }?.description
            == "Free up context by summarizing the conversation so far")
    }

    /// At the size `HelpPanelSession` really asks for, so a change to that one breaks this rather
    /// than leaving it proving something about a terminal Argo never opens.
    private static func painted() throws -> [String] {
        try SwiftTermScreen().rows(
            painted: ptyOutput(),
            columns: HelpPanelSession.size.columns,
            rows: HelpPanelSession.size.rows,
        )
    }

    /// Captured from `claude` 2.1.231 driven exactly as `HelpPanelSession` drives it — started,
    /// `/help`, Return, Tab.
    private static func ptyOutput() throws -> [UInt8] {
        let url = try #require(
            Bundle.module.url(
                forResource: "helpPanelPty",
                withExtension: "bin",
                subdirectory: "Fixtures",
            ),
        )
        return try [UInt8](Data(contentsOf: url))
    }
}
