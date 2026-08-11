import ArgoEngine
@testable import ArgoUI
import Testing

/// What the Mode control says for one reading of a Session's stance (#545). The claim under
/// ADR-0025's `≈`: an approximation is drawn, and it is never drawn as a choice.
@Suite("What the Mode control says for a reading")
struct SessionModeReadingLabelTests {
    @Test
    func `an exact rung is its own word, with nothing to footnote`() {
        let reading = SessionModeReading.exactly(.code, cli: "acceptEdits")

        #expect(reading.word == "Code")
        #expect(reading.report == nil)
        #expect(reading.help == "Code — the Workspace")
    }

    @Test
    func `a nearest rung is marked, and says what the CLI reported`() {
        let reading = SessionModeReading.nearly(.readOnly, cli: "default")

        #expect(reading.word == "≈ Read Only")
        #expect(reading.help == "≈ Read Only — no writes · reported as default")
    }

    /// Verbatim and never reworded: the CLI's own value is what the approximation is measured
    /// against, so a tidied-up version of it would answer a different question.
    @Test(arguments: ["default", "manual", "bypassPermissions", "dontAsk"])
    func `the CLI's own value reaches the reader unchanged`(cli: String) {
        #expect(SessionModeReading.nearly(.auto, cli: cli).help.hasSuffix(cli))
        #expect(SessionModeReading.unknown(cli: cli).help.hasSuffix(cli))
    }

    @Test
    func `a stance on no rung says unknown and takes the question mark`() {
        let reading = SessionModeReading.unknown(cli: "dontAsk")

        #expect(reading.word == "unknown")
        #expect(reading.mark == ArgoSymbol.modeUnknown)
    }

    /// The one case with nothing observed at all — a Session whose records have not stated a
    /// stance. It says so rather than naming a value nobody reported.
    @Test
    func `a stance nothing has reported says so`() {
        #expect(SessionModeReading.unknown(cli: nil).help == "unknown · no stance has been read")
    }

    /// The tick is the control saying *this is where you are*. On an approximation it would be the
    /// false DIRECT the honesty tiers exist to stop, so only an exact reading selects a rung.
    @Test
    func `only an exact reading ticks a rung`() {
        #expect(SessionModeReading.exactly(.plan, cli: "plan").exactRung == .plan)
        #expect(SessionModeReading.nearly(.readOnly, cli: "default").exactRung == nil)
        #expect(SessionModeReading.unknown(cli: "dontAsk").exactRung == nil)
    }

    /// `unknown` is not a rung, so it never turns up among the four the menu offers.
    @Test
    func `unknown is not a rung the menu can offer`() {
        #expect(!SessionMode.allCases.map(\.label).contains("unknown"))
        #expect(!SessionMode.allCases.map(\.mark).contains(ArgoSymbol.modeUnknown))
    }
}
