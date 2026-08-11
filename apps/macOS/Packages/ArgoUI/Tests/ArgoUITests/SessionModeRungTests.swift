import ArgoEngine
@testable import ArgoUI
import Testing

/// What a rung of the Mode ladder carries. `ModePicker` draws these; whether it draws them where
/// the design says is the `composer` render's question.
@Suite("A rung of the Mode ladder")
struct SessionModeRungTests {
    @Test(arguments: SessionMode.allCases)
    func `a rung names where it stops`(mode: SessionMode) {
        #expect(!mode.boundary.isEmpty)
    }

    @Test(arguments: SessionMode.allCases)
    func `a rung carries a mark`(mode: SessionMode) {
        #expect(!mode.mark.isEmpty)
    }

    /// Two rungs on one mark would leave the ladder carrying its reading in the word alone, which
    /// is the state #608 exists to leave.
    @Test
    func `no two rungs share a mark`() {
        let marks = SessionMode.allCases.map(\.mark)
        #expect(Set(marks).count == marks.count)
    }

    @Test
    func `the Code rung takes the code room's own mark`() {
        #expect(SessionMode.code.mark == ArgoSymbol.programSource)
    }

    /// The pair ADR-0025 kept deliberately: same boundary, different intent.
    @Test
    func `the Plan rung shares Read Only's boundary`() {
        #expect(SessionMode.plan.boundary.hasPrefix(SessionMode.readOnly.boundary))
    }

    /// Which is why the mark is what tells them apart.
    @Test
    func `the Plan rung takes a mark of its own`() {
        #expect(SessionMode.plan.mark != SessionMode.readOnly.mark)
    }
}
