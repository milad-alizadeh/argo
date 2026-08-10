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
    ///
    /// Up first and down second, because the feed opens at the END of the reading: the walk starts
    /// from whichever end the reader is given, and this one is given the newest line.
    ///
    /// The count of screenfuls is a fact about the FIXTURE's length and has to move with it: a walk
    /// that stops short does not fail loudly, it fails as "the start was never reached", which
    /// reads like a bug in the feed.
    func testTheReadingKeepsBothEndsThroughAFullWalk() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let opening = row(naming: "FeedView1.swift")
        walk(by: 600, times: 160)
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

        walk(by: -600, times: 160)
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Walking back down the whole reading did not return to its end.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
