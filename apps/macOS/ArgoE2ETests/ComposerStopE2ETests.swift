import XCTest

/// What Stop takes and what it leaves, at the real control (#541).
///
/// Here and nowhere else. `ComposerInterruptTests` proves what the draft does, and a package test
/// can neither press the button nor read the field back afterwards — which is the seam this lived
/// in: the draft was right and the control under it was not.
///
/// **What it does NOT cover.** `ComposerStoppingSpecimen` turns `isRunning` off at the click, so
/// the Session's own status is never in play here. #1189's other two faults — the control stuck on
/// the Stop square, and the field taking no keys afterwards — are both faults in that status and in
/// the shell around it, and neither can reproduce against this entry. A green run here says the
/// composer's own seam is sound, and says nothing at all about those.
///
/// `@MainActor` for the reason every case in this target carries it: `XCUIApplication()` is
/// isolated to it under Swift 6.
@MainActor
final class ComposerStopE2ETests: E2ECase {
    override var specimen: String {
        "composerStopping"
    }

    /// One launch for the whole gesture, in the order a reader meets it: queue a follow-up, type
    /// the next thing, stop the Turn. A launch is the whole cost of a case in this target, which is
    /// why the steps up to the claim are not cases of their own.
    func testStopLeavesTheWordsInTheField() {
        let field = app.textViews[Self.running]
        XCTAssertTrue(field.waitForExistence(timeout: 20), "The composer drew no field.")
        field.click()

        field.typeText("open the PR when you are done")
        app.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(settles(field, on: ""), "Return left the follow-up in the field.")

        field.typeText("no, not that file")
        XCTAssertTrue(
            settles(field, on: "no, not that file"),
            "The field did not take the second message: it reads \(read(field)).",
        )

        let stop = app.buttons["Stop"]
        XCTAssertTrue(stop.waitForExistence(timeout: 10), "The composer drew no Stop control.")
        stop.click()

        // Addressed afresh, because the placeholder the field answers to changes with the Turn
        // ending — and that it is the SAME live field either way is half of what is being claimed.
        let idle = app.textViews[Self.idle]
        XCTAssertTrue(idle.waitForExistence(timeout: 10), "The field went with the Turn.")
        XCTAssertTrue(
            settles(idle, on: "no, not that file"),
            "Stop emptied the field: it reads \(read(idle)).",
        )
    }

    /// What the field is called to a screen reader, which is what addresses it here: the composer
    /// sets the placeholder on the text view itself, and the placeholder is the Turn's own state.
    private static let running = "Queue a follow-up…"
    private static let idle = "Message Claude Code…"
}
