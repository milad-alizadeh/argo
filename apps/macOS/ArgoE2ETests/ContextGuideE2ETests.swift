import XCTest

/// The ⓘ panel, opened the way a person opens it.
///
/// Every rule the instrument carries is asserted in `SessionHeaderContextTests`, which is where a
/// rule belongs — but none of those tests can click, and the panel is a POPOVER: its own window,
/// its own environment, and the exact place a view that renders perfectly in a specimen comes
/// apart. That has already happened once here, to the Project drawer. This is the only target that
/// can catch it.
///
/// `@MainActor` for the reason every case here carries it: driving a UI is main-actor work under
/// Swift 6, and `XCUIApplication()` is isolated to it.
@MainActor
final class ContextGuideE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        // Onto the specimen, never the machine's own registry: against a real one this asserts
        // whatever Sessions that Mac happens to have, and on a clean machine there is no header at
        // all to find an ⓘ on.
        app.launchArguments += ["--specimen", "sessionHeader"]
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

    /// ONE test walking the whole gesture rather than one per assertion — each case here costs a
    /// launch, and relaunching the same bundle id is the flakiest moment in the run.
    func testTheGuideOpensOnClickAndCloseOnEscape() {
        let about = app.descendants(matching: .any)["About the context reading"].firstMatch
        XCTAssertTrue(
            about.waitForExistence(timeout: 20),
            "The header drew no ⓘ — or the zone combined its children and swallowed it.",
        )
        about.click()

        let line = app.staticTexts["handing off is worth doing"]
        XCTAssertTrue(
            line.waitForExistence(timeout: 10),
            "The panel is empty — its body came apart inside the popover, or the app went down.",
        )
        XCTAssertTrue(app.staticTexts["handing off is overdue"].exists)
        // Liveness after the fact, not only at launch: a crash on click leaves the assertion above
        // passing against a window that is already gone.
        XCTAssertEqual(app.state, .runningForeground)

        // Story 42 — that the panel explains rather than repeats — is asserted where the panel's
        // words are decided, in `SessionHeaderContextTests`. From out here the reading behind the
        // popover and a reading inside it are the same query, so a check here would pass on both.

        // Escape, which is the popover's own dismissal and the half of story 41 a render cannot
        // show. Typed at the app rather than at the panel: the popover holds key, and addressing
        // the element would send the key somewhere the panel is not.
        app.typeKey(.escape, modifierFlags: [])
        XCTAssertFalse(
            line.waitForExistence(timeout: 3),
            "Escape did not dismiss the panel.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
