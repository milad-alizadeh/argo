import XCTest

/// The toolbar's New Session button, pressed the way a person presses it.
///
/// `NewSessionSpawnTests` can say that the action asks for a spawn and points the roster at what
/// comes back, but it builds `CockpitSpawn` by hand — nothing in it goes near a toolbar. A button
/// that never reached the bar, or one wired to a closure the view never calls, passes every line of
/// it. A click is the only thing that closes that gap, and this is the only target that can click.
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

    /// ONE test walking the whole thing, because each case here costs a launch and the walk is the
    /// claim: an empty cockpit, one press, a Session on the roster with the deck pointed at it.
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
        // The empty state going is the roster's own half of the same fact: a row drawn beside
        // "No Sessions yet" would be a list that had not noticed its own contents.
        XCTAssertFalse(empty.exists, "The roster still says it holds no Sessions.")
        // What "became the selection" means from outside: the deck has stopped saying it is
        // pointed at nothing. Read on the deck rather than on the row, because the row is a list
        // selection and the claim is about what the window is now showing.
        XCTAssertFalse(
            nothingSelected.exists,
            "The Session started but the deck is still pointed at nothing.",
        )
        // Liveness after the fact: a crash on click leaves every assertion above reading a window
        // that is already gone.
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// Addressed by the accessibility label the button already carries, so the test needs no
    /// identifier invented for its benefit — if that label goes, the test says so.
    ///
    /// Scoped to the WINDOW, not the app: the File menu carries an item under the same label by
    /// design (one verb, two routes), and an app-wide match resolves to the menu bar — where a
    /// click lands on nothing and the walk fails one assertion later, reading as a button that
    /// started no Session.
    private func newSessionButton() -> XCUIElement {
        let button = app.windows.firstMatch.descendants(matching: .any)["New Session"].firstMatch
        XCTAssertTrue(
            button.waitForExistence(timeout: 20),
            "The New Session button never appeared on the toolbar.",
        )
        return button
    }

    /// The deck's own words for a window pointed at no Session — the one label that says it, so
    /// its absence is a fact about the selection rather than about the roster.
    private var nothingSelected: XCUIElement {
        app.descendants(matching: .any)["No Session selected"].firstMatch
    }

    private var provisionalRow: XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", Self.provisionalTitle))
            .firstMatch
    }
}
