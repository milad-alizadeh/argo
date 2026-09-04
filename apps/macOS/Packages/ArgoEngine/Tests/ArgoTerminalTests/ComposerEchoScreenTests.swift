@testable import ArgoEngine
import ArgoTerminal
import Foundation
import Testing

/// The composer reading against a real `claude`'s own bytes (#1266).
///
/// The seam every engine suite about this stands on and none of them exercises: `ComposerEcho` is
/// given rows, and whether a real TUI's PTY output PAINTS those rows is a fact about the emulator
/// and the CLI together. The two fixtures are the same session either side of one Return, which is
/// the whole distinction the reading is built on.
@Suite("Composer echo screen")
@MainActor
struct ComposerEchoScreenTests {
    /// A `/clear` pasted into the composer and not yet submitted. The words are on the prompt row,
    /// and the command popup is open above it — the shape a Turn whose Return was eaten leaves.
    @Test
    func `a Turn still in the composer reads unheard off a real screen`() throws {
        let echo = try ComposerEcho.reading(of: "/clear", on: Self.painted("composerHoldingPty"))

        #expect(echo == .unheard)
    }

    /// The same session one Return later. `/clear` is a local command: it writes NO record, so the
    /// empty prompt row is the only evidence the CLI took it — and the scrollback now holds an echo
    /// of the command under the same marker, which is what the reading must not mistake for it.
    @Test
    func `a Turn the CLI took reads heard off a real screen`() throws {
        let echo = try ComposerEcho.reading(of: "/clear", on: Self.painted("composerEmptyPty"))

        #expect(echo == .heard)
    }

    /// A paste the CLI judged too long to echo, which it collapses to `[Pasted text #1 +15
    /// lines]`. The Turn's own words are nowhere on the screen — and this is the shape #682 is
    /// about, because a long Turn is the one whose `@` token opens the popup that eats the Return.
    @Test
    func `a collapsed paste reads unheard off a real screen`() throws {
        let painted = try Self.painted("composerPastedPty")

        #expect(ComposerEcho.reading(of: "Read @README.md first, then do this:", on: painted)
            == .unheard)
    }

    /// At the size the PTY was really told it had, for `SwiftTermScreenTests`' reason: a screen
    /// painted at another width wraps where the CLI did not.
    private static func painted(_ fixture: String) throws -> [String] {
        try SwiftTermScreen().rows(painted: ptyOutput(fixture), columns: 120, rows: 40)
    }

    /// Captured from `claude` 2.1.260 in a 120×40 PTY on 2026-09-04, pasted with the same
    /// bracketed paste `ClaudeTurn` writes: `composerHoldingPty` is `/clear` sitting in the
    /// composer, `composerEmptyPty` the same session one Return later, and `composerPastedPty` a
    /// 16-line Turn the CLI collapsed to a marker.
    private static func ptyOutput(_ fixture: String) throws -> [UInt8] {
        let url = try #require(
            Bundle.module.url(
                forResource: fixture,
                withExtension: "bin",
                subdirectory: "Fixtures",
            ),
        )
        return try [UInt8](Data(contentsOf: url))
    }
}
