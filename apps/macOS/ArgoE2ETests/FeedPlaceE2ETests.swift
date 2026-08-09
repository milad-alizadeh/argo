import XCTest

/// Where the reader IS in a long reading, across the things that move it.
///
/// `FeedMotionE2ETests` covers the place surviving a panel opening and a seam moving under a reader
/// who is mid-reading. These are the three states that behave differently because the place being
/// held is not a row: a reading at its END holds the end and not a line; a reading being WRITTEN
/// holds a line while lines arrive below it; and a reading with nothing in it holds nothing and has
/// to say so. None of the three is reachable from a projection, and a specimen render answers none
/// of them — every one is a claim about what is on screen AFTER something else happened.
@MainActor
final class FeedEndE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// The length with the panel already open, because the panel's seam is the only draggable one
    /// on a specimen with no running subagents — and reaching it by clicking a row would first
    /// narrow the column the scroll under test is measured in.
    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "feedAtScaleEvidence"]
        app.launch()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    /// The end is a place too, and it is the one place a row id cannot name: a reading that is
    /// following has no line to hold, and a column re-laid out at a new width re-wraps every line
    /// in it, so the offset the end used to sit at is somewhere in the middle of it afterwards.
    ///
    /// `Newest` is the assertion because it IS the question. The way back down is on screen exactly
    /// while the reading has stopped following, so a control that reappears after a drag nobody
    /// scrolled during is the feed reporting it lost the end.
    func testTheEndOfTheReadingSurvivesASeamDrag() {
        let feed = element(labelled: "Feed")
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        // A screenful at a time until the way back down goes: the column is at its narrowest with
        // the panel open, so the same rows stand several times taller than they do beside a
        // minimap, and one throw lands a long way short of the end.
        let newest = app.buttons["Newest"]
        for _ in 0 ..< 60 where newest.exists {
            feed.scroll(byDeltaX: 0, deltaY: -800)
        }
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Never reached the end of the reading.",
        )

        drag(element(labelled: "Resize"))
        XCTAssertFalse(
            newest.exists,
            "Dragging the seam left the reading short of the end it was sitting at.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    private func element(labelled label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    /// The seam, moved a column's worth. Held for a moment before it travels: a drag that begins
    /// and ends in the same event is a click, and the gesture under test has a minimum distance.
    private func drag(_ seam: XCUIElement) {
        XCTAssertTrue(seam.waitForExistence(timeout: 10), "The deck drew no draggable seam.")
        let from = seam.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        from.press(forDuration: 0.3, thenDragTo: from.withOffset(CGVector(dx: -120, dy: 0)))
    }
}

/// A reading walked end to end and back.
///
/// The jump itself gets no assertion, for the reason `FeedMotionE2ETests` states about the other
/// two motion symptoms: it is a frame rate, and nothing XCUITest can see says what one is. What is
/// testable is the structural claim underneath it — a reading walked the whole way down and the
/// whole way back is the same reading, still holding its two ends. An offset measured against
/// estimated row heights loses one of them.
@MainActor
final class FeedWalkE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "feedAtScale"]
        app.launch()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    func testWalkingTheReadingEndToEndAndBackKeepsBothOfItsEnds() {
        let feed = element(labelled: "Feed")
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        // The first row of the reading, on screen because a feed opens at its start.
        let opening = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'Prompt: '"))
            .firstMatch
        XCTAssertTrue(opening.waitForExistence(timeout: 10), "The feed drew no opening prompt.")

        // A screenful at a time rather than one throw, for the reason the stack is lazy: rows are
        // realised by the scroll that reaches them, and a single large delta jumps clean over the
        // estimates being replaced, which is the moment this walk exists to cross.
        let newest = app.buttons["Newest"]
        walk(feed, by: -600)
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Walking down the whole reading never reached its end.",
        )

        walk(feed, by: 600)
        XCTAssertTrue(
            opening.isHittable,
            "Walking back up the whole reading did not return to its start.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    private func element(labelled label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    private func walk(_ feed: XCUIElement, by delta: CGFloat) {
        for _ in 0 ..< 40 {
            feed.scroll(byDeltaX: 0, deltaY: delta)
        }
    }
}

/// A reading that is still being written, under a reader who has scrolled up.
@MainActor
final class FeedArrivalE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "feedArriving"]
        app.launch()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    /// Rows arrive at the END of the reading. Somebody reading the middle of it must not be moved
    /// by that — which is the whole of the difference between following a Session and reading one.
    func testRowsArrivingBelowDoNotMoveTheRowBeingRead() async throws {
        let feed = element(labelled: "Feed")
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let anchor = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS 'FeedView25.swift'"))
            .firstMatch
        for _ in 0 ..< 30 where !anchor.exists || !anchor.isHittable {
            feed.scroll(byDeltaX: 0, deltaY: -400)
        }
        XCTAssertTrue(anchor.isHittable, "Never reached the middle of the reading.")
        let before = anchor.frame

        // Long enough for several rounds of the specimen's own arrivals — the claim is about a
        // reading growing under a reader, so the wait IS the mechanism under test.
        try await Task.sleep(for: .seconds(3))

        XCTAssertTrue(anchor.isHittable, "Arriving rows took the reader off the row they were on.")
        XCTAssertEqual(
            before.origin.y,
            anchor.frame.origin.y,
            accuracy: 1,
            "Arriving rows moved the row being read.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    private func element(labelled label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }
}

/// A Session that has said nothing.
@MainActor
final class FeedSilenceE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "emptyFeed"]
        app.launch()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    /// The empty column has to SAY it is empty. It is asserted here rather than left to the
    /// specimen render because it is what every change to how the feed holds its place is most
    /// likely to break: a scroll view given a position it cannot resolve draws nothing at all, and
    /// nothing at all is exactly what an empty feed is meant to look like except for these words.
    func testAFeedWithNoRowsSaysSo() {
        XCTAssertTrue(
            app.staticTexts["Nothing to read yet"].waitForExistence(timeout: 20),
            "An empty feed drew a blank column instead of saying it was empty.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
