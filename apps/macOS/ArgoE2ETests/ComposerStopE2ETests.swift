import XCTest

/// What Stop leaves behind at the real control (#541).
///
/// Here and nowhere else. `ComposerInterruptTests` proves what the draft does, and a package test
/// can neither press the button nor read the field back afterwards — which is exactly the seam the
/// bug lived in: the draft was right and the control under it was not.
///
/// `@MainActor` for the reason every case in this target carries it: `XCUIApplication()` is
/// isolated to it under Swift 6.
@MainActor
final class ComposerStopE2ETests: E2ECase {
    override var specimen: String {
        "composerStopping"
    }

    /// One launch for the whole gesture, in the order a reader meets it: queue a follow-up, type
    /// the next thing, stop the Turn — and then keep typing, which is the claim.
    func testStopKeepsTheFieldAndLeavesItTypeable() {
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

        XCTAssertTrue(
            settles(field, on: "no, not that file"),
            "Stop emptied the field: it reads \(read(field)).",
        )

        // The field is addressed afresh, because the placeholder it answers to changes with the
        // Turn ending — and the whole claim is that this is the same live field either way.
        let idle = app.textViews[Self.idle]
        XCTAssertTrue(idle.waitForExistence(timeout: 10), "The field went with the Turn.")
        idle.click()
        idle.typeText(" — the one under Sources")
        XCTAssertTrue(
            settles(idle, on: "no, not that file — the one under Sources"),
            "The field took no keystrokes after Stop: it reads \(read(idle)).",
        )
    }

    /// The field's own words, waited for rather than read once: a keystroke crosses AppKit, the
    /// draft and SwiftUI's next layout before the value here can change.
    private func settles(_ field: XCUIElement, on words: String) -> Bool {
        let reads = expectation(
            for: NSPredicate(format: "value == %@", words),
            evaluatedWith: field,
        )
        return XCTWaiter.wait(for: [reads], timeout: 10) == .completed
    }

    private func read(_ field: XCUIElement) -> String {
        String(describing: field.value)
    }

    /// What the field is called to a screen reader, which is what addresses it here: the composer
    /// sets the placeholder on the text view itself, and the placeholder is the Turn's own state.
    private static let running = "Queue a follow-up…"
    private static let idle = "Message Claude Code…"
}
