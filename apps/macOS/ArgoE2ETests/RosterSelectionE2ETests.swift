import XCTest

/// Clicking a roster row, which is a claim only a click can make.
///
/// The row's title carried a SwiftUI double-click for renaming, and a SwiftUI tap on a subview of a
/// `List` row hit-tests ahead of the row and swallows the click the `List` needed to select with —
/// so most of the roster stopped selecting, because the title is most of the row. Nothing else here
/// could have caught it: the projection has no pointer, and a still render of a selected row is a
/// render of the state that never arrived.
///
/// Both gestures on one launch, in the order a person meets them: one click selects, two open the
/// name for typing. A rename that works while selection does not is the bug that shipped.
@MainActor
final class RosterSelectionE2ETests: XCTestCase {
    /// The second row of `RosterSpecimen`, which the shell does NOT open on — so an assertion that
    /// the header names it can only be true because this test clicked it.
    private static let target = "Port the session engine core to Swift"

    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "roster"]
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

    func testARowSelectsOnOneClickOfItsTitleAndOpensItsNameOnTwo() {
        let row = row(titled: Self.target)
        XCTAssertTrue(row.waitForExistence(timeout: 20), "The sidebar drew no roster.")
        XCTAssertFalse(cell.isSelected, "The shell already opened on the row this test clicks.")

        // On the TITLE and not on the row's empty right-hand end: the title is the half that
        // carried the gesture, and a click anywhere else would pass whether or not it was fixed.
        title(of: row).click()
        XCTAssertTrue(
            poll { cell.isSelected },
            "Clicking a row's title selected nothing.",
        )

        // The same spot again, twice: the rename has to survive being made to share the click.
        title(of: row).doubleClick()
        let field = app.textFields["Session name"]
        XCTAssertTrue(
            field.waitForExistence(timeout: 5),
            "Double-clicking the title opened no name field.",
        )

        // Typed into rather than merely opened: a field that appears without keyboard focus takes
        // no name, which is what shipped — and the failure is invisible to anything that only
        // asked whether the field was there.
        field.typeText("renamed by the test")
        field.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(poll { !field.exists }, "Return left the name field open.")
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// The list cell AROUND the row's content, which is where the selection is reported: the
    /// element the row's own announcement labels is the content inside it, and content does not
    /// know whether it was picked.
    private var cell: XCUIElement {
        app.cells
            .containing(NSPredicate(format: "label BEGINSWITH %@", Self.target))
            .firstMatch
    }

    /// The leading third of the row — over the title, clear of the state word on the trailing edge.
    private func title(of row: XCUIElement) -> XCUICoordinate {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.35))
    }

    /// Polled rather than `waitForExistence`, because what is being waited for is a change of STATE
    /// on an element that already exists, which no existence expectation can ask about.
    private func poll(until condition: () -> Bool) -> Bool {
        for _ in 0 ..< 50 {
            if condition() {
                return true
            }
            Thread.sleep(forTimeInterval: 0.2)
        }
        return false
    }

    private func row(titled title: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }
}
