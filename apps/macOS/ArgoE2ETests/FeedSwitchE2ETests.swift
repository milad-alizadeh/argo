import XCTest

/// A second Session opened after the reader had scrolled away from the end of the first.
///
/// The one claim here is that the pane's state dies with the Session it belonged to. It is only
/// checkable by clicking: the state is SwiftUI's, the switch runs through the real sidebar, and a
/// package test has neither.
///
/// It reads through `Newest`, which stands on screen precisely while a reading has stopped
/// following — so one still there after a switch is the new Session's feed wearing the old one's
/// place.
@MainActor
final class FeedSwitchE2ETests: FeedE2ECase {
    override var specimen: String {
        "twoReadings"
    }

    func testASecondSessionOpensOnItsNewestLine() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let newest = app.buttons["Newest"]
        // Away from the end of the first reading, which is the state that must not travel. Asserted
        // rather than assumed: a walk that moved nothing would leave the case checking nothing.
        walk(by: 800, times: 3)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "Scrolling up left the first reading still following its Session.",
        )

        let second = app.rosterRow(titled: "Port the session engine core to Swift")
        XCTAssertTrue(second.waitForExistence(timeout: 10), "The roster drew no second Session.")
        second.click()

        // The second reading opens by scrolling to its own end across a layout pass, so a bare
        // `exists` taken the instant the click lands would read before that feed is laid out.
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 15),
            "The second Session opened holding the place the reader left in the first.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
