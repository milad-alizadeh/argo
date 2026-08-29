import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Mode control says, for a reading and for a rung held until the Turn ends (#940).
@Suite("Mode control label")
struct ModeControlLabelTests {
    @Test(arguments: SessionMode.allCases)
    func `an exact reading says its rung and ticks it`(rung: SessionMode) {
        let label = ModeControlLabel(.exactly(rung, cli: "acceptEdits"))

        #expect(label.word == rung.label)
        #expect(label.tick == rung)
        #expect(label.report == nil)
    }

    /// #545's own mark, spent on a rung Argo is holding rather than one it is reporting.
    @Test
    func `a held rung is drawn under the approximation mark`() {
        let label = ModeControlLabel(.exactly(.code, cli: "acceptEdits"), held: .auto)

        #expect(label.word == "≈ \(SessionMode.auto.label)")
        #expect(label.mark == SessionMode.auto.mark)
    }

    /// The one thing a held rung must never do. It is not the rung the Session stands on, and a
    /// tick beside it would be a DIRECT claim about a stance Argo only asked for.
    @Test(arguments: SessionMode.allCases)
    func `a held rung ticks nothing`(held: SessionMode) {
        #expect(ModeControlLabel(.exactly(.code, cli: "acceptEdits"), held: held).tick == nil)
        #expect(ModeControlLabel(.unknown(cli: nil), held: held).tick == nil)
    }

    /// The held rung has taken the slot that otherwise says where the Session stands, so the
    /// footnote has to name BOTH — or the control stops saying the one true thing it had.
    @Test
    func `a held rung names the rung the Session is still on`() {
        let reading = SessionModeReading.exactly(.code, cli: "acceptEdits")

        let label = ModeControlLabel(reading, held: .auto)

        #expect(label.report == "\(SessionMode.code.label) until this Turn ends, then Auto")
        #expect(label.help.hasSuffix(ModeControlLabel.holding(.auto, on: reading)))
    }

    /// A stance the ladder has no rung for keeps its own word under a held rung, rather than
    /// being rounded into one — `unknown` is a fact, and the held rung does not settle it.
    @Test
    func `a held rung over an unreadable stance still says unknown`() {
        let label = ModeControlLabel(.unknown(cli: "dontAsk"), held: .auto)

        #expect(label.report?.hasPrefix("unknown") == true)
    }
}
