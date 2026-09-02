import XCTest

/// The ways every roster case addresses a row. The launch itself is `E2ECase`'s.
@MainActor
class RosterE2ECase: E2ECase {
    func row(titled title: String) -> XCUIElement {
        app.rosterRow(titled: title)
    }

    /// The list cell AROUND that row, which is where selection is reported: the element the row's
    /// announcement labels is the content inside it, and content does not know it was picked.
    func cell(titled title: String) -> XCUIElement {
        app.cells
            .containing(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }

    /// Where the title is drawn inside a row — the leading part of its upper line. Geometric
    /// because the row is deliberately ONE accessibility element, so the title is not separately
    /// addressable.
    func titleArea(of row: XCUIElement) -> XCUICoordinate {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.35))
    }

    /// Where a row's own label is drawn, past any mark in its leading gutter. Geometric for the
    /// reason `titleArea(of:)` is.
    func labelArea(of row: XCUIElement) -> XCUICoordinate {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5))
    }

    /// Waits on a change of STATE on an element that already exists, which no existence
    /// expectation can ask about.
    func expect(_ predicate: String, of element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
        let met = expectation(for: NSPredicate(format: predicate), evaluatedWith: element)
        return XCTWaiter().wait(for: [met], timeout: timeout) == .completed
    }
}
