import XCTest

/// A reading walked the whole way down and the whole way back.
///
/// The jump itself gets no assertion, for the reason `FeedMotionE2ETests` gives about the other two
/// motion symptoms: it is a frame rate, and nothing XCUITest can see says what one is. What is
/// testable is the structural claim underneath it — a reading that has crossed every estimate the
/// lazy stack ever made still holds both of its ends.
@MainActor
final class FeedWalkE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedAtScale"
    }

    /// The start is addressed by the first file the fixture edits rather than by "a prompt". Only
    /// realised rows are in the accessibility tree, so a query that matches any prompt matches
    /// whichever one is on screen — and a walk that stalled halfway would satisfy it.
    func testTheReadingKeepsBothEndsThroughAFullWalk() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let opening = row(naming: "FeedView1.swift")
        XCTAssertTrue(
            opening.waitForExistence(timeout: 10),
            "The feed did not open at the start of the reading.",
        )
        XCTAssertTrue(opening.isHittable, "The start of the reading was not on screen at launch.")

        let newest = app.buttons["Newest"]
        walk(by: -600, times: 40)
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Walking down the whole reading never reached its end.",
        )

        walk(by: 600, times: 40)
        XCTAssertTrue(
            opening.isHittable,
            "Walking back up the whole reading did not return to its start.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
