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
/// Asked off the main actor by everything that reads a `ProseRun`'s geometry, so the probe is
/// warmed and read the way `ProseLineBox`'s two are — see there for what a cold ask off the main
/// actor means.
public enum ProseBaseline {
    /// Cold off the main actor, this is the font's own descent: the closest arithmetic there is to
    /// what the engine leaves under a baseline, and what the module compared its measurement
    /// against when it was written.
    public static func under(_ face: ProseFace) -> CGFloat {
        hangs.answer(for: face, cold: { -$0.font.descender }, measuring: measured)
    }

    /// Measured while a ruler can still be reached — the same warm `ProseLineBox.warm(_:)` makes,
    /// and made in the same breath.
    @MainActor public static func warm(_ faces: [ProseFace]) {
        for face in faces {
            _ = under(face)
        }
    }

    private static let hangs = ProseProbe()

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
