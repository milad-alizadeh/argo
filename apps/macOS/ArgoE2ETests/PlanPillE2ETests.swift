import XCTest

/// The plan's list, opened by the keyboard. Nothing else in this repo reaches it.
///
/// The POINTER is deliberately not asserted here: `XCUIElement.hover()` warps the cursor without
/// producing the tracking-area crossing SwiftUI's `.onHover` answers to, so a hover assertion fails
/// against a pill that opens perfectly by hand. Hover is covered by the `openPlanPill` render.
///
/// `@MainActor` because `XCUIApplication()` is isolated to it under Swift 6.
@MainActor
final class PlanPillE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// How many stops the keyboard is given to reach the pill. A bound, not a count: the deck's
    /// focusable rows come first and how many there are is the feed's business.
    private let focusStops = 40

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        // The pill at REST: the `isRevealed` specimen would pass without the gesture working.
        app.launchArguments += ["--specimen", "planPill"]
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

    func testTheKeyboardReachesThePillAndOpensItsList() {
        let pill = labelled("Plan")
        XCTAssertTrue(pill.waitForExistence(timeout: 20), "The deck drew no plan pill.")

        // A step that is NOT the current one: the pill's own line already names the current step,
        // so finding that would prove the list open when only the pill is.
        let pending = labelled("Wire the pill above the dock, pending")
        XCTAssertFalse(pending.exists, "The list was open before anything reached the pill.")

        XCTAssertTrue(tabbedToTheList(pending), "The keyboard never reached the pill.")
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// Tab until the list appears. The pill is focusable so the reveal cannot belong to hover
    /// alone.
    private func tabbedToTheList(_ pending: XCUIElement) -> Bool {
        for _ in 0 ..< focusStops {
            app.typeKey(.tab, modifierFlags: [])
            if pending.exists {
                return true
            }
        }
        return false
    }

    private func labelled(_ label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", label))
            .firstMatch
    }
}
