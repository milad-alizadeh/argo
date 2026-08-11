import SwiftUI

/// One ion pass across a call that is still running, masked to that call's own type.
///
/// **The whole row is one painting surface.** The gradient is masked to everything the row says as
/// a SINGLE piece — mark, verb, subject and all — never to each span. Painting per span fires every
/// span at once and restarts the sweep at each word boundary; it looks right in a screenshot and
/// wrong in motion, which is why a still cannot catch it and why this modifier takes the whole
/// sentence rather than being applied inside it.
///
/// The kind's glyph shares the one mask, because a mask is taken from what is drawn.
struct FeedCallLineIon: ViewModifier {
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// Whether this call is the one in flight.
    let isRunning: Bool

    /// The ROLE answers Reduce Motion, not this call site: `working` resolves to `nil` when
    /// movement is off, and a pass with no animation behind it should not be drawn at all. Asked of
    /// the role rather than of a rung, because every rung of `ArgoWaitAge` gives the same answer.
    func body(content: Content) -> some View {
        content.overlay {
            if isRunning, ArgoMotion.working.resolved(reduceMotion: reduceMotion) != nil {
                IonWash().mask { content.environment(\.isIonMask, true) }
            }
        }
    }
}

extension EnvironmentValues {
    /// True while a row is drawing itself AS its own ion mask. A mask is taken from what is drawn,
    /// so a ground under a run of type masks as solid and lights the whole chip rather than the
    /// letters on it.
    @Entry var isIonMask: Bool = false
}

extension View {
    /// Lights this run of type with the ion while a call is in flight. Applied to the part of the
    /// row the ion crosses, so what is left outside — the chevron — stays out of the mask.
    func feedCallLineIon(isRunning: Bool) -> some View {
        modifier(FeedCallLineIon(isRunning: isRunning))
    }
}

/// The pass itself: the ramp at the full length of the line, translating across it.
///
/// Only the TRANSFORM animates. A translating element is compositor-owned; moving a gradient's own
/// stops is not, and repaints every frame of a loop that never ends.
private struct IonWash: View {
    @Environment(\.argo) private var argo

    var body: some View {
        GeometryReader { proxy in
            FeedIonLoop { phase, aged in
                argo.color.ion.pass
                    .frame(width: proxy.size.width)
                    .offset(x: offset(at: phase, over: proxy.size.width))
                    // The row's wash paints TYPE rather than casting light, so it cools by the
                    // ladder's proportion. Dimming it to the thread's own number would take a
                    // three-second call below what #616 approved.
                    .opacity(aged.cooling)
            }
        }
    }

    /// Where the pass sits, as a multiple of the line's own width. It starts and ends entirely off
    /// the line, so the ion enters and leaves rather than appearing mid-word. Movement off never
    /// reaches here — the modifier above draws no wash at all then.
    private func offset(at phase: Double?, over width: CGFloat) -> CGFloat {
        ((phase ?? 0) * 2 - 1) * width
    }
}
