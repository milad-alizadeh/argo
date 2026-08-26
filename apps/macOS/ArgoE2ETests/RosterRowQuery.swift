import XCTest

extension XCUIApplication {
    /// A roster row, by the announcement the projection gives it — which opens with the title.
    ///
    /// On the app and not on one base case: the feed's cases switch Sessions through the real
    /// sidebar, so they address a row exactly as the roster's own cases do.
    func rosterRow(titled title: String) -> XCUIElement {
        descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }
}
