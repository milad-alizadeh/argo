import XCTest

/// The click on the roster's archive foot, which nothing else here reaches: the foot's promise is
/// that its own ROW toggles, and a render can only show a state it was handed.
///
/// It opens on `archivedRoster` rather than `openArchivedRoster` for the reason `PlanPillE2ETests`
/// gives about `isRevealed`.
final class RosterArchiveE2ETests: RosterE2ECase {
    override var specimen: String {
        "archivedRoster"
    }

    func testClickingTheFootsLabelShowsTheArchivedSessions() {
        let foot = shutFoot()

        labelArea(of: foot).click()

        XCTAssertTrue(
            archivedRow.waitForExistence(timeout: 10),
            "Clicking the foot's label did not show the archived Sessions.",
        )
        XCTAssertTrue(
            expect("value == 'Expanded'", of: foot),
            "The foot still announced Collapsed.",
        )
    }

    func testClickingTheFootAgainHidesThem() {
        let foot = shutFoot()

        labelArea(of: foot).click()
        XCTAssertTrue(archivedRow.waitForExistence(timeout: 10), "The foot never opened.")
        labelArea(of: foot).click()

        XCTAssertTrue(
            expect("exists == false", of: archivedRow),
            "A second click did not shut the foot.",
        )
    }

    /// The foot as every case here starts: drawn, shut, and with nothing behind it on screen.
    private func shutFoot() -> XCUIElement {
        let foot = row(titled: "Archived")
        XCTAssertTrue(foot.waitForExistence(timeout: 20), "The roster drew no archive foot.")
        XCTAssertEqual(foot.value as? String, "Collapsed", "The foot did not open shut.")
        XCTAssertFalse(archivedRow.exists, "An archived Session was on screen behind a shut foot.")
        return foot
    }

    private var archivedRow: XCUIElement {
        row(titled: "Answer a question nobody is going to read")
    }
}
