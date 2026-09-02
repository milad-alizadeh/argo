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
/// `FeedTypesetHeightTests` holds a typeset row against what SwiftUI draws at zero tolerance — so
/// the suite passed here and failed a point a block on CI, and the error walked down the document
/// until a click on a Turn opened the reading 22 points off it.
///
/// It is not one rule per machine, which is what the first fix assumed. On ONE machine the body and
/// a `### heading` stand at their fractional box while a `## heading` and a section label stand at
/// the snapped one; on the CI runner the body stands at the snapped one and a `# heading` at its
/// fractional. So the choice is made per FACE, by drawing that face and reading the answer: three
/// line counts, and the candidate that accounts for all three wins.
///
/// Once per face per process. The advance between two lines is NOT measured — the ruler agrees with
/// `box + leading` on every face on both machines, and only the first line's box was ever in doubt.
public enum ProseLineBox {
    @MainActor public static func of(_ face: ProseFace) -> CGFloat {
        let epoch = ProseTextSize.epoch()
        if epoch != readAt {
            read.removeAll()
            readAt = epoch
        }
        if let known = read[face.key] {
            return known
        }
        let box = measured(face)
        read[face.key] = box
        return box
    }

    /// The line counts the candidates are judged on. One, because it is the box on its own; and two
    /// more, because a candidate wrong by less than a point can still be right at one line and
    /// wrong once the advances have pushed the total past an integer.
    private static let counts = [1, 3, 8]

    @MainActor private static var read: [String: CGFloat] = [:]

    /// The setting those boxes were drawn at. A box is the RESOLVED face's ascent over its descent,
    /// so it moves with the Accessibility text size and the face's key does not say which (#1027).
    @MainActor private static var readAt = ProseTextSize.epoch()

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
    /// exactly as `FeedTableCoordinator` measures a row.
    @MainActor private static func drawn(_ face: ProseFace, lines: Int) -> CGFloat {
        let ruler = NSHostingController(rootView: AnyView(
            Text(Array(repeating: "A", count: lines).joined(separator: "\n"))
                .argoText(face.rung, face.isBold ? .semibold : nil)
                .lineSpacing(face.leading),
        ))
        ruler.sizingOptions = []
        let height = ruler.sizeThatFits(
            in: NSSize(width: 400, height: CGFloat.greatestFiniteMagnitude),
        ).height
        ruler.rootView = AnyView(EmptyView())
        return height
    }
}
