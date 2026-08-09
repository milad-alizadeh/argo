import XCTest

/// A reading that is still being written, under a reader who has scrolled up.
@MainActor
final class FeedArrivalE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedArriving"
    }

    /// Rows arrive at the END of the reading. Somebody reading the middle of it must not be moved
    /// by that — which is the whole of the difference between following a Session and reading one.
    ///
    /// The row it holds is well inside the half the specimen opens with, deliberately. A row near
    /// the boundary can be reached while the reading is still following, and a feed that is
    /// following is SUPPOSED to move — the test would then fail for the opposite of its claim.
    ///
    /// The last two assertions are what stop it passing vacuously. `Newest` says the reader really
    /// is off the end, and the closing row says the reading really did grow while they sat there —
    /// without both, a specimen that had stopped writing would satisfy every line above.
    func testRowsArrivingBelowDoNotMoveTheRowBeingRead() async throws {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let anchor = row(naming: "FeedView13.swift")
        scroll(until: anchor)
        XCTAssertTrue(anchor.isHittable, "Never reached the middle of the reading.")
        XCTAssertTrue(
            app.buttons["Newest"].waitForExistence(timeout: 10),
            "The reading was still following, so nothing arriving below could have moved it.",
        )
        let before = anchor.frame

        // Long enough for the specimen to write out the rest of the fixture — the claim is about a
        // reading growing under a reader, so the wait IS the mechanism under test. Read against
        // `ArrivingFeedSpecimen`'s pace, which is deliberately slow enough to scroll during.
        try await Task.sleep(for: .seconds(15))

        XCTAssertTrue(anchor.isHittable, "Arriving rows took the reader off the row they were on.")
        XCTAssertEqual(
            before.origin.y,
            anchor.frame.origin.y,
            accuracy: 1,
            "Arriving rows moved the row being read.",
        )

        // And the reading really did grow: the last turn's edit is in the half that had not been
        // written when the reader stopped on the row above.
        let arrived = row(naming: "FeedView51.swift")
        scroll(until: arrived, by: -400, steps: 60)
        XCTAssertTrue(arrived.exists, "Nothing arrived, so the reader was never read under.")
        XCTAssertEqual(app.state, .runningForeground)
    }
}
