import AppKit
import SwiftUI

/// Which way the text engine on THIS machine rounds a run of lines.
///
/// Two are in the wild and the feed has met both. One keeps the font's own fractional metrics and
/// rounds the finished block once; the other snaps every baseline onto a whole point, so a run pays
/// `ceil` on its ascent, on its descent and on every line advance after the first. The gap between
/// them is about a point a BLOCK — a message measured a point short leaves a gap under its last
/// line, a point long overlaps the row below it, and nothing downstream can tell either from a bug.
///
/// Read off the machine rather than assumed. Neither the OS version nor the font names the engine
/// apart, and one build of this app meets both: the same suite that holds a typeset height against
/// the ruler passes on a laptop and fails a point a block on CI. Measured once per process on the
/// body face, because it is the ENGINE's rule and not the face's.
enum ProseEngine {
    /// The font's own fractional metrics, rounded once over the finished block.
    case fractional
    /// Every baseline snapped onto a whole point.
    case wholePoint

    /// The engine this process draws through.
    @MainActor static var inForce: ProseEngine {
        if let known {
            return known
        }
        let read = measured()
        known = read
        return read
    }

    @MainActor private static var known: ProseEngine?

    /// Three lines of the body face through the same kind of ruler the table measures a row with,
    /// against what each engine says they stand at.
    ///
    /// THREE and not two: the two answers differ by what a snap adds to one line box plus what it
    /// adds to each advance under it, and on some fonts those cancel at two lines. At three they
    /// cannot, because the advances are counted twice and the box still once.
    ///
    /// Falls to `fractional` where neither answer is the drawn one, which is the reading that keeps
    /// a row inside the height the ruler would have given it.
    @MainActor private static func measured() -> ProseEngine {
        let face = ProseFace.body
        let ruler = NSHostingController(rootView: AnyView(
            Text("A\nA\nA")
                .argoText(face.rung)
                .lineSpacing(ArgoFeedRow.proseLineSpacing),
        ))
        ruler.sizingOptions = []
        let drawn = ruler.sizeThatFits(
            in: NSSize(width: 400, height: CGFloat.greatestFiniteMagnitude),
        ).height
        ruler.rootView = AnyView(EmptyView())
        // Rounded up on both sides: a block stands at a whole point either way, and it is the
        // BOX inside it the two engines put in different places.
        let snapped = ceil(face.height(ofLines: 3, under: .wholePoint))
        return drawn >= snapped ? .wholePoint : .fractional
    }
}
