import XCTest

/// The deck, walked by Tab alone — #718's acceptance pass, as a test rather than a claim.
///
/// The cockpit's contract is that macOS's own keyboard navigation is what reaches a control, so
/// nothing in `ArgoUI` builds a focus order of its own. That makes this the only place the contract
/// can be checked: a package test can prove every control is a `Button`, and prove nothing at all
/// about whether Tab arrives at one. It is also the only place the SETTING is real — the walk below
/// is meaningless on a machine with keyboard navigation off, which is why it says so when it fails.
///
/// `@MainActor` for the reason the other cases here carry it: `XCUIApplication()` is isolated to it
/// under Swift 6.
@MainActor
final class DeckKeyboardE2ETests: XCTestCase {
    private let app = XCUIApplication()

    /// The one specimen with every named control on screen at once — see `SpecimenRegistry.deck`.
    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "keyboardDeck"]
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

    /// One walk for all six, because each case costs a launch.
    ///
    /// The feed is scrolled off its end FIRST: the way back to the newest line is absent while the
    /// reading is already there, and a control that is not on screen cannot be tabbed to.
    func testTabReachesEveryControlOnTheDeck() {
        raiseTheWayBackToTheNewestLine()

        var reached: Set<String> = []
        var ring: [String] = []
        for _ in 0 ..< Self.presses where reached.count < Self.wanted.count {
            app.typeKey(.tab, modifierFlags: [])
            guard let stop = focusedLabel else { continue }
            ring.append(stop)
            for (name, prefix) in Self.named where stop.hasPrefix(prefix) {
                reached.insert(name)
            }
        }

        let missed = Self.wanted.subtracting(reached).sorted()
        XCTAssertTrue(
            missed.isEmpty,
            """
            \(Self.presses) presses of Tab never reached: \(missed.joined(separator: ", ")).
            The ring, in the order it was walked: \(ring.joined(separator: " → ")).
            If the ring is EMPTY, check System Settings › Keyboard › Keyboard navigation — with it
            off no plain Button on macOS is a Tab stop, and this walk cannot mean anything.
            """,
        )
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// ⌘I, the one binding on this deck that does not wait on that setting at all (#718). Asserted
    /// on its own launch because the popover it opens would stand in the walk's way.
    func testCommandIOpensTheContextGuide() {
        // The panel's own label, which is the bare phrase — the mark that opens it wears the same
        // words plus its key, so an exact match finds the panel and only the panel.
        let guide = element(labelled: "About the context reading")
        XCTAssertFalse(guide.exists, "The context guide was up before anything asked for it.")

        app.typeKey("i", modifierFlags: .command)
        XCTAssertTrue(guide.waitForExistence(timeout: 10), "⌘I opened no context guide.")

        app.typeKey(.escape, modifierFlags: [])
        XCTAssertTrue(guide.waitForNonExistence(timeout: 10), "The guide stayed up after Escape.")
    }

    /// Far enough up that the feed has stopped following, which is the whole of what puts the way
    /// back on screen. In screenfuls for the reason `FeedE2ECase.scroll` gives: the reading is
    /// lazy, so one large delta lands past its target on estimated heights.
    private func raiseTheWayBackToTheNewestLine() {
        let feed = element(labelled: "Feed")
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")
        let newest = app.buttons["Newest"]
        for _ in 0 ..< 10 where !newest.exists {
            feed.scroll(byDeltaX: 0, deltaY: 600)
        }
        XCTAssertTrue(
            newest.waitForExistence(timeout: 10),
            "Scrolling off the end offered no way back to the newest line.",
        )
    }

    /// Whatever the keyboard is on right now, asked of the app rather than of a held element:
    /// focus moving is what makes a held one stale, and a stale one answers for where it used to
    /// be. `hasKeyboardFocus` is a snapshot attribute here — queryable, though XCTest exposes no
    /// Swift property for it on macOS.
    private var focusedLabel: String? {
        let focused = app.descendants(matching: .any)
            .matching(NSPredicate(format: "hasKeyboardFocus == true"))
            .firstMatch
        guard focused.exists else { return nil }
        let label = focused.label
        return label.isEmpty ? nil : label
    }

    private func element(labelled label: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    /// Generous: the deck's ring also holds the rail, the zones and whatever the composer's own
    /// field contains, and the walk is cheap next to the launch it rides on.
    private static let presses = 40

    /// What each stop is called here, and the start of the label it wears on screen. The composer's
    /// focusable field wears its placeholder — "Composer" labels the zone around it.
    private static let named = [
        ("the composer", "Message Claude Code…"),
        ("the mode picker", "Mode,"),
        ("Send", "Send"),
        ("the feed's tail button", "Newest"),
        ("the ⓘ", "About the context reading"),
        ("Hand off", "Hand off"),
    ]

    private static let wanted = Set(named.map(\.0))
}
