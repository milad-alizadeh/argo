import XCTest

/// A reading sitting at its END, with the column re-laid out under it.
///
/// The end is the one place a row id cannot name: a reading that is following has no line to hold,
/// and a column re-wrapped at a new width puts the offset the end used to sit at somewhere in the
/// middle of it.
///
/// It launches with the panel already open, because the panel's seam is the only draggable one on a
/// specimen with no running subagents, and reaching it by clicking a row would first narrow the
/// column the scroll under test is measured in.
@MainActor
final class FeedEndE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedAtScaleEvidence"
    }

    /// `Newest` is on screen exactly while the reading has stopped following, so a control that
    /// comes back after a drag nobody scrolled during is the feed reporting it lost the end.
    func testTheEndOfTheReadingSurvivesASeamDrag() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        // The feed opens at the end, so this walks no distance at all on a working one — it reaches
        // the state by walking rather than by trusting the open.
        let newest = app.buttons["Newest"]
        walkToEnd()
        XCTAssertTrue(
            newest.waitForNonExistence(timeout: 10),
            "Never reached the end of the reading.",
        )

        drag(element(labelled: "Resize"))
        // Waited for rather than read once: the control is revealed by a scroll geometry change and
        // an animated transition, so a bare `exists` the instant the drag ended would pass.
        XCTAssertFalse(
            newest.waitForExistence(timeout: 5),
            "Dragging the seam left the reading short of the end it was sitting at.",
        )
        XCTAssertEqual(app.state, .runningForeground)
    }
}
