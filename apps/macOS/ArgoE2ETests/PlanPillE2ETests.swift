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
        XCTAssertTrue(pill.waitForExistence(timeout: 20), "The deck drew no plan pill.")

        // A step that is NOT the current one: the pill's own line already names the current step,
        // so finding that would prove the list open when only the pill is.
        let pending = labelled("Wire the pill above the dock, pending")
        XCTAssertFalse(pending.exists, "The list was open before anything reached the pill.")

        XCTAssertTrue(tabbedToThePill(), "The keyboard never reached the pill.")

        // Space and not Tab: the pill is a Button, and focus alone opens nothing — the list stands
        // over the middle of the reading, so arriving at the pill must not put it there.
        app.typeText(" ")
        XCTAssertTrue(
            pending.waitForExistence(timeout: 10),
            "The pill held the keyboard but did not open its list.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// Tab until the pill holds the keyboard. A bound rather than a count — see `focusStops`.
    private func tabbedToThePill() -> Bool {
        for _ in 0 ..< focusStops {
            app.typeKey(.tab, modifierFlags: [])
            if focusedPill.exists {
                return true
            }
        }
        return false
    }

    /// The label the pill wears, named once: the focused query below is this one plus a conjunct.
    private static let pillLabel = "Plan"

    /// A fresh query each time: focus is what is being asked about, and a stale snapshot answers
    /// for whichever pass took it.
    private var pill: XCUIElement {
        matching("label == %@", Self.pillLabel)
    }

    /// The same pill, once the keyboard is on it. In the predicate rather than off the element:
    /// `hasKeyboardFocus` is a runtime attribute here, with no Swift property on this platform.
    private var focusedPill: XCUIElement {
        matching("label == %@ AND hasKeyboardFocus == true", Self.pillLabel)
    }

    private func matching(_ format: String, _ label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: format, label))
            .firstMatch
    }

    private func labelled(_ label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label CONTAINS %@", label))
            .firstMatch
    }
}
