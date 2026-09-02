import XCTest

/// The click on a Fold row, which is the claim a package test cannot make: it builds a projection
/// and cannot ask the `List` which row IT thinks is selected.
///
/// A Fold is opened, never selected. `ForEach` tags a row with its `Identifiable` id whether or not
/// `.tag` is written, so a fold was selectable while nothing drew a ground on it — the platform's
/// `AccentColor` fill on one row and Argo's ground on another.
final class RosterFoldE2ETests: RosterE2ECase {
    /// `foldedRoster` opens with `steered-0` selected and its fold shut, so a fold that reads as
    /// selected here can only have been selected by this test's own click.
    override var specimen: String {
        "foldedRoster"
    }

    private static let fold = "180 runs"
    private static let run = "Write a caption for the prototype in folder 0"

    func testAClickOnAFoldSelectsNothing() {
        let fold = shutFold()

        labelArea(of: fold).click()

        XCTAssertTrue(
            row(titled: Self.run).waitForExistence(timeout: 10),
            "Clicking the fold did not open it.",
        )
        XCTAssertFalse(
            cell(titled: Self.fold).isSelected,
            "The List selected the fold row, which draws no ground and stands for no Session.",
        )
    }

    /// The other half of the same state: the ground the specimen fixes on `steered-0` is still the
    /// only selected row after the fold has been clicked.
    func testTheSessionSelectedBeforeTheClickIsStillTheSelectedOne() {
        let fold = shutFold()
        let steered = cell(titled: "/implement 852")
        XCTAssertTrue(steered.isSelected, "The specimen did not open with its Session selected.")

        labelArea(of: fold).click()

        XCTAssertTrue(steered.isSelected, "Clicking the fold took the selection off the Session.")
    }

    /// The fold as every case here starts: drawn, shut, and unselected.
    private func shutFold() -> XCUIElement {
        let fold = row(titled: Self.fold)
        XCTAssertTrue(fold.waitForExistence(timeout: 20), "The roster drew no fold.")
        XCTAssertFalse(row(titled: Self.run).exists, "A run was on screen under a shut fold.")
        XCTAssertFalse(cell(titled: Self.fold).isSelected, "The fold opened already selected.")
        return fold
    }
}
