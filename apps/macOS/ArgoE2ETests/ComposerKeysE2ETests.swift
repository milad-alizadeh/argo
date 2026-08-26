import XCTest

/// What Return and Shift-Return do at the composer (#734).
///
/// Here and nowhere else: `ComposerKeyIntentTests` proves the rule, and a package test can neither
/// press a key at a control nor read a caret back.
///
/// `@MainActor` for the reason every case here carries it: `XCUIApplication()` is isolated to it
/// under Swift 6.
@MainActor
final class ComposerKeysE2ETests: XCTestCase {
    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        // The vessel's OWN specimen, not the deck-composed one: a deck specimen wires
        // `DeckIntents.inert`, whose draft is a constant binding, so nothing a send does to the
        // draft can appear there. This entry holds its draft as state, as the shell does.
        app.launchArguments += ["--specimen", "composerTyping"]
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

    /// One launch for both keys, in the order a reader meets them — a launch each is the whole cost
    /// of a case here, and `DeckKeyboardE2ETests` walks six controls in one for the same reason.
    func testTheFieldTakesASecondLineAndSendsOnReturn() {
        let field = app.textViews[Self.placeholder]
        XCTAssertTrue(field.waitForExistence(timeout: 20), "The composer drew no field.")
        field.click()

        // Over the specimen's own draft, so the words asserted on are this test's: the entry opens
        // holding a multi-line message, which is the state it exists to render.
        app.typeKey("a", modifierFlags: .command)
        field.typeText("first")
        app.typeKey(.return, modifierFlags: .shift)
        field.typeText("second")
        XCTAssertTrue(
            settles(field, on: "first\nsecond"),
            "Shift-Return did not break the line: the field reads \(read(field)).",
        )

        app.typeKey(.return, modifierFlags: [])
        XCTAssertTrue(
            settles(field, on: ""),
            "A bare Return left the words in the field rather than sending: it reads \(read(field)).",
        )
    }

    /// The field's own words, waited for rather than read once: a keystroke crosses AppKit, the
    /// draft and SwiftUI's next layout before the value here can change, so an assertion made the
    /// instant `typeKey` returns is a race the field usually loses.
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

    /// What the field is called to a screen reader, which is what addresses it here rather than
    /// `textViews.firstMatch` — the label the composer sets on the text view itself.
    private static let placeholder = "Message Claude Code…"
}
