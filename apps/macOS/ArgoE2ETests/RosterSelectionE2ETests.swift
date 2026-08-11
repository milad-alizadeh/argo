import XCTest

/// Clicking a roster row, which is a claim only a click can make.
///
/// The row's title carried a SwiftUI double-click for renaming, and a tap gesture on a subview of a
/// `List` row hit-tests ahead of the row and swallows the click the `List` needed to select with —
/// so most of the roster stopped selecting, because the title is most of the row.
@MainActor
final class RosterSelectionE2ETests: RosterE2ECase {
    /// The second row of `RosterSpecimen`, which the shell does NOT open on — so a row that reads
    /// as selected can only have been selected by this test.
    private static let target = "Port the session engine core to Swift"

    override var specimen: String {
        "roster"
    }

    func testAClickOnATitleSelectsItsRow() {
        let row = row(titled: Self.target)
        XCTAssertTrue(row.waitForExistence(timeout: 20), "The sidebar drew no roster.")
        XCTAssertFalse(cell.isSelected, "The shell already opened on the row this test clicks.")

        titleArea(of: row).click()

        XCTAssertTrue(
            expect("isSelected == true", of: cell),
            "Clicking a row's title selected nothing.",
        )
    }

    func testOneClickLeavesTheNameAlone() {
        let row = row(titled: Self.target)
        XCTAssertTrue(row.waitForExistence(timeout: 20), "The sidebar drew no roster.")

        titleArea(of: row).click()

        // The gesture that opens the name is TWO clicks. A single one that opened it would take
        // the cursor off every row anybody selected.
        XCTAssertFalse(
            nameField.waitForExistence(timeout: 3),
            "One click opened the name field.",
        )
    }

    func testADoubleClickOnATitleOpensTheNameForTyping() {
        let row = row(titled: Self.target)
        XCTAssertTrue(row.waitForExistence(timeout: 20), "The sidebar drew no roster.")

        titleArea(of: row).doubleClick()

        XCTAssertTrue(
            nameField.waitForExistence(timeout: 5),
            "Double-clicking the title opened no name field.",
        )
        // Typed into rather than merely opened: a field that appears without keyboard focus takes
        // no name, and that failure is invisible to anything that only asked whether it was there.
        nameField.typeText("renamed by the test")
        nameField.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(
            expect("exists == false", of: nameField),
            "Return left the name field open.",
        )
    }

    /// The menu is the only home story 20's Reset has, and it sits UNDER the clear layer that
    /// answers the double-click — a layer that took right-click too would take the Reset with it.
    func testTheRowsMenuIsStillReachableUnderTheClickLayer() {
        let row = row(titled: Self.target)
        XCTAssertTrue(row.waitForExistence(timeout: 20), "The sidebar drew no roster.")

        titleArea(of: row).rightClick()

        XCTAssertTrue(
            app.menuItems["Copy Session title"].waitForExistence(timeout: 5),
            "Right-clicking a row's title opened no menu.",
        )
    }

    private var cell: XCUIElement {
        cell(titled: Self.target)
    }

    private var nameField: XCUIElement {
        app.textFields[SessionRenameStrings.prompt]
    }
}

/// The strings the rename field is addressed by, kept here rather than typed into each case: the
/// app's own `SessionRenameProjection` is not visible to this target.
enum SessionRenameStrings {
    static let prompt = "Session name"
}
