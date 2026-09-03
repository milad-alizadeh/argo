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
///
/// A hosting controller is the main actor's, and since ADR-0030 the readers are not: the
/// whole-document measure pass asks for line boxes off the main actor and in parallel. So the
/// KEEPING is a lock-guarded store and the MEASURING stays where it has to be — which is what
/// `of(_:measuring:)` and `held(_:)` are the two halves of.
struct ProseProbe: ~Copyable, Sendable {
    private let read = ProseStore<CGFloat>(ceiling: 256, cap: 256)
    private let readAt = ProseTally(ProseTextSize.epoch())

    /// This face's answer, if one was measured at the size in force. Never measures: nothing off
    /// the main actor can.
    func held(_ face: ProseFace) -> CGFloat? {
        atCurrentSize()
        return read.held(face.key)
    }

    /// This face's answer, measured on first sight and remembered until the text size moves.
    @MainActor func of(_ face: ProseFace, measuring: (ProseFace) -> CGFloat) -> CGFloat {
        atCurrentSize()
        return read.reading(of: face.key) { _ in measuring(face) }
    }

    /// This face's answer: what is held, else the ruler where one can be reached, else the caller's
    /// own arithmetic with the miss counted.
    ///
    /// The one shape every probe is asked through. A ruler is the main actor's and the
    /// whole-document measure pass is not (ADR-0030, Rule 3), so a pass warms the faces it will set
    /// before it starts and an ask that arrives off the main actor with nothing held is a warm list
    /// that has fallen behind the faces the feed sets — `coldAsks`, which a suite holds at zero
    /// over
    /// every prose fixture, rather than something a reader can see.
    func answer(
        for face: ProseFace,
        cold: (ProseFace) -> CGFloat,
        measuring: @MainActor (ProseFace) -> CGFloat,
    )
        -> CGFloat {
        if let known = held(face) {
            return known
        }
        guard Thread.isMainThread else {
            ProseWarmth.owed?.owe(face)
            #if DEBUG
                Self.colds.withLock { $0 += 1 }
            #endif
            return cold(face)
        }
        return MainActor.assumeIsolated { of(face, measuring: measuring) }
    }

    /// Everything measured at a size the reader has since moved off, dropped (#1027).
    private func atCurrentSize() {
        let epoch = ProseTextSize.epoch()
        let moved = readAt.withLock { at -> Bool in
            guard at != epoch else { return false }
            at = epoch
            return true
        }
        guard moved else { return }
        read.empty()
    }
}

extension ProseProbe {
    #if DEBUG
        /// Every ask, across every probe, that arrived off the main actor with nothing held.
        /// Published by `ProseLineBox`, which is the public name over these.
        static let colds = ProseTally(0)
    #endif

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
