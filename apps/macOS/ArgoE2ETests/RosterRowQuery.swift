import XCTest

extension XCUIApplication {
    /// A roster row, by the announcement the projection gives it — which opens with the title.
    ///
    /// On the app and not on one base case: the feed's cases switch Sessions through the real
    /// sidebar, so they address a row exactly as the roster's own cases do.
    func rosterRow(titled title: String) -> XCUIElement {
        rosterRow(matching: "BEGINSWITH", title)
    }

    /// A row whose announcement does NOT open with a word a test can spell: a derived title two
    /// rows would draw takes its own time of day in front of the summary (#1567), and that clock
    /// is a different one on every run of this suite.
    func rosterRow(containing text: String) -> XCUIElement {
        rosterRow(matching: "CONTAINS", text)
    }

    private func rosterRow(matching comparison: String, _ text: String) -> XCUIElement {
        descendants(matching: .any)
            .matching(NSPredicate(format: "label \(comparison) %@", text))
            .firstMatch
    }
}
