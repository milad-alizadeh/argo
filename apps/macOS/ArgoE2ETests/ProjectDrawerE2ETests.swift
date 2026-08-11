import XCTest

/// The drawer, driven the way a person drives it.
///
/// Every other test in this repo is a package test: it cannot launch the app and cannot click, so
/// a view that renders correctly in a specimen and comes apart inside a popover passes all of
/// them. This is the only target that can click.
/// `@MainActor` on the whole case: driving a UI is main-actor work under Swift 6, and
/// `XCUIApplication()` is isolated to it — a stored default in a nonisolated class does not
/// compile. The async `setUp`/`tearDown` overrides are what let an isolated case override
/// XCTest's own nonisolated ones.
@MainActor
final class ProjectDrawerE2ETests: XCTestCase {
    /// `XCUIApplication()` only describes the app — nothing launches until `launch()`.
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        // A crashed app fails the test it crashed in, rather than every one after it.
        continueAfterFailure = false
        // Launch onto the specimen's fixtures, NOT the machine's registry: against a real
        // registry this asserts whatever that Mac happens to have registered — it passed on one
        // with three Projects and failed on a clean one, where no row had a menu to find.
        app.launchArguments += ["--specimen", "toolbarScope"]
        app.launch()
        // Launch failures report as launch failures. Without this, an app that never came up
        // addressable fails later as "the scope vessel never appeared", which reads as a missing
        // view rather than a missing app.
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    /// ONE test walking the whole flow, rather than one per assertion.
    ///
    /// Each test case here costs a launch, and a terminate-then-relaunch of the same bundle id is
    /// the flakiest moment in the run: on a CI runner the second app came up without an
    /// addressable accessibility tree.
    func testTheDrawerOpensAndCarriesItsVerbs() throws {
        try scopeVessel().click()

        XCTAssertTrue(
            app.staticTexts["Projects · registered on this Mac"].waitForExistence(timeout: 10),
            "The drawer did not appear — the popover is empty, or the app went down opening it.",
        )
        // Liveness after the fact, not just at launch: a crash on click leaves the assertion above
        // passing against a window that is already gone.
        XCTAssertEqual(app.state, .runningForeground)

        // The per-Project menu is a `Menu` inside a popover — two presentations deep, which is
        // where AppKit and SwiftUI disagree most often, and where a row that combined its own
        // accessibility children swallowed this outright.
        let menu = app.descendants(matching: .any)["Manage this Project"].firstMatch
        XCTAssertTrue(menu.waitForExistence(timeout: 10), "No row carried its management menu.")
        menu.click()

        for verb in ["Reveal in Finder", "Locate…", "Remove from Argo"] {
            XCTAssertTrue(
                app.menuItems[verb].waitForExistence(timeout: 10),
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
