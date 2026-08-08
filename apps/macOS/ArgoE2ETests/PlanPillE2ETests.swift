import XCTest

/// The plan's list, opened by the keyboard.
///
/// Nothing else in this repo reaches it. It is not a row, so no projection test sees it; it is not
/// on screen at rest, so the pill's specimen renders it only because a specimen is allowed to force
/// it open. What stays unproven either way is that a reader can get there — and the ticket asks for
/// the keyboard specifically, because a surface openable only by hovering is one half the readers
/// never open.
///
/// The POINTER is deliberately not asserted here. `XCUIElement.hover()` warps the cursor without
/// producing the tracking-area crossing SwiftUI's `.onHover` answers to, so a hover assertion in
/// this target fails against a pill that opens perfectly by hand — a red test that proves nothing
/// is worse than none. Hover is covered by the `openPlanPill` render instead.
///
/// `@MainActor` for the reason the other cases carry it: driving a UI is main-actor work under
/// Swift 6 and `XCUIApplication()` is isolated to it.
@MainActor
final class PlanPillE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// How many stops the keyboard is given to reach the pill. A bound rather than a count: the
    /// deck's focusable rows come first and how many there are is the feed's business, not this
    /// test's.
    private let focusStops = 40

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        // The pill at REST — the specimen whose list is closed. The one with `isRevealed` set
        // would pass this suite without the gesture working at all.
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

    /// Tab until the list appears. The pill is focusable for exactly this — the reveal cannot
    /// belong to hover alone.
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
