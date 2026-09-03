import AppKit
import ArgoDesign
import SwiftUI

/// The two heights a text engine can stand ONE line of a face at.
///
/// Both are read off the same font. The fractional one is the box the glyphs actually need; the
/// snapped one is that box rounded out at either end, which is what an engine putting baselines on
/// whole points leaves room for. Which of them a face is drawn at is not something this module gets
/// to decide, so it is not derived here — see `ProseLineBox`.
public enum ProseEngine: CaseIterable {
    /// The font's own ascent over its own descent.
    case fractional
    /// That box rounded out at BOTH ends: an ascent and a descent are measured from the baseline in
    /// opposite directions, so a box holding them both rounds each away from it.
    case wholePoint
}

/// How tall one line of a face really stands, MEASURED through the ruler rather than worked out
/// from the font.
///
/// The arithmetic was the bug. `ProseFace` took the fractional box for every face, and
/// `FeedTypesetHeightTests` holds a typeset row against what SwiftUI draws — so the suite passed
/// here and failed a point a block on CI, and the error walked down the document until a click on a
/// Turn opened the reading 22 points off it.
///
/// It is not one rule per machine, which is what the first fix assumed. On ONE machine the body and
/// a `### heading` stand at their fractional box while a `## heading` and a section label stand at
/// the snapped one; on the CI runner the body stands at the snapped one and a `# heading` at its
/// fractional. So the choice is made per FACE, by drawing that face and reading the answer: three
/// line counts, and the candidate that accounts for all three wins.
///
/// The face is drawn in ITS OWN design, mono included: `.system(.subheadline, design: .monospaced)`
/// stands at 15 where the sans at the same rung stands at 16, so a probe that drew the sans for
/// both would report a mono caption a point taller than it is — and a point is an overlap.
///
/// Once per face per process, kept by `ProseProbe`. The advance between two lines is NOT measured —
/// the ruler agrees with `box + leading` on every face on both machines, and only the first line's
/// box was ever in doubt.
public enum ProseLineBox {
    @MainActor public static func of(_ face: ProseFace) -> CGFloat {
        boxes.of(face, measuring: measured)
    }

    /// What a run holding NO characters stands at, which is neither this face's line box nor a
    /// smaller face's: SwiftUI falls back to the platform's own empty box, the same number at every
    /// rung and in both designs. 14 points here, where a body line is 18.
    ///
    /// One construct in the feed reaches it: a fence the agent opened and closed with nothing in
    /// between (`FeedRowMeasure`). Measured rather than named, because "the same at every rung" is
    /// an observation about an engine rather than a rule it publishes.
    @MainActor public static func ofEmptyRun(_ face: ProseFace) -> CGFloat {
        empties.of(face) { ProseProbe.measured(ProseProbe.run("", in: $0)) }
    }

    /// The line counts the candidates are judged on. One, because it is the box on its own; and two
    /// more, because a candidate wrong by less than a point can still be right at one line and
    /// wrong once the advances have pushed the total past an integer.
    private static let counts = [1, 3, 8]

    @MainActor private static var boxes = ProseProbe()
    @MainActor private static var empties = ProseProbe()

    #if DEBUG
        /// Every ruler pass this has paid for — three hosting measures each, and the count that
        /// holds the claim above to something a test can see rather than reason about.
        @MainActor public private(set) static var rulings = 0
    #endif

    /// Falls to the fractional box where no candidate accounts for every count, which is the box
    /// the module took before any of this and the one that cannot overlap the row below.
    @MainActor private static func measured(_ face: ProseFace) -> CGFloat {
        #if DEBUG
            rulings += 1
        #endif
        let heights = Self.counts.map { drawn(face, lines: $0) }
        let step = face.step
        for engine in ProseEngine.allCases {
            let box = face.lineBox(under: engine)
            let stands = zip(Self.counts, heights).allSatisfy { count, height in
                let stood: CGFloat = box + CGFloat(count - 1) * step
                return ceil(stood) == height
            }
            if stands {
                return box
            }
        }
        return face.lineBox(under: .fractional)
    }

    /// This face's own words through a hosting controller, exactly as `FeedProseText` sets them and
    /// exactly as the feed's own oracle measures a row.
    @MainActor private static func drawn(_ face: ProseFace, lines: Int) -> CGFloat {
        ProseProbe.measured(
            ProseProbe.run(Array(repeating: "A", count: lines).joined(separator: "\n"), in: face)
                .lineSpacing(face.leading),
        )
    }
}
