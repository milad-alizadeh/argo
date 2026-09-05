import AppKit
@testable import ArgoUI
import Testing

/// Which click a set of held modifiers is (#1247). The reading itself is one line; what it pins
/// is the precedence, which is the half a later edit can get wrong without any test failing.
@Suite("What a held modifier makes of a click")
struct RowClickTests {
    @Test
    func `a bare click is the plain one`() {
        #expect(RowClick.modifiers([]) == .plain)
    }

    @Test
    func `shift extends the range`() {
        #expect(RowClick.modifiers(.shift) == .extending)
    }

    @Test
    func `command toggles the one row`() {
        #expect(RowClick.modifiers(.command) == .toggling)
    }

    /// Both down is a range, as it is in every system list — and option, control and the caps
    /// lock a keyboard leaves on say nothing about a list at all.
    @Test
    func `shift outranks command and the rest say nothing`() {
        #expect(RowClick.modifiers([.shift, .command]) == .extending)
        #expect(RowClick.modifiers([.option, .control, .capsLock]) == .plain)
    }
}
