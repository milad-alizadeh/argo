import XCTest

/// The launch every feed case shares, and the gestures all of them drive it with. Cases differ in
/// exactly one thing — which named state the app opens on. `@MainActor` because `XCUIApplication()`
/// is isolated to it under Swift 6.
@MainActor
class FeedE2ECase: XCTestCase {
    /// Which named state the app opens on. Every case answers it; the base answers it for none.
    var specimen: String {
        preconditionFailure("A feed case must name the specimen it opens on.")
    }

    let app = XCUIApplication()

    /// The feed zone. A fresh query each time it is asked for, which is what makes it honest after
    /// something has re-laid the column out.
    var feed: XCUIElement {
        element(labelled: "Feed")
    }

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", specimen]
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

    func element(labelled label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    /// A call row, addressed by the file its edit names — the long fixture numbers those, so this
    /// matches one row rather than one of fifty that read alike.
    func row(naming file: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", file))
            .firstMatch
    }

    /// A screenful at a time until the row is reachable. In screenfuls rather than one throw
    /// because the reading is lazy: a row is realised by the scroll that reaches it, and a single
    /// large delta lands past it on estimated heights. Upwards by default — the feed opens on its
    /// newest line, so everything already written is above the reader.
    func scroll(until row: XCUIElement, by delta: CGFloat = 400, steps: Int = 30) {
        let column = feed
        for _ in 0 ..< steps where !row.exists || !row.isHittable {
            column.scroll(byDeltaX: 0, deltaY: delta)
        }
    }

    /// A screenful at a time, a fixed number of times, where there is no row to name.
    func walk(by delta: CGFloat, times steps: Int) {
        let column = feed
        for _ in 0 ..< steps {
            column.scroll(byDeltaX: 0, deltaY: delta)
        }
    }

    /// Down until the way back down is gone, which is the only thing that says the end was reached
    /// — there is no row to name there, and on a reading still being written the place moves while
    /// the walk is happening. A wide throw because the column is at its tallest with the panel
    /// open.
    func walkToEnd() {
        let newest = app.buttons["Newest"]
        let column = feed
        for _ in 0 ..< 60 where newest.exists {
            column.scroll(byDeltaX: 0, deltaY: -800)
        }
    }

    /// The seam, moved a column's worth. Held for a moment before it travels: a drag that begins
    /// and ends in the same event is a click, and the gesture under test has a minimum distance.
    func drag(_ seam: XCUIElement) {
        XCTAssertTrue(seam.waitForExistence(timeout: 10), "The deck drew no draggable seam.")
        let from = seam.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        from.press(forDuration: 0.3, thenDragTo: from.withOffset(CGVector(dx: -120, dy: 0)))
    }
}
