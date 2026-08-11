import XCTest

/// The click on the roster's archive foot. Nothing else in this repo reaches it: the whole point of
/// the foot is that its WHOLE ROW toggles, and a render can only ever show a state it was handed
/// (`docs/designs/cockpit-roster-archive-foot.md`).
///
/// It opens on `archivedRoster` and not on `openArchivedRoster`, for the reason `PlanPillE2ETests`
/// gives: the revealed specimen would pass with the control wired to nothing.
final class RosterArchiveE2ETests: RosterE2ECase {
    override var specimen: String {
        "archivedRoster"
    }

    func testClickingTheFootShowsTheArchivedSessionsAndClickingItAgainHidesThem() {
        let foot = row(titled: "Archived")
        XCTAssertTrue(foot.waitForExistence(timeout: 20), "The roster drew no archive foot.")
        XCTAssertEqual(foot.value as? String, "Collapsed", "The foot did not open shut.")

        let archivedRow = row(titled: "Answer a question nobody is going to read")
        XCTAssertFalse(archivedRow.exists, "An archived Session was on screen behind a shut foot.")

        // Away from the chevron: the claim is that the label's own row answers the click, and a
        // press on the mark would pass against the version this replaced.
        foot.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)).click()
        XCTAssertTrue(
            archivedRow.waitForExistence(timeout: 10),
            "Clicking the foot's label did not show the archived Sessions.",
        )
        XCTAssertTrue(
            expect("value == 'Expanded'", of: foot),
            "The foot still announced Collapsed.",
        )

        foot.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5)).click()
        XCTAssertTrue(
            expect("exists == false", of: archivedRow),
            "A second click did not shut the foot.",
        )
    }
}
