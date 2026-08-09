import XCTest

/// A second Session opened after the reader had scrolled away from the end of the first.
///
/// The one claim here is that the pane's state dies with the Session it belonged to. It is only
/// checkable by clicking: the state is SwiftUI's, the switch runs through the real sidebar, and a
/// package test has neither.
///
/// It reads through `Newest`, exactly as `FeedEndE2ETests` does, because that control IS the
/// question. It stands on screen precisely while a reading has stopped following — so one still
/// there after a switch is the new Session's feed wearing the old one's place, and the reading
/// opening somewhere in the middle of itself rather than on its newest line.
@MainActor
final class FeedSwitchE2ETests: FeedE2ECase {
    override var specimen: String {
        "twoReadings"
    }

    func testASecondSessionOpensOnItsNewestLine() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let newest = app.buttons["Newest"]
        // Away from the end of the first reading, which is the state that must not travel. Asserted
        // rather than assumed: a walk that moved nothing would leave the whole case checking that a
        // control which was never there is still not there.
        walk(by: 800, times: 3)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "Scrolling up left the first reading still following its Session.",
        )

        let second = rosterRow(titled: "Port the session engine core to Swift")
        XCTAssertTrue(second.waitForExistence(timeout: 10), "The roster drew no second Session.")
        second.click()

        // Waited for rather than read once. The second reading opens by scrolling to its own end
        // across a layout pass, so a bare `exists` taken the instant the click lands would be read
        // before the feed it is asking about has been laid out at all.
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 15),
            "The second Session opened holding the place the reader left in the first.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// A Session in the sidebar, addressed by its title.
    ///
    /// On `value` and not on `label`, which is the one thing here worth writing down. A roster row
    /// combines its children into a single element, and what SwiftUI hands AppKit for one of those
    /// is a cell whose text is its VALUE — the label is empty. `FeedE2ECase.row(naming:)` matches
    /// on labels, which is right for every row in the feed and finds nothing here.
    private func rosterRow(titled title: String) -> XCUIElement {
        app.staticTexts
            .matching(NSPredicate(format: "value CONTAINS %@", title))
            .firstMatch
    }
}
