@testable import ArgoUI
import Foundation
import Testing

/// A single-line row reported as the pieces it is drawn in — a call's rect, its verb, what it
/// named, and what it did in lines.
///
/// The suite that stands for the user's complaint: the `+n −n` used to be a fixed slab held against
/// the trailing edge, whatever the row drew and wherever it drew it. Now each count is where the
/// row puts it and as wide as its digits measure, so a one-line change reads narrower than a
/// two-hundred-line one.
@MainActor
@Suite("Minimap line pieces")
struct MinimapLineRectTests {
    private static let measure: CGFloat = 720 - ArgoFeedRow.inset * 2

    private static func rects(_ parts: [MinimapLinePart], across measure: CGFloat = measure)
        -> [MinimapRowRect] {
        MinimapRowShape.line(parts, ink: .command, across: measure)
    }

    private static func call(added: Int, removed: Int) -> [MinimapLinePart] {
        [
            .column(ArgoFeedRow.callSymbolWidth, .command),
            .words("Edited", .command),
            .words("FeedInk.swift", .command),
            .words("+\(added)", .added, in: .machine),
            .words("−\(removed)", .removed, in: .machine),
        ]
    }

    @Test
    func `the pieces are laid end to end with the row's own gap between them`() {
        let rects = Self.rects(Self.call(added: 30, removed: 10))
        #expect(rects.count == 5)
        #expect(rects[0].from == 0)
        #expect(rects[0].to == ArgoFeedRow.callSymbolWidth)
        for (before, after) in zip(rects, rects.dropFirst()) {
            #expect(abs(after.from - before.to - ArgoFeedRow.callGap) < 0.0001)
        }
    }

    @Test
    func `each piece is drawn in its own ink and stands one line tall`() {
        let rects = Self.rects(Self.call(added: 30, removed: 10))
        #expect(rects.map(\.ink) == [.command, .command, .command, .added, .removed])
        #expect(rects.allSatisfy { $0.y == 0 })
        #expect(rects.allSatisfy { $0.height == ProseFace.body.lineBox })
    }

    /// The counts are as wide as their digits, so a bigger patch is a wider rect. The fixed slab
    /// reported the same width for `+1` and `+2000`.
    @Test
    func `a bigger count is drawn wider than a smaller one`() {
        let small = Self.rects(Self.call(added: 1, removed: 1))
        let large = Self.rects(Self.call(added: 2000, removed: 1))
        #expect(Self.width(large[3]) > Self.width(small[3]))
        // And it pushes what follows it along, exactly as the row's own stack does.
        #expect(large[4].from > small[4].from)
    }

    /// The row is `lineLimit(1)`, so nothing runs past the column — a very long subject is cut
    /// where the reading cuts it rather than reaching past the lane's drawable.
    @Test
    func `nothing is drawn past the measure`() {
        let rects = Self.rects([
            .words(MinimapText.words(4000), .command),
            .words("+1", .added, in: .machine),
        ])
        #expect(rects.allSatisfy { $0.to <= Self.measure })
        #expect(rects.count == 1)
    }

    @Test
    func `a column not yet laid out still reports an ordered rect`() {
        let rects = Self.rects(Self.call(added: 1, removed: 1), across: 0)
        #expect(rects.allSatisfy { $0.from <= $0.to })
    }

    private static func width(_ rect: MinimapRowRect) -> CGFloat {
        rect.to - rect.from
    }
}
