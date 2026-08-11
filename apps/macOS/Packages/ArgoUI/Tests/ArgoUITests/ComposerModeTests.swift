@testable import ArgoUI
import Testing

/// What a rung of the Mode ladder carries. `ModePicker` draws these; whether it draws them where
/// the design says is the `composer` render's question.
@Suite("A rung of the Mode ladder")
struct ComposerModeTests {
    @Test
    func `every rung names where it stops`() {
        for mode in ComposerMode.allCases {
            #expect(!mode.boundary.isEmpty)
        }
    }

    @Test
    func `every rung carries a mark`() {
        for mode in ComposerMode.allCases {
            #expect(!mode.mark.isEmpty)
        }
    }

    /// Two rungs on one mark would leave the ladder carrying its reading in the word alone, which
    /// is the state #608 exists to leave.
    @Test
    func `no two rungs share a mark`() {
        let marks = ComposerMode.allCases.map(\.mark)
        #expect(Set(marks).count == marks.count)
    }

    /// The rung and the code room name one thing, so they take one mark.
    @Test
    func `the Code rung takes the code room's own mark`() {
        #expect(ComposerMode.code.mark == ArgoSymbol.programSource)
    }

    /// The pair ADR-0025 kept deliberately: same boundary, different intent. A future edit that
    /// collapses them has to fail something.
    @Test
    func `the Plan rung shares Read Only's boundary and not its mark`() {
        #expect(ComposerMode.plan.boundary.hasPrefix(ComposerMode.readOnly.boundary))
        #expect(ComposerMode.plan.mark != ComposerMode.readOnly.mark)
    }
}
