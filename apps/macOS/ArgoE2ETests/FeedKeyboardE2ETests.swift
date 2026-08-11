import XCTest

/// The feed, driven by the keyboard.
///
/// Everything asserted here passes every package test in this repo while being broken. A row can
/// carry `.focusable()` and never take focus; `openEvidence(of:)` can be correct while the panel
/// that opens has nowhere to hand the keyboard back to; and Escape depends on which view holds the
/// responder chain, which no projection knows. Only a target that presses keys catches any of it.
///
/// `@MainActor` for the reason the other cases here carry it: driving a UI is main-actor work under
/// Swift 6, and `XCUIApplication()` is isolated to it.
@MainActor
final class FeedKeyboardE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// The call rows rather than the whole feed: every row in this specimen is a piece of work, so
    /// the first thing focus lands on is a row that opens something.
    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "feedCalls"]
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

    /// One walk: each case costs a launch, and relaunching the same bundle id back to back is the
    /// flakiest moment in the run.
    ///
    /// The last two presses are the point. Escape closes the panel, and the Return after it
    /// re-opens it with nothing clicked in between — only possible if the keyboard came back to
    /// the row the panel was opened from.
    func testARowOpensItsEvidenceAndTakesTheKeyboardBack() {
        // The failed command in the preview transcript, addressed by the sentence the row speaks.
        let row = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'Ran swift build'"))
            .firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 20), "The feed drew no call row.")
        row.click()

        let panel = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == 'Evidence'"))
            .firstMatch
        XCTAssertTrue(panel.waitForExistence(timeout: 10), "Clicking the row opened no panel.")

        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(
            panel.waitForNonExistence(timeout: 10),
            "The panel stayed up after Escape.",
        )

        app.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(
            panel.waitForExistence(timeout: 10),
            "Return did not re-open the panel, so the keyboard never came back to the row.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}

/// The feed, scrolled.
///
/// Whether a reading follows the Session or holds the page you scrolled to is a scroll offset
/// against a content height, both decided by a lazy stack at layout — so no value a package test
/// can hold is the same claim.
@MainActor
final class FeedFollowingE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// A session at the length a real one reaches, because a feed that fits its pane never scrolls
    /// and so can never stop following.
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

    func testScrollingAwayFromTheEndOffersTheWayBackToIt() {
        let feed = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == 'Feed'"))
            .firstMatch
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let newest = app.buttons["Newest"]

        // The feed opens at the end of the reading, so the control is already absent — the
        // baseline the two scrolls below are read against (`FeedOpeningE2ETests` claims it).
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "The way back down was up at the end of the reading.",
        )

        feed.scroll(byDeltaX: 0, deltaY: 2000)
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "Scrolling up offered no way back to the newest line.",
        )

        newest.click()
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "The way back down stayed up after being used.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
