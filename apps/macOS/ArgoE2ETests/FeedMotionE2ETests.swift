import XCTest

/// The feed while the deck moves under it.
///
/// Every claim here is about what happens BETWEEN two layouts, which is why it cannot live in a
/// package test: the reader's place in a lazy stack is decided by estimated row heights, and the
/// bug this guards against is those estimates being thrown away by a remeasure. A projection has no
/// estimates, a specimen render has no second layout to compare against, and both pass while the
/// column goes blank on the machine (#473).
///
/// The two symptoms that are pure motion — prose shimmering under a held dragger, and a scroll that
/// hitches — have no assertion at all. They are a frame rate, and nothing XCUITest can see says
/// what one is. What is testable is the structural claim underneath them: the row the reader was on
/// is still the row on screen after the column has been re-laid out.
@MainActor
final class FeedMotionE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// A session at the length a real one reaches. At anything shorter the stack estimates nothing,
    /// so the place being held is a place that could not be lost.
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

    /// One walk, for the reason the other suites here state: each case costs a launch, and
    /// relaunching the same bundle id back to back is the flakiest moment in the run.
    ///
    /// Every assertion after the first is the same question asked again: is the anchor row still on
    /// screen? Before the fix, opening the panel left the retained offset pointing past the end of
    /// the re-estimated content, and the answer was no.
    ///
    /// The seam it drags is the panel's. This specimen has no running subagents, so the rail — and
    /// the second seam with it — is not on screen to grab; both are the same `DeckSeam`.
    func testTheReaderKeepsTheirPlaceWhileTheColumnIsResized() {
        let feed = element(labelled: "Feed")
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let anchor = row(naming: "FeedView25.swift")
        scroll(feed, until: anchor)
        XCTAssertTrue(anchor.isHittable, "Never reached the middle of the reading.")

        anchor.click()
        let panel = element(labelled: "Evidence")
        XCTAssertTrue(panel.waitForExistence(timeout: 10), "The row opened no panel.")
        XCTAssertTrue(
            anchor.isHittable,
            "Opening the panel took the reading away from the row it was opened from.",
        )

        drag(element(labelled: "Resize"))
        XCTAssertTrue(panel.exists, "The seam drag closed the panel.")
        XCTAssertTrue(anchor.isHittable, "Dragging the seam lost the reader's place.")

        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(panel.waitForNonExistence(timeout: 10), "The panel stayed up after Escape.")
        XCTAssertTrue(anchor.isHittable, "Closing the panel lost the reader's place.")
        XCTAssertEqual(app.state, .runningForeground)
    }

    private func element(labelled label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    /// A call row, addressed by the file its edit names. The long fixture numbers those, so this is
    /// one row rather than one of fifty that read alike.
    private func row(naming file: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", file))
            .firstMatch
    }

    /// Down in screenfuls rather than in one throw, because the row being looked for is realised by
    /// the scroll that reaches it — a single large delta lands past it on estimated heights.
    private func scroll(_ feed: XCUIElement, until row: XCUIElement) {
        for _ in 0 ..< 30 where !row.exists || !row.isHittable {
            feed.scroll(byDeltaX: 0, deltaY: -400)
        }
    }

    /// The seam, moved a column's worth. Held for a moment before it travels: a drag that begins
    /// and ends in the same event is a click, and the gesture under test has a minimum distance.
    private func drag(_ seam: XCUIElement) {
        XCTAssertTrue(seam.waitForExistence(timeout: 10), "The deck drew no draggable seam.")
        let from = seam.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        from.press(forDuration: 0.3, thenDragTo: from.withOffset(CGVector(dx: -120, dy: 0)))
    }
}
