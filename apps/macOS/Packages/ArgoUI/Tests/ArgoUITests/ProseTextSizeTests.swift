import AppKit
@testable import ArgoUI
import ProseText
import Testing

/// #1027, held to a COUNT. What makes a stale answer visible is that the store answered at all, so
/// the claim is that the measurement was RE-TAKEN once the size moved — a count, which is exactly
/// the same idle and loaded (ADR-0028 Rule 8).
///
/// The size is moved through the seam that reads it and not through System Settings, because
/// nothing in process moves the real one: `NSFont.preferredFont(forTextStyle:)` answers an app-wide
/// setting with no API to set it and no notification when it changes. So `ProseTextSize.move(to:)`
/// stands in for the reader's hand, one line above the platform read, and everything below it —
/// the epoch, the drop, the re-measure — is the shipped path exactly.
@MainActor
@Suite("Prose text size", .serialized)
struct ProseTextSizeTests {
    /// Distinct from every other suite's words, so a first ask here is cold without this one
    /// reaching into the static stores to empty them.
    private static let words = "text size answered finished looked"

    /// A size no setting resolves to, so a move is unambiguous.
    private static let elsewhere: CGFloat = 99

    @Test
    func `a width measured at one size is re-measured once the size has moved`() {
        defer { ProseTextSize.move(to: nil) }
        let text = Self.words + " width"

        _ = ProseMetrics.width(of: text)
        #expect(ProseMetrics.typesets(during: { _ = ProseMetrics.width(of: text) }) == 0)

        ProseTextSize.move(to: Self.elsewhere)
        #expect(ProseMetrics.typesets(during: { _ = ProseMetrics.width(of: text) }) == 1)
    }

    /// The word floor and the wrap, which are the other two stores and the ones a table's columns
    /// are dealt from — a floor answered at the old size deals a column the wrong room.
    @Test
    func `a word floor and a wrap are both re-measured once the size has moved`() {
        defer { ProseTextSize.move(to: nil) }
        let text = Self.words + " floor and wrap"
        let measure = ProseMetrics.width(of: text) / 2

        _ = ProseMetrics.word(in: text)
        _ = ProseMetrics.lay(out: text, across: measure)
        #expect(ProseMetrics.typesets {
            _ = ProseMetrics.word(in: text)
            _ = ProseMetrics.lay(out: text, across: measure)
        } == 0)

        ProseTextSize.move(to: Self.elsewhere)
        #expect(ProseMetrics.typesets {
            _ = ProseMetrics.word(in: text)
            _ = ProseMetrics.lay(out: text, across: measure)
        } == 2)
    }

    /// The line box, which is the OTHER store keyed on a face and nothing else. A row placed at a
    /// box read for a size the reader has moved off is placed at the wrong height.
    @Test
    func `a line box measured at one size is re-ruled once the size has moved`() {
        defer { ProseTextSize.move(to: nil) }
        let face = ProseFace(rung: .caption2, isBold: true, isMachine: true)

        _ = ProseLineBox.of(face)
        let ruled = ProseLineBox.rulings
        _ = ProseLineBox.of(face)
        #expect(ProseLineBox.rulings == ruled)

        ProseTextSize.move(to: Self.elsewhere)
        _ = ProseLineBox.of(face)
        #expect(ProseLineBox.rulings == ruled + 1)
    }

    /// The poll drops on a MOVE and never merely on the window expiring. A window that dropped on
    /// every expiry would empty the stores sixty times a second, which is the cliff ADR-0028 Rule 4
    /// exists about — and the suite would go on passing, because everything above is a re-measure.
    @Test
    func `a size that has not moved keeps what was measured across the window`() {
        let text = Self.words + " across the window"

        _ = ProseMetrics.width(of: text)
        // Several times the 16 ms window, so the next ask really does re-read the platform.
        Thread.sleep(forTimeInterval: 0.05)

        #expect(ProseMetrics.typesets(during: { _ = ProseMetrics.width(of: text) }) == 0)
    }

    /// And the epoch itself only turns on a move: two asks a window apart at one size are the same
    /// generation, which is what every store's `readAt` compares against.
    @Test
    func `the epoch turns on a move and not on the window`() {
        defer { ProseTextSize.move(to: nil) }

        let standing = ProseTextSize.epoch()
        Thread.sleep(forTimeInterval: 0.05)
        #expect(ProseTextSize.epoch() == standing)

        ProseTextSize.move(to: Self.elsewhere)
        #expect(ProseTextSize.epoch() == standing + 1)
    }
}
