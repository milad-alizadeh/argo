import XCTest

/// The Project menu, driven the way a person drives it.
///
/// Every other test in this repo is a package test: it cannot launch the app and cannot click, so a
/// menu that assembles fine as a value and comes apart as AppKit items passes all of them. This is
/// the only target that can click — and since #875 it is the ONLY thing that can see this control
/// open at all, because a native menu draws in a window of the system's and no specimen render
/// contains one.
/// `@MainActor` on the whole case: driving a UI is main-actor work under Swift 6, and
/// `XCUIApplication()` is isolated to it — a stored default in a nonisolated class does not
/// compile. The async `setUp`/`tearDown` overrides are what let an isolated case override
/// XCTest's own nonisolated ones.
@MainActor
final class ProjectMenuE2ETests: XCTestCase {
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
    func testTheMenuOpensAndCarriesItsVerbs() throws {
        try scopeVessel().click()

        // The switch itself: the fixture's Projects are the menu's own items, drawn by AppKit.
        XCTAssertTrue(
            app.menuItems["Add Project…"].waitForExistence(timeout: 10),
            "The Project menu did not appear, or the app went down opening it.",
        )
        // Liveness after the fact, not just at launch: a crash on click leaves the assertion above
        // passing against a window that is already gone.
        XCTAssertEqual(app.state, .runningForeground)

        // The verbs are one submenu deep, which is where AppKit and SwiftUI disagree most often.
        let manage = app.menuItems["Manage"].firstMatch
        XCTAssertTrue(manage.waitForExistence(timeout: 10), "The menu carries no Manage branch.")
        manage.hover()

        let project = app.menuItems.matching(NSPredicate(format: "label BEGINSWITH 'argo'"))
            .firstMatch
        XCTAssertTrue(project.waitForExistence(timeout: 10), "Manage lists no Project.")
        project.hover()

        for verb in ["Reveal in Finder", "Remove from Argo"] {
            XCTAssertTrue(
                app.menuItems[verb].waitForExistence(timeout: 10),
                "The Project's verbs are missing \(verb).",
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
