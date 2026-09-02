import XCTest

/// The one claim about the selected backlog row that no still frame can make: that the ground Argo
/// lays is what shows while the list IS first responder (#1071, amending D30).
///
/// Nothing else in this repo can ask it. A specimen render is of an app that is not the ACTIVE
/// one, and macOS draws its emphasised selection only in the key window of the active app —
/// measured, not assumed: on `ticketsRoom` the band reads the unemphasised `#464646` whether or
/// not `AXFocused` has been set on the backlog outline. The 2026-08-31 amendment recorded the same
/// wall from the `@FocusState` side. So the row is CLICKED here, which is the only route to the
/// state, and the band is measured off the row's own screenshot rather than read off the palette.
///
/// **Nothing is pinned to a hex.** A window capture is in the display's colour space — the same
/// ground reads `#3E9BFF` in the contract and `#5799F8` off a P3 capture — so the claims below are
/// relationships: the band is a saturated blue, and it does not change when focus leaves the list.
/// The second is the whole of the fix — the platform's own fill greys out there and this one does
/// not, for the reason the roster's quiet ground does not either.
///
/// `@MainActor` for the reason every case here carries it: `XCUIApplication()` is isolated to it
/// under Swift 6.
@MainActor
final class BacklogSelectionE2ETests: XCTestCase {
    private let app = XCUIApplication()
    /// How far the band's channels must spread for it to be the brand hue rather than one of the
    /// neutrals the platform fills a row with — `#464646` unemphasised, and the deck under it.
    private let chromatic = 0x40

    /// The room at rest, whose backlog opens with row 272 selected — `SpecimenRegistry.tickets`.
    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "ticketsRoom"]
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

    func testTheSelectedRowsBandIsTheLoudRungFirstResponderOrNot() throws {
        let row = try XCTUnwrap(backlogRow, "The backlog drew no row this case could address.")
        row.click()
        let emphasised = try XCTUnwrap(band(of: row), "No capture, list first responder.")
        assertLoud(emphasised, whileList: "is first responder")
        // Focus into the pane beside it. The platform greys its own fill here; this ground is the
        // row's own, so nothing about the band may change.
        app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)).click()
        let quiet = try XCTUnwrap(band(of: row), "No capture, focus elsewhere.")
        assertLoud(quiet, whileList: "is not first responder")
        XCTAssertEqual(
            emphasised, quiet,
            "The selected row's band changed when focus left the list — \(hex(emphasised)) to "
                + "\(hex(quiet)). This ground does not turn on first-responder status; a band that "
                + "moved is the platform's own fill showing through.",
        )
    }

    /// The row the specimen opens selected. Addressed by the number its announcement opens with,
    /// which is how a row speaks its id (`BacklogRow.announcement`).
    private var backlogRow: XCUIElement? {
        let row = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", "272"))
            .firstMatch
        return row.waitForExistence(timeout: 10) ? row : nil
    }

    /// The row's GROUND, as the most common colour in its own screenshot. A mode and not a sampled
    /// point: the ground is most of the row's area, where a point lands on a glyph, a chip or the
    /// blockage mark depending on which ticket the fixture put there.
    private func band(of row: XCUIElement) -> Int? {
        guard let image = row.screenshot().image
            .cgImage(forProposedRect: nil, context: nil, hints: nil),
            let data = image.dataProvider?.data as Data? else { return nil }
        let pixel = image.bitsPerPixel / 8
        var counts: [Int: Int] = [:]
        for y in 0 ..< image.height {
            for x in 0 ..< image.width {
                let at = y * image.bytesPerRow + x * pixel
                guard at + 2 < data.count else { continue }
                let colour = Int(data[at]) << 16 | Int(data[at + 1]) << 8 | Int(data[at + 2])
                counts[colour, default: 0] += 1
            }
        }
        return counts.max { $0.value < $1.value }?.key
    }

    private func assertLoud(_ band: Int, whileList state: String) {
        let channels = (0 ..< 3).map { band >> ((2 - $0) * 8) & 0xFF }
        let spread = (channels.max() ?? 0) - (channels.min() ?? 0)
        XCTAssertTrue(
            spread >= chromatic && channels[2] == channels.max(),
            "The selected backlog row's band read \(hex(band)) while the list \(state) — a "
                + "neutral, where the loud rung is a saturated blue. That is the platform's own "
                + "fill showing: #464646 repeated is its unemphasised one exactly.",
        )
    }

    private func hex(_ colour: Int) -> String {
        "#" + String(format: "%06X", colour)
    }
}
