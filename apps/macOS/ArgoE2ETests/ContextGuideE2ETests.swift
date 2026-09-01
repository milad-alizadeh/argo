import XCTest

/// The ⓘ panel, opened from the mark and dismissed with Escape.
///
/// Every rule the instrument carries is asserted in `SessionHeaderContextTests`, but none of those
/// tests can click, and the panel is a POPOVER: its own window, its own environment, and the exact
/// place a view that renders perfectly in a specimen comes apart. This is the only target that can
/// catch it.
///
/// HOVER is not asserted here: this suite has no hover, per `docs/agents/visual-verification.md`.
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
        app.launchArguments += ["--specimen", "tabLineInstruments"]
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
    func testTheGuideOpensOnTheMarkAndClosesOnEscape() {
        // On the PREFIX: the mark's label carries its key ("— Command I", #718), and the panel it
        // opens wears the bare phrase — an exact match here finds the panel and never the mark.
        let about = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'About the context reading —'"))
            .firstMatch
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

        // A second click leaves the panel UP: the control opens rather than toggling. Asserted as
        // a NON-disappearance, because the panel is already there and an existence wait would pass
        // on its first evaluation whatever the click did.
        about.click()
        XCTAssertFalse(
            line.waitForNonExistence(timeout: 3),
            "Clicking the mark again closed the panel it had just opened.",
        )

        // Story 42 — that the panel explains rather than repeats — is asserted in
        // `SessionHeaderContextTests`: from out here a check would pass on both readings.

        // Escape, which is the popover's own dismissal and the half of story 41 a render cannot
        // show. Typed at the app rather than at the panel: the popover holds key, and addressing
        // the element would send the key somewhere the panel is not.
        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(
            line.waitForNonExistence(timeout: 10),
            "Escape did not dismiss the panel.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
