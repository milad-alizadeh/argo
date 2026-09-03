import AppKit
import SwiftUI

/// One number per face, MEASURED through a detached hosting controller and kept for the process.
///
/// Three of them exist — the line box a face's engine stands one line in, what an empty run
/// collapses to, and how far a line hangs below its own first baseline — and each is a fact about
/// the ENGINE rather than about the ladder, which is why none of them is derived. See
/// `ProseLineBox` for what that argument is worth.
///
/// The keeping is here so it is written once: a probe is only affordable because it is paid once
/// per face, and the Accessibility text size is the one thing that retires every answer (#1027).
@MainActor struct ProseProbe {
    private var read: [String: CGFloat] = [:]
    private var readAt = ProseTextSize.epoch()

    /// This face's answer, measured on first sight and remembered until the text size moves.
    mutating func of(_ face: ProseFace, measuring: (ProseFace) -> CGFloat) -> CGFloat {
        let epoch = ProseTextSize.epoch()
        if epoch != readAt {
            read.removeAll()
            readAt = epoch
        }
        if let known = read[face.key] {
            return known
        }
        let measured = measuring(face)
        read[face.key] = measured
        return measured
    }
}

extension ProseProbe {
    /// One run through a detached hosting controller — never installed in a window, and building no
    /// sizing constraints of its own.
    @MainActor static func measured(_ run: some View) -> CGFloat {
        let ruler = NSHostingController(rootView: AnyView(run))
        ruler.sizingOptions = []
        let height = ruler.sizeThatFits(
            in: NSSize(width: 400, height: CGFloat.greatestFiniteMagnitude),
        ).height
        ruler.rootView = AnyView(EmptyView())
        return height
    }

    /// One run in a face, set the way the feed sets it — its own design, mono included.
    @MainActor static func run(_ text: String, in face: ProseFace) -> some View {
        let weight: Font.Weight? = face.isBold ? .semibold : nil
        return face.isMachine
            ? AnyView(Text(text).argoMono(face.rung, weight))
            : AnyView(Text(text).argoText(face.rung, weight))
    }
}
