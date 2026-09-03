import AppKit
import ArgoAtoms
import Testing

/// The platform's own selection paint, switched off under every sidebar row (#1137). The fill is
/// the platform's, so the regression would be an absence of code, and this suite is what keeps the
/// switch thrown; why it is thrown at all is `SidebarSelectionFill`'s.
@Suite("Sidebar selection fill")
@MainActor
struct SidebarSelectionFillTests {
    @Test
    func `the enclosing table stops drawing its own selection`() {
        let table = NSTableView()
        let row = NSTableRowView()
        let content = NSView()
        table.addSubview(row)
        row.addSubview(content)

        let found = SidebarSelectionFill.switchOff(above: content)

        #expect(found === table)
        #expect(table.selectionHighlightStyle == .none)
    }

    /// Nothing above the probe is a table in a preview or a bare `VStack`, and that is not a fault:
    /// the probe answers with nothing and touches nothing.
    @Test
    func `a view outside any table is left alone`() {
        let host = NSView()
        let content = NSView()
        host.addSubview(content)

        #expect(SidebarSelectionFill.switchOff(above: content) == nil)
    }

    /// Cells are recycled, so the probe lands many times on one table. The second landing is a
    /// no-op rather than a second write, or every scroll would re-set a property AppKit reads on
    /// each draw.
    @Test
    func `a table already switched off is not written again`() {
        let table = NSTableView()
        let content = NSView()
        table.addSubview(content)
        table.selectionHighlightStyle = .none

        #expect(SidebarSelectionFill.switchOff(above: content) == nil)
        #expect(table.selectionHighlightStyle == .none)
    }
}
