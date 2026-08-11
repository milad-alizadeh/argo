import XCTest

/// The toolbar's New Session button, pressed the way a person presses it.
///
/// It launches onto `spawningRoster`, never the machine's own registry: the state under test has to
/// come from the test, and a real launch would start a real agent on whatever Mac is running this.
@MainActor
final class NewSessionE2ETests: XCTestCase {
    /// The row the spawn publishes, titled the way `AgentSpawn` titles a Session whose CLI has not
    /// written a record yet.
    private static let provisionalTitle = "New session"

    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "spawningRoster"]
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

    /// ONE test walking the whole thing, because each case here costs a launch.
    func testPressingNewSessionPutsASessionOnTheRosterAndPointsThere() {
        let empty = app.staticTexts["No Sessions yet"]
        XCTAssertTrue(empty.waitForExistence(timeout: 20), "The roster did not open empty.")
        XCTAssertTrue(
            nothingSelected.exists,
            "The deck was already pointed at something before anything started.",
        )

        let button = newSessionButton()
        XCTAssertTrue(button.isEnabled, "The button is disabled over a Project it can spawn in.")
        button.click()

        XCTAssertTrue(
            provisionalRow.waitForExistence(timeout: 20),
            "Pressing New Session put nothing on the roster.",
        )
        XCTAssertFalse(empty.exists, "The roster still says it holds no Sessions.")
        // Read on the deck rather than on the row: the claim is about what the window is showing.
        XCTAssertFalse(
            nothingSelected.exists,
            "The Session started but the deck is still pointed at nothing.",
        )
        // Liveness after the fact: a crash on click leaves every assertion above reading a window
        // that is already gone.
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// Addressed by the accessibility label the button already carries, so a label change fails
    /// here.
    ///
    /// Scoped to the WINDOW, not the app: the File menu carries an item under the same label, and
    /// an app-wide match resolves to the menu bar, where a click lands on nothing.
    private func newSessionButton() -> XCUIElement {
        let button = app.windows.firstMatch.descendants(matching: .any)["New Session"].firstMatch
        XCTAssertTrue(
            button.waitForExistence(timeout: 20),
            "The New Session button never appeared on the toolbar.",
        )
        return button
    }

    /// The deck's own words for a window pointed at no Session — the one label that says it.
    private var nothingSelected: XCUIElement {
        app.descendants(matching: .any)["No Session selected"].firstMatch
    }

    private var provisionalRow: XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", Self.provisionalTitle))
            .firstMatch
    }
}
