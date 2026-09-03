import AppKit
import SwiftUI

/// How far a face's line stands BELOW its first baseline, MEASURED through the ruler rather than
/// worked out from the font.
///
/// The one number a baseline-aligned row needs and a line box cannot give. A mark taller than the
/// text's own ascent — a question's tick box against the words beside it — hangs below the baseline
/// it was aligned to, and the row grows by exactly what hangs: its height is the mark's own height
/// plus this. Below that threshold the mark disappears inside the line and the row does not move at
/// all.
///
/// Not derived, for `ProseLineBox`'s reason. The font's descent and its leading do not account for
/// it — the body face descends 3.99 and leads 0.69 where a row measures 5.0 — and the difference is
/// the engine's, which is a fact about the machine rather than about the ladder.
///
/// Once per face per process, kept by `ProseProbe`.
public enum ProseBaseline {
    @MainActor public static func under(_ face: ProseFace) -> CGFloat {
        hangs.of(face, measuring: measured)
    }

    @MainActor private static var hangs = ProseProbe()

    /// A mark far taller than any line, aligned to this face's first baseline: what the row comes
    /// out at, less the mark itself, IS what hangs under the baseline.
    @MainActor private static func measured(_ face: ProseFace) -> CGFloat {
        let mark: CGFloat = 1000
        let height = ProseProbe.measured(
            HStack(alignment: .firstTextBaseline) {
                Color.clear.frame(width: 1, height: mark)
                ProseProbe.run("A", in: face)
            },
        )
        return max(0, height - mark)
    }
}
