import XCTest

/// A Session that has said nothing.
@MainActor
final class FeedSilenceE2ETests: FeedE2ECase {
    override var specimen: String {
        "emptyFeed"
    }

    /// The empty column has to SAY it is empty. Asserted here rather than left to the specimen
    /// render because it is what every change to how the feed holds its place is most likely to
    /// break: a scroll view given a position it cannot resolve draws nothing at all, and nothing at
    /// all is exactly what an empty feed is meant to look like except for these words.
    func testAFeedWithNoRowsSaysSo() {
        XCTAssertTrue(
            app.staticTexts["Nothing to read yet"].waitForExistence(timeout: 20),
            "An empty feed drew a blank column instead of saying it was empty.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
