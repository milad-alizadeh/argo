import XCTest

/// A reading walked the whole way down and the whole way back. The jump itself gets no assertion —
/// it is a frame rate, and nothing XCUITest can see says what one is (`FeedMotionE2ETests`). What
/// is
/// testable is that a reading crossing every lazy estimate still holds both of its ends.
@MainActor
final class FeedWalkE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedAtScale"
    }

    /// The start is addressed by the first file the fixture edits, not by "a prompt": only realised
    /// rows are in the accessibility tree, so a query matching any prompt matches whichever one is
    /// on screen. Up first and down second, because the feed opens at the END of the reading.
    func testTheReadingKeepsBothEndsThroughAFullWalk() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let opening = row(naming: "FeedView1.swift")
        walk(by: 600, times: 40)
        XCTAssertTrue(
            opening.waitForExistence(timeout: 10),
            "Walking up the whole reading never reached its start.",
        )
        XCTAssertTrue(opening.isHittable, "The start of the reading was not on screen.")

        let newest = app.buttons["Newest"]
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "A reading walked to its start offered no way back to its newest line.",
        )

        walk(by: -600, times: 40)
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Walking back down the whole reading did not return to its end.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
