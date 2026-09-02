import XCTest

/// The one claim about the selected backlog row that no still frame can make: that the ground Argo
/// lays is what shows while the list IS first responder, and the same ground once focus has left it
/// (#1071, amending D30).
///
/// Nothing else in this repo can ask it. A specimen render is of an app that is not the ACTIVE one,
/// and macOS draws emphasised selection only in the key window of the active app — measured, not
/// assumed: on `ticketsRoom` the band reads the unemphasised `#464646` with `AXFocused` set on the
/// backlog outline exactly as it does without it. The 2026-08-31 amendment hit the same wall from
/// the `@FocusState` side. So the row is CLICKED here, which is the only route to the state, and
/// what it draws is measured off its own screenshot rather than read off the palette.
///
/// **Nothing is pinned to a hex.** A window capture is in the display's colour space — the same
/// ground reads `#3E9BFF` in the contract and `#5799F8` off a P3 capture — so every claim below is
/// a relationship: the band is a saturated blue, the ink on it is far darker than the band, and
/// neither moves when focus leaves the list. That last one is the whole of the fix, because the
/// platform's own fill greys out there and this ground does not.
@MainActor
final class BacklogSelectionE2ETests: E2ECase {
    /// The room at rest, whose backlog opens with row 272 selected — `SpecimenRegistry.tickets`.
    override var specimen: String {
        "ticketsRoom"
    }

    /// How far the band's channels must spread for it to be the brand hue rather than one of the
    /// neutrals the platform fills a row with — `#464646` unemphasised, and the deck under it.
    private let chromaticSpread = 0x40
    /// What the row's ink must clear against its own band. WCAG's floor is 4.5:1 and this is a
    /// capture rather than the contract's sRGB, so the margin is spent on the colour space.
    private let inkFloor = 4.0

    func testTheSelectedRowsBandDoesNotFollowFirstResponder() throws {
        let row = try XCTUnwrap(backlogRow, "The backlog drew no row this case could address.")
        row.click()
        let emphasised = try readings(of: row, whileList: "is first responder")
        try leaveTheList()
        let quiet = try readings(of: row, whileList: "is not first responder")
        XCTAssertEqual(
            emphasised.band, quiet.band,
            "The selected row's band changed when focus left the list — \(hex(emphasised.band)) to "
                + "\(hex(quiet.band)). This ground does not turn on first-responder status; a band "
                + "that moved is the platform's own fill showing through.",
        )
    }

    /// The band and the ink on it, both asserted, both off the drawn row.
    private func readings(
        of row: XCUIElement,
        whileList state: String,
    ) throws
        -> (band: Int, ink: Int) {
        let counts = try XCTUnwrap(
            colours(of: row),
            "No capture of the row while the list \(state).",
        )
        let band = try XCTUnwrap(counts.max { $0.value < $1.value }?.key)
        let channels = (0 ..< 3).map { band >> ((2 - $0) * 8) & 0xFF }
        XCTAssertTrue(
            (channels.max() ?? 0) - (channels.min() ?? 0) >= chromaticSpread,
            "The selected backlog row's band read \(hex(band)) while the list \(state) — a neutral, "
                + "where the loud rung is a saturated blue. That is the platform's own fill "
                + "showing: #464646 repeated is its unemphasised one exactly.",
        )
        // The ink, as the darkest colour drawn over enough of the row to be a voice rather than
        // one antialiased edge — the words, the `#id` and the caption are all set in it.
        let ink = try XCTUnwrap(
            counts.filter { $0.value >= 100 }.min { luminance($0.key) < luminance($1.key) }?.key,
            "The row drew nothing over enough of itself to be read as its ink.",
        )
        XCTAssertTrue(
            contrast(ink, band) >= inkFloor,
            "The selected row's ink read \(hex(ink)) on \(hex(band)) — \(contrast(ink, band)) to "
                + "one, while the list \(state). Every voice on this ground is `text.onAccent`.",
        )
        return (band, ink)
    }

    /// Focus moved by NAME, and checked: a click at a coordinate can land on something that never
    /// takes first responder, and then the reading above is unchanged for the wrong reason.
    private func leaveTheList() throws {
        let field = app.textFields["Search the backlog"]
        XCTAssertTrue(field.waitForExistence(timeout: 10), "The room drew no search field.")
        field.click()
        let focused = expectation(
            for: NSPredicate(format: "hasKeyboardFocus == true"), evaluatedWith: field,
        )
        XCTAssertEqual(
            XCTWaiter().wait(for: [focused], timeout: 10), .completed,
            "Focus never left the backlog, so the second reading proves nothing.",
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

    /// Every colour in the row's own screenshot and how much of the row each covers.
    ///
    /// Redrawn into a context this method makes rather than sampled where the capture put them: a
    /// `CGImage` off a screenshot carries its own byte order and alpha, and reading `data[at]` as
    /// red under `byteOrder32Little` measures blue.
    private func colours(of row: XCUIElement) -> [Int: Int]? {
        guard let capture = row.screenshot().image
            .cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        let width = capture.width
        let height = capture.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &pixels,
            width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue,
        ) else { return nil }
        context.draw(capture, in: CGRect(x: 0, y: 0, width: width, height: height))
        var counts: [Int: Int] = [:]
        // One skipped byte, then red, green, blue — this context's own layout, not the capture's.
        for at in stride(from: 0, to: pixels.count, by: 4) {
            let colour = Int(pixels[at + 1]) << 16 | Int(pixels[at + 2]) << 8 | Int(pixels[at + 3])
            counts[colour, default: 0] += 1
        }
        return counts
    }

    private func luminance(_ colour: Int) -> Double {
        let weights: [Double] = [0.2126, 0.7152, 0.0722]
        var total = 0.0
        for index in 0 ..< 3 {
            let channel = Double((colour >> ((2 - index) * 8)) & 0xFF) / 255
            let linear: Double = channel <= 0.03928
                ? channel / 12.92
                : pow((channel + 0.055) / 1.055, 2.4)
            total += weights[index] * linear
        }
        return total
    }

    private func contrast(_ one: Int, _ other: Int) -> Double {
        let readings = [luminance(one), luminance(other)]
        return ((readings.max() ?? 0) + 0.05) / ((readings.min() ?? 0) + 0.05)
    }

    private func hex(_ colour: Int) -> String {
        "#" + String(format: "%06X", colour)
    }
}
