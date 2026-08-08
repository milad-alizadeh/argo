import XCTest

/// A thumbnail, clicked.
///
/// The lightbox is reachable no other way. It is not a row, so no projection test reaches it, and
/// it is not on screen at rest, so no specimen renders it without being told to — a picture that
/// opens onto nothing, or an overlay with no way back out of it, passes every package test in this
/// repo. Clicking is the only thing that catches either, and this is the only target that clicks.
///
/// `@MainActor` on the case for the same reason `ProjectDrawerE2ETests` carries it: driving a UI is
/// main-actor work under Swift 6 and `XCUIApplication()` is isolated to it.
@MainActor
final class FeedGalleryE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        // The single-shot specimen, not the full gallery: one picture is one unambiguous thing to
        // click, and whether a run of them lays out is the render's question rather than this
        // one's.
        app.launchArguments += ["--specimen", "feedSingleShot"]
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

    /// One walk, for the reason the drawer's suite states: each case here costs a launch, and
    /// relaunching the same bundle id back to back is the flakiest moment in the run.
    func testAThumbnailOpensFullSizeAndCloses() {
        let thumbnail = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'feed-at-rest.png'"))
            .firstMatch
        XCTAssertTrue(thumbnail.waitForExistence(timeout: 20), "The gallery drew no thumbnail.")
        thumbnail.click()

        // Addressed by the label the lightbox already carries — the WHOLE path, which is the one
        // thing it says that the thumbnail does not.
        let lit = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS 'feed-at-rest.png, full size'"))
            .firstMatch
        XCTAssertTrue(lit.waitForExistence(timeout: 10), "Clicking the thumbnail opened nothing.")
        XCTAssertEqual(app.state, .runningForeground)

        // The scrim is the way out, and it is the same gesture that opened it.
        lit.click()
        XCTAssertTrue(
            lit.waitForNonExistence(timeout: 10),
            "The lightbox stayed up after being clicked.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
