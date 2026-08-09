import XCTest

/// A reading that is still being written, under a reader who is AT the end of it.
///
/// The inverse of `FeedArrivalE2ETests`, and deliberately the same specimen. That suite's whole
/// claim is that a reader who scrolled away is not moved, and its vacuity guard — `Newest` on
/// screen — is satisfied by a feed that dropped out of following when it should not have. Read
/// alone it makes a broken feed look covered. These two cases are the other half: a reader who
/// never left, and a reader who came back.
///
/// Neither scrolls before it asserts the opening position, which is the thing eight existing suites
/// had no case for.
@MainActor
final class FeedOpeningE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedArriving"
    }

    /// The last edit of the last turn. It is written only as the specimen finishes, so a feed that
    /// opened six hours upstream and stayed there never shows it — and one that opened at the end
    /// and kept following shows it without anybody scrolling.
    private let newestLine = "FeedView51.swift"

    /// The first turn's edit, at the top of the reading. Named so the opening position is asserted
    /// as a place and not only as an absence of the way-back control.
    private let openingLine = "FeedView1.swift"

    /// A Session opens on what is happening NOW.
    ///
    /// Nothing here scrolls. `Newest` is asserted as never having appeared rather than as absent at
    /// one instant: the control is the feed reporting that it lost the end, and the whole of this
    /// claim is that it never does — through the open and through everything that arrives after it.
    func testASessionOpensOnItsNewestLineAndStaysThere() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        XCTAssertFalse(
            app.buttons["Newest"].waitForExistence(timeout: 5),
            "The feed offered the way back down, so it was not sitting at the end.",
        )
        XCTAssertFalse(
            row(naming: openingLine).isHittable,
            "The feed opened at the start of the reading rather than at its newest line.",
        )

        // Without a scroll of any kind: the rows written after launch have to come to the reader.
        let newest = row(naming: newestLine)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 30),
            "The newest line never reached the screen, so arriving rows stopped being followed.",
        )
        XCTAssertTrue(newest.isHittable, "The newest line arrived off screen.")
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// And a reader who scrolled away and came back is followed again.
    ///
    /// The `Newest` control is read twice on purpose, in opposite directions. It appearing is what
    /// says the reader really did detach — without that the walk back down is a walk from the end
    /// to the end. It going, and staying gone while the rest of the fixture arrives, is the claim.
    func testAReaderWhoScrollsBackToTheEndIsFollowedAgain() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let newest = app.buttons["Newest"]
        walk(by: 400, times: 3)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "Scrolling up left the feed following, so nothing here is about coming back.",
        )

        // Back to the end by hand, a screenful at a time — the reading is still growing, so the
        // place being walked to moves while the walk is happening.
        for _ in 0 ..< 60 where newest.exists {
            feed.scroll(byDeltaX: 0, deltaY: -800)
        }
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Reaching the end by hand did not resume following.",
        )

        // The guard against a stopped fixture: the last line has to still be unwritten here, or
        // what follows is a reader sitting at the end of a reading that grows no further.
        let arriving = row(naming: newestLine)
        XCTAssertFalse(arriving.exists, "The specimen had finished writing before the walk ended.")

        XCTAssertTrue(
            arriving.waitForExistence(timeout: 30),
            "Rows arriving after the reader came back did not move the reading.",
        )
        XCTAssertTrue(arriving.isHittable, "The newest line arrived off screen.")
        XCTAssertFalse(
            newest.exists,
            "The feed dropped out of following on a row that arrived while it was at the end.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
