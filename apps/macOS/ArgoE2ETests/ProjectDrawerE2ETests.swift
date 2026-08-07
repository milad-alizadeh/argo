import XCTest

/// The drawer, driven the way a person drives it.
///
/// Every other test in this repo is a package test: it can build a projection and assert on it,
/// but it cannot launch the app, and it cannot click. So a view that renders correctly in a
/// specimen and comes apart inside a popover passes all of them — which is exactly what happened.
/// A click is the only thing that catches that, and this is the only target that can click.
/// `@MainActor` on the whole case: driving a UI is main-actor work under Swift 6, and
/// `XCUIApplication()` is isolated to it — a stored default in a nonisolated class does not
/// compile. The async `setUp`/`tearDown` overrides are what let an isolated case override
/// XCTest's own nonisolated ones.
@MainActor
final class ProjectDrawerE2ETests: XCTestCase {
    /// Built at init rather than in `setUp`, so it needs no implicit unwrap. `XCUIApplication()`
    /// only describes the app — nothing launches until `launch()`.
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        // A crashed app fails the test it crashed in, rather than every one after it.
        continueAfterFailure = false
        app.launch()
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    /// The regression this target exists for. Opening the drawer took the app down while every
    /// package test and every specimen render stayed green.
    func testOpeningTheProjectDrawerDoesNotCrash() throws {
        let vessel = try scopeVessel()
        vessel.click()

        XCTAssertTrue(
            app.staticTexts["Projects · registered on this Mac"].waitForExistence(timeout: 5),
            "The drawer did not appear — the popover is empty, or the app went down opening it.",
        )
        // Liveness after the fact, not just at launch: a crash on click leaves the assertion above
        // passing against a window that is already gone.
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// The per-Project menu is a `Menu` inside a popover — two presentations deep, which is where
    /// AppKit and SwiftUI disagree most often.
    func testTheRowMenuOffersExactlyTheThreeVerbs() throws {
        try scopeVessel().click()
        XCTAssertTrue(
            app.staticTexts["Projects · registered on this Mac"].waitForExistence(timeout: 5),
        )

        let menu = app.descendants(matching: .any)["Manage this Project"].firstMatch
        XCTAssertTrue(menu.waitForExistence(timeout: 5), "No row carried its management menu.")
        menu.click()

        for verb in ["Reveal in Finder", "Locate…", "Remove from Argo"] {
            XCTAssertTrue(
                app.menuItems[verb].waitForExistence(timeout: 5),
                "The row menu is missing \(verb).",
            )
        }
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// The scope vessel is addressed by the accessibility label the view already carries, so the
    /// test needs no identifier invented for its benefit — if that label goes, the test says so.
    private func scopeVessel() throws -> XCUIElement {
        let vessel = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'Project, '"))
            .firstMatch
        XCTAssertTrue(vessel.waitForExistence(timeout: 20), "The scope vessel never appeared.")
        return vessel
    }
}
