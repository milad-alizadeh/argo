import XCTest

/// A reading that is still being written, under a reader who is AT the end of it.
///
/// The inverse of `FeedArrivalE2ETests`, on the same specimen: that suite's vacuity guard —
/// `Newest` on screen — is satisfied by a feed that dropped out of following when it should not
/// have. The first two cases here scroll nothing before they assert.
@MainActor
final class FeedOpeningE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedArriving"
    }

    /// The last edit of the last turn. It is written only as the specimen finishes, so a feed that
    /// opened six hours upstream and stayed there never shows it.
    ///
    /// A literal because `FeedProjection.longRows` is generated inside `ArgoUI` and a UI test
    /// target cannot reach it. Grow the fixture past turn 51 and this stops naming the last row.
    private let newestLine = "FeedView51.swift"

    /// The first turn's edit, at the top of the reading.
    private let openingLine = "FeedView1.swift"

    /// A Session opens on what is happening NOW, and not six hours upstream of it.
    ///
    /// Nothing here scrolls. The absence of `Newest` is asserted as never having appeared rather
    /// than as absent at one instant, because the control is the feed reporting it lost the end.
    func testASessionOpensOnItsNewestLine() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        XCTAssertFalse(
            app.buttons["Newest"].waitForExistence(timeout: 5),
            "The feed offered the way back down, so it did not open sitting at the end.",
        )
        XCTAssertFalse(
            row(naming: openingLine).isHittable,
            "The feed opened at the start of the reading rather than at its newest line.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// And rows arriving under a reader who never left the end bring the reading with them.
    ///
    /// Still without a scroll of any kind. The row it waits for is written only as the specimen
    /// finishes, so a feed that stopped following partway through never satisfies it.
    func testRowsArrivingAtTheEndBringTheReadingWithThem() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let newest = row(naming: newestLine)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 30),
            "The newest line never reached the screen, so arriving rows stopped being followed.",
        )
        XCTAssertTrue(newest.isHittable, "The newest line arrived off screen.")
        XCTAssertFalse(
            app.buttons["Newest"].exists,
            "The feed dropped out of following on a row that arrived while it was at the end.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// A reader who scrolled away and came back is followed again.
    ///
    /// The `Newest` control is read twice, in opposite directions. It appearing is what says the
    /// reader really did detach — without that, the walk back down is a walk from the end to the
    /// end. It going, and staying gone while the reading finishes, is the claim.
    func testAReaderWhoScrollsBackToTheEndIsFollowedAgain() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let newest = app.buttons["Newest"]
        walk(by: 400, times: 3)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "Scrolling up left the feed following, so nothing here is about coming back.",
        )

        walkToEnd()
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Reaching the end by hand did not resume following.",
        )

        // Whether the fixture is still writing by now is a race with the walk above, so the claim
        // is stated the one way that holds either side of it: the reader is at the end and the last
        // line is on screen with them, without anything further being scrolled.
        let arriving = row(naming: newestLine)
        XCTAssertTrue(
            arriving.waitForExistence(timeout: 30),
            "The last line never reached the reader who had walked back to the end.",
        )
        XCTAssertTrue(arriving.isHittable, "The newest line arrived off screen.")
        XCTAssertFalse(
            newest.exists,
            "The feed dropped out of following after the reader walked back to the end.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
