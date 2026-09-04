@testable import ArgoEngine
import Testing

/// Reading a `claude` screen for whether the composer still holds the Turn (#1266).
///
/// The rows here are the shape a real `claude` 2.1.260 draws at 120×40, cut down to the parts the
/// reading touches: a banner, the scrollback, the rule above the composer, the prompt row, and the
/// two status rows below it.
@Suite("Composer echo")
struct ComposerEchoTests {
    /// The failure the ticket was filed for. `/clear` is heard the instant it is typed and writes
    /// no record at all, so the transcript cannot say it arrived — the empty composer can.
    @Test
    func `a command the CLI took leaves the composer empty`() {
        let screen = Self.screen(scrollback: ["❯ /clear"], composing: "")

        #expect(ComposerEcho.reading(of: "/clear", on: screen) == .heard)
    }

    /// The echo of an accepted Turn sits in the scrollback under the same marker as the composer.
    /// Read as "any prompt row", that echo would say the composer still holds a Turn it let go.
    @Test
    func `the scrollback echo of a Turn is not read as the composer`() {
        let screen = Self.screen(scrollback: ["❯ Fix the caption."], composing: "")

        #expect(ComposerEcho.reading(of: "Fix the caption.", on: screen) == .heard)
    }

    /// The real failure #682 exists for: the file-mention popup ate the Return, so the words are
    /// sitting in the composer looking sent.
    @Test
    func `a Turn the popup ate is still in the composer`() {
        let screen = Self.screen(
            scrollback: ["  README.md", "  READING.md"],
            composing: "what is @README.md about?",
        )

        #expect(ComposerEcho.reading(of: "what is @README.md about?", on: screen) == .unheard)
    }

    /// A Turn wider than the terminal is held with its tail on the rows below, so the prompt row
    /// carries only its start.
    @Test
    func `a Turn too wide for the row is read from the start it left on the prompt`() {
        let turn = String(repeating: "long ", count: 60)
        let screen = Self.screen(scrollback: [], composing: String(turn.prefix(112)))

        #expect(ComposerEcho.reading(of: turn, on: screen) == .unheard)
    }

    /// The reader typed the next Turn while the first was being watched. The first has left the
    /// composer, whatever is in it now.
    @Test
    func `a composer holding something else has let the Turn go`() {
        let screen = Self.screen(scrollback: ["❯ /clear"], composing: "and now the other thing")

        #expect(ComposerEcho.reading(of: "/clear", on: screen) == .heard)
    }

    /// Only the first line is compared: the rest of a multi-line Turn wraps onto rows the CLI lays
    /// out, and no reading Argo can do would predict them.
    @Test
    func `a multi-line Turn is read from its first line`() {
        let screen = Self.screen(scrollback: [], composing: "Fix the caption.")

        let echo = ComposerEcho.reading(of: "Fix the caption.\nThen run the tests.", on: screen)

        #expect(echo == .unheard)
    }

    /// A screen with no prompt row on it — a CLI that draws a different marker, a PTY that has
    /// painted nothing yet, a Session Argo holds no screen for. Quiet, not `unheard`: a wrong
    /// "lost" is what makes the reader send the same words twice.
    @Test
    func `a screen with no composer on it says nothing`() {
        #expect(ComposerEcho.reading(of: "/clear", on: []) == .unreadable)
        #expect(ComposerEcho.reading(of: "/clear", on: ["Loading…", ""]) == .unreadable)
    }

    /// One screen, cut to the rows the reading walks. `composing` is what the prompt row holds.
    private static func screen(scrollback: [String], composing: String) -> [String] {
        let rule = String(repeating: "─", count: 120)
        let prompt = composing.isEmpty ? "❯" : "❯ \(composing)"
        return ["  Claude Code v2.1.260", ""]
            + scrollback
            + [rule, prompt, rule, "  Opus Medium  |  Ctx n/a", "  ⏵⏵ auto mode on"]
    }
}
