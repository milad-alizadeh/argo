import ArgoEngine
import ArgoTerminal
import Foundation
import Testing

/// The emulator against a real `claude`'s own bytes (#686).
///
/// This is the seam every other test about built-in commands stands on and none of them exercises:
/// a TUI's output is not text, so the panel exists only once something has PAINTED it. The
/// engine's suites hand a screen straight to the parser; only this one shows a screen can be got
/// out of a PTY at all.
@Suite("Terminal screen")
struct SwiftTermScreenTests {
    /// Captured from `claude` 2.1.231 driven exactly as `HelpPanelSession` drives it — started,
    /// `/help`, Return, Tab — on a terminal 120 wide and 400 tall.
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

    @Test
    func `paints the Help panel's command list out of a real PTY's bytes`() throws {
        let painted = try SwiftTermScreen().rows(
            painted: Self.ptyOutput(),
            columns: 120,
            rows: 400,
        )
        #expect(painted.contains { $0.contains("Browse default commands") })
    }

    /// The whole point of painting it: what comes off the screen is what the parser reads, and the
    /// two are only known to agree where one has been fed the other.
    @Test
    func `paints rows the Help-panel parser reads commands out of`() throws {
        let painted = try SwiftTermScreen().rows(
            painted: Self.ptyOutput(),
            columns: 120,
            rows: 400,
        )
        #expect(painted.contains { $0.trimmingCharacters(in: .whitespaces) == "/compact" })
    }
}
