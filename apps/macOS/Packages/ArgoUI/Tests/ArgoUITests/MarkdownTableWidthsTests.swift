@testable import ArgoUI
import Foundation
import Testing

/// How a pipe table's columns divide the measure. The bug this arithmetic exists for: a `Grid`
/// sizing itself shrank every column to its longest word once the asks passed the measure, so a
/// four-column table came out a third of the feed wide with every cell wrapped to two syllables.
@Suite("Markdown table widths")
struct MarkdownTableWidthsTests {
    typealias Ask = MarkdownTableWidths.Ask

    private static func widths(_ asks: [Ask], across measure: CGFloat = 720) -> [CGFloat] {
        MarkdownTableWidths.widths(asks, across: measure)
    }

    /// The claim the user reads: a table is as wide as the feed, whatever its words add up to.
    @Test(arguments: [
        [Ask(ideal: 40, floor: 20), Ask(ideal: 60, floor: 30)],
        [Ask(ideal: 4000, floor: 900), Ask(ideal: 30, floor: 20)]
    ])
    func `the columns fill the measure exactly`(asks: [Ask]) {
        #expect(abs(Self.widths(asks).reduce(0, +) - 720) < 0.0001)
    }

    /// A table with room to spare grows in proportion, so a narrow column stays narrow.
    @Test
    func `slack is shared in proportion to what each column asked for`() {
        let widths = Self.widths(
            [Ask(ideal: 100, floor: 100), Ask(ideal: 300, floor: 100)], across: 800,
        )
        #expect(widths[1] > widths[0] * 2)
    }

    /// The whole point of the floor. Proportional shrinking alone took a `#` column below the width
    /// of one digit whenever a prose column asked for ten times the measure.
    @Test
    func `a column keeps its floor while a greedy neighbour is cut back`() {
        let widths = Self.widths(
            [Ask(ideal: 30, floor: 30), Ask(ideal: 4000, floor: 90)], across: 400,
        )
        #expect(widths[0] >= 30)
        #expect(widths[1] > widths[0])
    }

    /// Floors that do not fit are over-full, which is the cells' problem to wrap and not the
    /// table's to overflow: it still ends where the measure does.
    @Test
    func `floors wider than the measure are scaled rather than overflowed`() {
        let widths = Self.widths(
            [Ask(ideal: 500, floor: 500), Ask(ideal: 500, floor: 500)],
            across: 400,
        )
        #expect(abs(widths.reduce(0, +) - 400) < 0.0001)
        #expect(widths[0] == widths[1])
    }

    @Test
    func `a table with no columns asks for nothing`() {
        #expect(Self.widths([]).isEmpty)
    }

    /// Words nobody could measure — a table of empty cells — still divide the measure rather than
    /// dividing by zero.
    @Test
    func `columns asking for nothing split the measure evenly`() {
        let widths = Self.widths([Ask(ideal: 0, floor: 0), Ask(ideal: 0, floor: 0)], across: 400)
        #expect(widths == [200, 200])
    }
}
