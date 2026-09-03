@testable import ArgoUI
import SwiftUI
import Testing

/// What a re-wrap IS: the column the words wrap across moving, not the table's frame moving
/// (#1132).
///
/// `ArgoFeedRow.column` caps the measure at 720pt and the row insets take 24pt a side, so every
/// width at or above 720 wraps the reading across the same 672pt. A deck wider than the column —
/// which is most of them on a real display — can therefore be resized as far as you like without
/// a single row's height changing, and the old comparison called every one of those a re-wrap: the
/// whole document thrown away and measured again, to arrive back at the numbers it already had.
///
/// Profiled against a 3 349-row reading, `-[NSTableView tile]` put the table through
/// 1023 → 766 → 1023 → 766 inside 60 ms. All four of those measure 672. Four whole-document passes
/// over 3 349 rows, each cancelling the last, for no height at all — and while they ran the feed
/// stood with no settled document, which is what the overview lane draws the wrong reading through
/// (ADR-0030, Rule 3).
@Suite("Feed re-wrap measure")
struct FeedRewrapMeasureTests {
    /// The widths the tile cascade actually put the table through.
    private static let tiled: (wide: CGFloat, narrow: CGFloat) = (1023, 766)

    private static func stamp(atWidth width: CGFloat) -> FeedMeasureStamp {
        FeedMeasureStamp(
            width: width,
            ink: FeedCellEnvironment.Ink(colorScheme: .dark, dynamicTypeSize: .medium),
            rows: [],
            reader: FeedReaderStanding(),
        )
    }

    /// The claim, in the numbers the profile caught.
    @Test
    func `two widths above the column wrap the same and do not re-wrap`() {
        let wide = Self.stamp(atWidth: Self.tiled.wide)
        let narrow = Self.stamp(atWidth: Self.tiled.narrow)

        #expect(wide.measure == narrow.measure)
        #expect(wide.rewraps(against: narrow) == false)
        #expect(narrow.rewraps(against: wide) == false)
    }

    /// The negative control, and the one that must never be given up: under the column cap the
    /// measure follows the width, so a pane that really narrowed re-wraps.
    @Test
    func `two widths below the column do re-wrap`() {
        let roomy = Self.stamp(atWidth: 400)
        let tight = Self.stamp(atWidth: 340)

        #expect(roomy.measure != tight.measure)
        #expect(roomy.rewraps(against: tight))
    }

    /// And the seam itself: a width that crossed the cap moved the measure, so it re-wraps even
    /// though one side of it is above the column.
    @Test
    func `a width that crossed the column re-wraps`() {
        let over = Self.stamp(atWidth: ArgoFeedRow.column + 100)
        let under = Self.stamp(atWidth: ArgoFeedRow.column - 100)

        #expect(over.rewraps(against: under))
    }

    /// The ink is untouched by any of this — it re-wraps on its own, at any width.
    @Test
    func `an ink that moved still re-wraps at one width`() {
        let dark = Self.stamp(atWidth: Self.tiled.wide)
        let light = FeedMeasureStamp(
            width: Self.tiled.wide,
            ink: FeedCellEnvironment.Ink(colorScheme: .light, dynamicTypeSize: .medium),
            rows: [],
            reader: FeedReaderStanding(),
        )

        #expect(dark.rewraps(against: light))
    }

    /// Nothing to compare against is still the whole document — a first settle is not a re-wrap
    /// being avoided.
    @Test
    func `no document to compare against re-wraps`() {
        #expect(Self.stamp(atWidth: Self.tiled.wide).rewraps(against: nil))
    }
}
