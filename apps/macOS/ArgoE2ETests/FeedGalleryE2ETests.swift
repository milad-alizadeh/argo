import XCTest

/// A thumbnail, clicked. The lightbox is reachable no other way, and this is the only target that
/// clicks.
///
/// `@MainActor` because `XCUIApplication()` is isolated to it under Swift 6.
@MainActor
final class FeedGalleryE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        // The single-shot specimen, not the full gallery: one unambiguous thing to click.
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

    /// One walk: each case costs a launch, and relaunching the same bundle id back to back is the
    /// flakiest moment in the run.
    func testAThumbnailOpensFullSizeAndCloses() {
        let thumbnail = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'feed-at-rest.png'"))
            .firstMatch
        XCTAssertTrue(thumbnail.waitForExistence(timeout: 20), "The gallery drew no thumbnail.")
        thumbnail.click()

        // Addressed by the WHOLE path, which is the one thing the lightbox says that the thumbnail
        // does not.
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

        // Escape cannot be checked by rendering: it depends on which view holds the responder
        // chain, and the deck answers for the lightbox because the lightbox is never focused.
        thumbnail.click()
        XCTAssertTrue(
            lit.waitForExistence(timeout: 10),
            "The thumbnail did not open a second time.",
        )
        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(
            lit.waitForNonExistence(timeout: 10),
            "The lightbox stayed up after Escape.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
