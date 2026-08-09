import XCTest

/// The feed while the deck moves under it.
///
/// Every claim here is about what happens BETWEEN two layouts, which is why it cannot live in a
/// package test: the reader's place in a lazy stack is decided by estimated row heights, and the
/// bug this guards against is those estimates being thrown away by a remeasure. A projection has no
/// estimates, a specimen render has no second layout to compare against, and both pass while the
/// column goes blank on the machine (#473).
///
/// The two symptoms that are pure motion — prose shimmering under a held dragger, and a scroll that
/// hitches — have no assertion at all. They are a frame rate, and nothing XCUITest can see says
/// what one is. What is testable is the structural claim underneath them: the row the reader was on
/// is still the row on screen after the column has been re-laid out.
@MainActor
final class FeedMotionE2ETests: FeedE2ECase {
    /// A session at the length a real one reaches. At anything shorter the stack estimates nothing,
    /// so the place being held is a place that could not be lost.
    override var specimen: String {
        "feedAtScale"
    }

    /// One walk, for the reason the other suites here state: each case costs a launch, and
    /// relaunching the same bundle id back to back is the flakiest moment in the run.
    ///
    /// Every assertion after the first is the same question asked again: is the anchor row still on
    /// screen? Before the fix, opening the panel left the retained offset pointing past the end of
    /// the re-estimated content, and the answer was no.
    ///
    /// The seam it drags is the panel's. This specimen has no running subagents, so the rail — and
    /// the second seam with it — is not on screen to grab; both are the same `DeckSeam`.
    func testTheReaderKeepsTheirPlaceWhileTheColumnIsResized() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        let anchor = row(naming: "FeedView25.swift")
        scroll(until: anchor)
        XCTAssertTrue(anchor.isHittable, "Never reached the middle of the reading.")

        anchor.click()
        let panel = element(labelled: "Evidence")
        XCTAssertTrue(panel.waitForExistence(timeout: 10), "The row opened no panel.")
        XCTAssertTrue(
            anchor.isHittable,
            "Opening the panel took the reading away from the row it was opened from.",
        )

        drag(element(labelled: "Resize"))
        XCTAssertTrue(panel.exists, "The seam drag closed the panel.")
        XCTAssertTrue(anchor.isHittable, "Dragging the seam lost the reader's place.")

        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(panel.waitForNonExistence(timeout: 10), "The panel stayed up after Escape.")
        XCTAssertTrue(anchor.isHittable, "Closing the panel lost the reader's place.")
        XCTAssertEqual(app.state, .runningForeground)
    }
}
