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
///
/// A ruler runs on the main actor and the whole-document measure pass does not (ADR-0030, Rule 3),
/// so an ask off the main actor is answered out of the store alone. The pass warms the faces it
/// will set before it starts — `warm(_:)` — and `coldAsks` counts every ask that arrived off the
/// main actor with nothing held, which is a warm list that has fallen behind the faces the feed
/// sets rather than something a reader can see. A suite holds it at zero over every prose fixture.
public enum ProseLineBox {
    /// This face's line box. Measured where a ruler can be reached and read out of the store where
    /// one cannot.
    public static func of(_ face: ProseFace) -> CGFloat {
        answered(by: boxes, for: face, measuring: measured)
    }

    /// What a run holding NO characters stands at, which is neither this face's line box nor a
    /// smaller face's: SwiftUI falls back to the platform's own empty box, the same number at every
    /// rung and in both designs. 14 points here, where a body line is 18.
    ///
    /// One construct in the feed reaches it: a fence the agent opened and closed with nothing in
    /// between (`FeedRowMeasure`). Measured rather than named, because "the same at every rung" is
    /// an observation about an engine rather than a rule it publishes.
    public static func ofEmptyRun(_ face: ProseFace) -> CGFloat {
        answered(by: empties, for: face) { ProseProbe.measured(ProseProbe.run("", in: $0)) }
    }

    /// Every face a pass is about to set, measured while a ruler can still be reached.
    ///
    /// The caller names the list, because which faces a document sets is a fact about the surface
    /// drawing it and not about this module. Both probes are warmed together: a fence with nothing
    /// in it is as ordinary as one with something in it, and a warm that covered only the first
    /// would leave the second cold on the row that has one.
    @MainActor public static func warm(_ faces: [ProseFace]) {
        for face in faces {
            _ = of(face)
            _ = ofEmptyRun(face)
        }
    }

    #if DEBUG
        /// Every ask, across every probe in this module, that arrived off the main actor with
        /// nothing held — see the type's note. Published here because this is the public name the
        /// probes are reached through.
        public static var coldAsks: Int {
            ProseProbe.colds.withLock { $0 }
        }

        /// Every ruler pass this has paid for — three hosting measures each, and the count that
        /// holds the claim above to something a test can see rather than reason about.
        public static var rulings: Int {
            ruled.withLock { $0 }
        }

        public static func forgetCounts() {
            ProseProbe.colds.withLock { $0 = 0 }
            ruled.withLock { $0 = 0 }
        }
    #endif

    private static let ruled = ProseTally(0)

    /// The line counts the candidates are judged on. One, because it is the box on its own; and two
    /// more, because a candidate wrong by less than a point can still be right at one line and
    /// wrong once the advances have pushed the total past an integer.
    private static let counts = [1, 3, 8]

    private static let boxes = ProseProbe()
    private static let empties = ProseProbe()

    /// The one shape both probes are asked through — see `ProseProbe.answer(for:cold:measuring:)`.
    /// The cold answer is this face's fractional box, which is the box the module took before any
    /// of this and the one that cannot overlap the row below.
    private static func answered(
        by probe: borrowing ProseProbe,
        for face: ProseFace,
        measuring: @MainActor (ProseFace) -> CGFloat,
    )
        -> CGFloat {
        probe.answer(
            for: face,
            cold: { (face: ProseFace) in face.lineBox(under: ProseEngine.fractional) },
            measuring: measuring,
        )
    }

    /// Falls to the fractional box where no candidate accounts for every count.
    @MainActor private static func measured(_ face: ProseFace) -> CGFloat {
        ruled.withLock { $0 += 1 }
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
