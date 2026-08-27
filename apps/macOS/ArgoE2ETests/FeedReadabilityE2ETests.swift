import XCTest

/// Whether a screen reader can read a short session at all.
///
/// The one claim no package test can make: SwiftUI builds no accessibility tree at all in a test
/// process with no client attached, so every ArgoUI suite passed while the feed was silent (#777).
/// A reading short enough to fit the pane recycles no cell, which is exactly the case that was
/// unreadable from launch to teardown.
@MainActor
class FeedReadabilityCase: FeedE2ECase {
    /// Every row of the reading publishes something to say. Shared, because the two specimens
    /// #777 caught publishing nothing differ in one thing only — how many rows they hold.
    func assertEveryRowSpeaks() {
        // Straight to the table, and never through the shared `label ==` helper: that one walks
        // every descendant of the app, and a reading whose rows all publish is a far bigger tree
        // to walk than the silent one this case was written against.
        let table = app.tables.firstMatch
        XCTAssertTrue(table.waitForExistence(timeout: 30), "The deck drew no feed.")
        let rows = table.cells
        XCTAssertTrue(rows.firstMatch.waitForExistence(timeout: 30), "The feed drew no row.")

        XCTAssertEqual(silentRows(among: rows), [], "Rows published nothing to read.")
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// The rows carrying no words, once the reading has had time to settle. Polled rather than read
    /// once: a row realised on the opening pass is in the tree a beat before what it draws is.
    private func silentRows(among rows: XCUIElementQuery) -> [Int] {
        var silent = Array(0 ..< rows.count)
        for _ in 0 ..< 20 where !silent.isEmpty {
            silent = silent.filter { !speaks(rows.element(boundBy: $0)) }
        }
        return silent
    }

    /// Whether anything inside the row carries words a screen reader would say. Scoped to the one
    /// row, so the walk is a cell's worth of tree rather than the app's.
    private func speaks(_ row: XCUIElement) -> Bool {
        row.descendants(matching: .any)
            .matching(NSPredicate(format: "label != ''"))
            .firstMatch
            .exists
    }
}

/// Twenty call rows, which fit the pane — so no row here is ever realised by a scroll.
@MainActor
final class FeedReadabilityE2ETests: FeedReadabilityCase {
    override var specimen: String {
        "feedCalls"
    }

    func testEveryRowOfAShortReadingSpeaksToAScreenReader() {
        assertEveryRowSpeaks()
    }
}

/// One row, which is the shortest a reading gets — the other specimen #777 measured at zero
/// labels, and the case no amount of scrolling could ever have rescued.
@MainActor
final class FeedOneRowReadabilityE2ETests: FeedReadabilityCase {
    override var specimen: String {
        "feedSingleShot"
    }

    func testTheOnlyRowOfAOneRowReadingSpeaksToAScreenReader() {
        assertEveryRowSpeaks()
    }
}
